#!/usr/bin/env node
// Validerer data/ og bygger den statiske siden til dist/.
// Bruk: node scripts/build.mjs [--check]   (--check: bare validering, ingen filer skrives)
// Miljø: BUILD_TIME=ISO-tid overstyrer «nå» (brukes i tester).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { newCollector, validateStatus, validateIncident, consistencyWarnings, CLOSED } from "./lib/model.mjs";
import { renderIndex, renderIncident, renderArchive, render404 } from "./lib/render.mjs";
import { renderFeed } from "./lib/feed.mjs";
import { renderStatusJson, renderStatusCsv } from "./lib/export.mjs";
import { fetchVendors, offlineVendors } from "./lib/vendors.mjs";
import { overall, ASSETS } from "./lib/render.mjs";
import { renameSync } from "node:fs";

/** Filnavn med innholdshash: css/status.css → css/status.3f2a9c1b.css */
function hashedAssets() {
  const out = {};
  for (const [key, rel] of Object.entries({ css: "css/status.css", theme: "js/theme.js", app: "js/status.js" })) {
    const h = createHash("sha256").update(readFileSync(join(ROOT, "src", rel))).digest("hex").slice(0, 10);
    out[key] = { src: rel, dest: rel.replace(/\.(css|js)$/, `.${h}.$1`) };
  }
  return out;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const DIST = join(ROOT, "dist");
const ARCHIVE_DAYS = 90;

export function loadForbidden() {
  const p = join(ROOT, "config", "forbudte-ord.txt");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")).map(l => l.toLowerCase());
}

function readJson(path, c, where) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { c.error(where, `kan ikke leses som JSON (${e.message})`); return null; }
}

export function load({ dataDir = DATA, forbidden = loadForbidden(), now = new Date() } = {}) {
  const c = newCollector();
  const status = readJson(join(dataDir, "status.json"), c, "data/status.json");
  const components = status ? validateStatus(status, c, forbidden) : new Map();
  const dir = join(dataDir, "hendelser");
  const files = existsSync(dir) ? readdirSync(dir).filter(f => !f.startsWith(".")).sort() : [];
  const incidents = [];
  for (const f of files) {
    if (!f.endsWith(".json")) { c.error(`data/hendelser/${f}`, "bare .json-filer er tillatt"); continue; }
    const id = f.slice(0, -5);
    const inc = readJson(join(dir, f), c, `data/hendelser/${f}`);
    if (!inc) continue;
    validateIncident(id, inc, components, c, forbidden);
    incidents.push({ ...inc, id });
  }
  if (status && c.errors.length === 0) consistencyWarnings(status, incidents, now, c);
  return { status, components, incidents, collector: c };
}

/**
 * Planlagt vedlikehold skifter status ut fra klokka, så ingen trenger å endre den for hånd:
 * «planlagt» → «pagaende» ved start → «fullfort» ved slutt. Satt status «fullfort» brukes alltid.
 */
export function deriveMaintenance(incidents, now) {
  const t = now.getTime();
  return incidents.map(i => {
    if (i.type !== "vedlikehold" || i.status === "fullfort") return i;
    if (t >= Date.parse(i.scheduledEnd)) return { ...i, status: "fullfort", resolved: i.resolved || i.scheduledEnd };
    if (t >= Date.parse(i.scheduledStart)) return { ...i, status: "pagaende" };
    return i;
  });
}

/** Hendelser som publiseres: alle som ikke er avsluttet, og avsluttede de siste 90 dagene. */
export function published(incidents, now) {
  const limit = now.getTime() - ARCHIVE_DAYS * 864e5;
  return incidents.filter(i => {
    if (i.status !== CLOSED[i.type]) return true;
    return endTime(i) >= limit;
  });
}

/** Leverandørkildene som brukes i status.json. */
export function feedsIn(status, incidents = []) {
  const comps = (status?.groups || []).flatMap(g => g.components);
  return [...new Set([
    ...comps.map(c => c.vendor?.feed),
    ...comps.map(c => c.observedStatus?.clearWhen),
    status?.messageClearWhen,
    ...incidents.map(i => i.autoResolve),
  ].filter(Boolean))];
}

/**
 * Avslutter automatisk når leverandøren melder normal drift (B24), slik at statussiden
 * ikke trenger manuell opprydding:
 * - NITDs merknad med «clearWhen» regnes som normal.
 * - Meldingen øverst med «messageClearWhen» skjules.
 * - Hendelser med «autoResolve» vises som løst.
 * «Ukjent» (kilden svarte ikke) avslutter ingenting.
 */
export function applyVendorClears(status, incidents, vendors) {
  const ok = feed => feed && vendors[feed]?.state === "operational";
  for (const g of status.groups) for (const comp of g.components) {
    const o = comp.observedStatus;
    if (o && ok(o.clearWhen)) comp.observedStatus = { ...o, state: "operational", note: "" };
  }
  if (ok(status.messageClearWhen)) status.message = "";
  return incidents.map(i => (i.type === "hendelse" && i.status !== "lost" && ok(i.autoResolve))
    ? { ...i, status: "lost", autoResolved: true, nextUpdate: null }
    : i);
}

/** Når en avsluttet hendelse sluttet. Automatisk løste hendelser bruker siste oppdatering. */
export function endTime(i) {
  if (i.resolved) return Date.parse(i.resolved);
  if (i.scheduledEnd) return Date.parse(i.scheduledEnd);
  return Math.max(...i.updates.map(u => Date.parse(u.time)));
}

/**
 * Bygger siden. `vendors` er hentet leverandørstatus ({ feed: { state, fetched } }).
 * Uten `vendors` regnes alle kilder som utilgjengelige («Ukjent»).
 */
export function build({ dataDir = DATA, outDir = DIST, now = new Date(), write = true, log = console, vendors = null } = {}) {
  const { status, components, incidents, collector: c } = load({ dataDir, now });
  for (const w of c.warnings) log.warn(`ADVARSEL ${w}`);
  if (c.errors.length) {
    for (const e of c.errors) log.error(`FEIL ${e}`);
    log.error(`\n${c.errors.length} feil i data. Ingenting er bygget.`);
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  // Hentet leverandørstatus legges på komponentene (bare i minnet, aldri i data/).
  const v = vendors || offlineVendors(feedsIn(status, incidents), now);
  for (const g of status.groups) for (const comp of g.components) {
    if (comp.vendor?.feed) comp.vendorStatus = v[comp.vendor.feed] || { state: "unknown", fetched: now.toISOString() };
  }
  const visible = published(applyVendorClears(status, deriveMaintenance(incidents, now), v), now);
  const vendorStates = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.state]));
  const version = createHash("sha256")
    .update(JSON.stringify(status, (k, val) => (k === "fetched" ? undefined : val)))
    .update(JSON.stringify(visible)).update(JSON.stringify(vendorStates)).digest("hex").slice(0, 16);
  const assets = hashedAssets();
  for (const [k, a] of Object.entries(assets)) ASSETS[k] = "/" + a.dest;
  const pages = new Map();
  // Når leverandørstatus sist ble kontrollert (dette bygget). Uten henting (tester/offline) vises ikke tidspunktet.
  const checked = vendors ? now.toISOString() : null;
  pages.set("index.html", renderIndex({ status, incidents: visible, components, now, version, checked }));
  pages.set("arkiv.html", renderArchive({ incidents: visible, components, status, version, checked }));
  pages.set("404.html", render404({ status, version, checked }));
  for (const inc of visible) pages.set(`hendelser/${inc.id}.html`, renderIncident({ inc, components, status, version, checked }));
  pages.set("feed.xml", renderFeed({ incidents: visible, components, status }));
  pages.set("versjon.json", JSON.stringify({ version, updated: status.updated }) + "\n");
  pages.set("status.json", renderStatusJson({ status, incidents: visible, overallState: overall(status), now, checked }));
  pages.set("status.csv", renderStatusCsv({ status }));

  if (write) {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    cpSync(join(ROOT, "src"), outDir, { recursive: true });
    for (const a of Object.values(assets)) renameSync(join(outDir, a.src), join(outDir, a.dest));
    for (const [file, content] of pages) {
      mkdirSync(dirname(join(outDir, file)), { recursive: true });
      writeFileSync(join(outDir, file), content);
    }
    log.log(`Bygget ${pages.size} filer til ${outDir} (${visible.length} hendelser publisert, versjon ${version}).`);
  }
  return { ok: true, errors: [], warnings: c.warnings, pages, version };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const now = process.env.BUILD_TIME ? new Date(process.env.BUILD_TIME) : new Date();
  const write = !process.argv.includes("--check");
  // --offline (eller STATUS_OFFLINE=1): ingen nettkall, leverandørstatus blir «Ukjent». Brukes i tester og CI.
  const offline = !write || process.argv.includes("--offline") || process.env.STATUS_OFFLINE === "1";
  const pre = load({ now });
  const vendors = offline || pre.collector.errors.length ? null : await fetchVendors(feedsIn(pre.status, pre.incidents), now);
  const r = build({ now, write, vendors });
  if (!r.ok) process.exit(1);
  if (!write) console.log("Data er gyldige.");
}
