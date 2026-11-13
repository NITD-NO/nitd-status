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

/** Hendelser som publiseres: alle som ikke er avsluttet, og avsluttede de siste 90 dagene. */
export function published(incidents, now) {
  const limit = now.getTime() - ARCHIVE_DAYS * 864e5;
  return incidents.filter(i => {
    if (i.status !== CLOSED[i.type]) return true;
    const end = i.resolved || i.scheduledEnd;
    return Date.parse(end) >= limit;
  });
}

export function build({ dataDir = DATA, outDir = DIST, now = new Date(), write = true, log = console } = {}) {
  const { status, components, incidents, collector: c } = load({ dataDir, now });
  for (const w of c.warnings) log.warn(`ADVARSEL ${w}`);
  if (c.errors.length) {
    for (const e of c.errors) log.error(`FEIL ${e}`);
    log.error(`\n${c.errors.length} feil i data. Ingenting er bygget.`);
    return { ok: false, errors: c.errors, warnings: c.warnings };
  }
  const visible = published(incidents, now);
  const version = createHash("sha256")
    .update(JSON.stringify(status)).update(JSON.stringify(visible)).digest("hex").slice(0, 16);
  const pages = new Map();
  pages.set("index.html", renderIndex({ status, incidents: visible, components, now, version }));
  pages.set("arkiv.html", renderArchive({ incidents: visible, components, status, version }));
  pages.set("404.html", render404({ status, version }));
  for (const inc of visible) pages.set(`hendelser/${inc.id}.html`, renderIncident({ inc, components, status, version }));
  pages.set("feed.xml", renderFeed({ incidents: visible, components, status }));
  pages.set("versjon.json", JSON.stringify({ version, updated: status.updated }) + "\n");

  if (write) {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    cpSync(join(ROOT, "src"), outDir, { recursive: true });
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
  const r = build({ now, write });
  if (!r.ok) process.exit(1);
  if (!write) console.log("Data er gyldige.");
}
