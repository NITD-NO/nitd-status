// Tester for datamodell, validering og bygg. Kjør: node --test scripts/test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { effective, worst, newCollector, validateIncident, validateStatus } from "./lib/model.mjs";
import { esc, fmt } from "./lib/render.mjs";
import { build } from "./build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const quiet = { log() {}, warn() {}, error() {} };

const T = "2026-11-10T10:00:00+01:00";
function baseStatus(over = {}) {
  return {
    updated: T,
    message: "",
    groups: [
      { id: "egne", name: "Norsk IT Drift", components: [
        { id: "helpdesk", name: "Helpdesk og telefon",
          observedStatus: { state: "operational", note: "", updated: T } },
      ] },
      { id: "leverandorer", name: "Leverandører", components: [
        { id: "microsoft-365", name: "Microsoft 365",
          vendor: { name: "Microsoft", statusUrl: "https://status.cloud.microsoft/", feed: "microsoft" },
          observedStatus: { state: "operational", note: "", updated: T } },
      ] },
    ],
    ...over,
  };
}
function incident(over = {}) {
  return {
    type: "hendelse", title: "Test", status: "lost", components: ["microsoft-365"],
    started: "2026-11-01T10:00:00+01:00", detected: "2026-11-01T10:05:00+01:00", resolved: "2026-11-01T12:00:00+01:00",
    impact: "E-post er forsinket.", advice: "Ring oss.",
    updates: [{ time: "2026-11-01T10:00:00+01:00", source: "nitd", text: "Vi undersøker." }],
    ...over,
  };
}
function dataDir(status, incidents = {}) {
  const d = mkdtempSync(join(tmpdir(), "status-"));
  mkdirSync(join(d, "hendelser"));
  writeFileSync(join(d, "status.json"), JSON.stringify(status));
  for (const [name, inc] of Object.entries(incidents)) writeFileSync(join(d, "hendelser", name), JSON.stringify(inc));
  return d;
}
function runBuild(status, incidents, now = new Date("2026-11-13T12:00:00Z"), vendors = null) {
  const outDir = mkdtempSync(join(tmpdir(), "dist-"));
  return { ...build({ dataDir: dataDir(status, incidents), outDir, now, log: quiet, vendors }), outDir };
}

test("worst og effective: den dårligste vises, med riktig kilde", () => {
  assert.equal(worst("operational", "degraded"), "degraded");
  assert.equal(worst(null, "outage"), "outage");
  const c = (v, o) => ({ vendorStatus: v && { state: v }, observedStatus: o && { state: o } });
  assert.deepEqual(effective(c("operational", "operational")), { state: "operational", source: null });
  assert.deepEqual(effective(c("degraded", "operational")), { state: "degraded", source: "leverandor" });
  assert.deepEqual(effective(c("operational", "outage")), { state: "outage", source: "nitd" });
  assert.deepEqual(effective(c("recovering", "degraded")), { state: "degraded", source: "nitd" });
  assert.equal(effective(c("degraded", "degraded")).source, "leverandor");
  assert.deepEqual(effective(c(null, "recovering")), { state: "recovering", source: "nitd" });
  // Kilden svarte ikke: vis «Ukjent», men la NITDs egen vurdering gå foran.
  assert.deepEqual(effective(c("unknown", "operational")), { state: "unknown", source: null });
  assert.deepEqual(effective(c("unknown", "degraded")), { state: "degraded", source: "nitd" });
});

test("norsk tid: UTC fra Microsoft vises i Europe/Oslo, også over sommertid", () => {
  assert.equal(fmt("2026-11-13T08:30:00Z"), "13. nov. 2026 kl. 09:30");
  assert.equal(fmt("2026-07-01T08:30:00Z"), "1. juli 2026 kl. 10:30");
});

test("escaping av tekst", () => {
  assert.equal(esc(`<script>"&'`), "&lt;script&gt;&quot;&amp;&#39;");
});

test("gjeldende data i repoet er gyldige og bygger", () => {
  const r = build({ write: false, log: quiet, now: new Date("2026-11-13T08:00:00Z") });
  assert.equal(r.ok, true, r.errors.join("\n"));
});

test("validering: ugyldig tilstand, tid uten sone, ukjent komponent og http-lenke stopper bygget", () => {
  const s = baseStatus();
  s.groups[0].components[0].observedStatus.state = "rød";
  s.groups[0].components[0].observedStatus.updated = "2026-11-10T10:00:00";
  s.groups[1].components[0].vendor.statusUrl = "http://status.cloud.microsoft/";
  const r = runBuild(s, { "2026-11-01-test.json": incident({ components: ["finnes-ikke"] }) });
  assert.equal(r.ok, false);
  const all = r.errors.join("\n");
  assert.match(all, /observedStatus.state/);
  assert.match(all, /tidssone/);
  assert.match(all, /https:\/\//);
  assert.match(all, /ukjent komponent «finnes-ikke»/);
});

test("validering: filnavn og startdato må stemme (norsk tid)", () => {
  const c = newCollector();
  const comps = validateStatus(baseStatus(), c, []);
  validateIncident("2026-11-02-test", incident(), comps, c, []);
  assert.match(c.errors.join("\n"), /stemmer ikke med start/);
  const c2 = newCollector();
  // 23:30 UTC 31. okt. er 1. nov. i norsk tid
  validateIncident("2026-11-01-test", incident({ started: "2026-10-31T23:30:00Z", detected: "2026-10-31T23:35:00Z" }), comps, c2, []);
  assert.deepEqual(c2.errors, []);
  const c3 = newCollector();
  validateIncident("Hendelse 1", incident(), comps, c3, []);
  assert.match(c3.errors.join("\n"), /filnavnet/);
});

test("validering: personopplysninger, HTML og forbudte ord stopper bygget", () => {
  const comps = validateStatus(baseStatus(), newCollector(), []);
  const check = text => {
    const c = newCollector();
    validateIncident("2026-11-01-test", incident({ impact: text }), comps, c, ["hemmeligverktøy"]);
    return c.errors.join("\n");
  };
  assert.match(check("Kontakt ola.nordmann@kunde.no"), /e-postadresse/);
  assert.match(check("Ring 912 34 567"), /telefonnummer/);
  assert.match(check("Ring +47 41234567"), /telefonnummer/);
  assert.match(check("Se <a href=x>her</a>"), /HTML/);
  assert.match(check("Varsel fra Hemmeligverktøy."), /forbudt ord/);
  assert.equal(check("Ring 69 81 10 00 eller skriv til helpdesk@nitd.no. Ref. MO1550821 kl. 09:30."), "");
});

test("validering: hemmeligheter, IP-adresser, interne verter og ukjente domener stopper bygget", () => {
  const comps = validateStatus(baseStatus(), newCollector(), []);
  const check = (text, over = {}) => {
    const c = newCollector();
    validateIncident("2026-11-01-test", incident({ impact: text, ...over }), comps, c, []);
    return c.errors.join("\n");
  };
  assert.match(check("Token ghp_" + "a".repeat(36)), /GitHub-token/);
  assert.match(check("passord: Sommer2026"), /passord eller nøkkel/);
  assert.match(check("-----BEGIN OPENSSH PRIVATE KEY-----"), /nøkkel eller sertifikat/);
  assert.match(check("Nøkkel " + "Ab3".repeat(15)), /lang tilfeldig streng/);
  assert.match(check("Serveren 10.0.0.12 svarer ikke"), /IP-adresse/);
  assert.match(check("Feil på dc01.nitd.local"), /internt vertsnavn/);
  assert.match(check("Se halo.example.com for detaljer"), /nevner domenet halo\.example\.com/);
  assert.match(check("Ok tekst.", { vendorRefs: [{ vendor: "X", ref: "X1", url: "https://intern.example.com/" }] }), /ikke er et godkjent domene/);
  assert.match(check("Ok tekst.", { vendorRefs: [{ vendor: "X", ref: "X1", url: "https://bruker:pw@status.uniweb.no/" }] }), /brukernavn eller passord/);
  // Vanlig tekst skal gå gjennom.
  assert.equal(check("Outlook, f.eks. på mobil, er berørt kl. 09.30. Se kundeportal.nitd.no og status.cloud.microsoft. Ref. MO1550821, versjon 2.4.1."), "");
});

test("validering: løst hendelse må ha «resolved», og vedlikehold må ha tidsrom", () => {
  const comps = validateStatus(baseStatus(), newCollector(), []);
  const c = newCollector();
  validateIncident("2026-11-01-test", incident({ resolved: null }), comps, c, []);
  assert.match(c.errors.join("\n"), /«resolved» mangler/);
  const c2 = newCollector();
  validateIncident("2026-11-20-vedlikehold", {
    type: "vedlikehold", title: "Oppgradering", status: "planlagt", components: ["helpdesk"],
    scheduledStart: "2026-11-20T22:00:00+01:00", scheduledEnd: "2026-11-20T21:00:00+01:00",
    impact: "Telefon kan være borte i korte perioder.", updates: [{ time: T, source: "nitd", text: "Planlagt." }],
  }, comps, c2, []);
  assert.match(c2.errors.join("\n"), /scheduledEnd/);
});

test("bygg: arkivet viser bare avsluttede hendelser fra de siste 90 dagene", () => {
  const r = runBuild(baseStatus(), {
    "2026-11-01-ny.json": incident({ title: "Ny hendelse" }),
    "2026-07-01-gammel.json": incident({ title: "Gammel hendelse", started: "2026-07-01T10:00:00+02:00", detected: "2026-07-01T10:00:00+02:00", resolved: "2026-07-01T12:00:00+02:00",
      updates: [{ time: "2026-07-01T10:00:00+02:00", source: "nitd", text: "Gammel." }] }),
  });
  assert.equal(r.ok, true, r.errors.join("\n"));
  const arkiv = readFileSync(join(r.outDir, "arkiv.html"), "utf8");
  assert.match(arkiv, /Ny hendelse/);
  assert.doesNotMatch(arkiv, /Gammel hendelse/);
  assert.ok(existsSync(join(r.outDir, "hendelser", "2026-11-01-ny.html")));
  assert.ok(!existsSync(join(r.outDir, "hendelser", "2026-07-01-gammel.html")));
  assert.doesNotMatch(readFileSync(join(r.outDir, "feed.xml"), "utf8"), /Gammel hendelse/);
});

test("bygg: planlagt vedlikehold vises på forsiden og i feeden", () => {
  const r = runBuild(baseStatus(), {
    "2026-11-20-oppgradering.json": {
      type: "vedlikehold", title: "Oppgradering av telefonsystem", status: "planlagt", components: ["helpdesk"],
      scheduledStart: "2026-11-20T21:00:00Z", scheduledEnd: "2026-11-20T22:00:00Z",
      impact: "Telefon kan være borte i korte perioder.", updates: [{ time: T, source: "nitd", text: "Planlagt." }],
    },
  });
  assert.equal(r.ok, true, r.errors.join("\n"));
  const index = readFileSync(join(r.outDir, "index.html"), "utf8");
  assert.match(index, /Planlagt vedlikehold/);
  assert.match(index, /20\. nov\. 2026 kl\. 22:00/);
  assert.match(readFileSync(join(r.outDir, "feed.xml"), "utf8"), /Vedlikehold \(planlagt\): Oppgradering av telefonsystem/);
});

test("bygg: tekst escapes, og hentet leverandørstatus vises på kortet med lenke", () => {
  const s = baseStatus({ message: "Test & <prøve>" });
  const vendors = { microsoft: { state: "outage", fetched: "2026-11-13T11:55:00Z" } };
  const r = runBuild(s, {}, undefined, vendors);
  // «<» i tekst er ikke tillatt (HTML-sjekk), men & og > skal escapes.
  assert.equal(r.ok, false);
  s.message = "Test & prøve > alt";
  const r2 = runBuild(s, {}, undefined, vendors);
  assert.equal(r2.ok, true, r2.errors.join("\n"));
  const index = readFileSync(join(r2.outDir, "index.html"), "utf8");
  assert.match(index, /Test &amp; prøve &gt; alt/);
  assert.match(index, /Microsoft melder driftsavbrudd\./);
  assert.match(index, /Hentet <time[^>]*>13\. nov\. kl\. 12:55/);
  assert.match(index, /href="https:\/\/status\.cloud\.microsoft\/">Statusside hos Microsoft/);
  assert.match(index, /<span>Driftsavbrudd<\/span>/);
  assert.doesNotMatch(index, /Registrert av NITD|NITD registrerer/);
});

test("bygg: leverandør som ikke svarer gir «Ukjent», ikke feil samlet status", () => {
  const r = runBuild(baseStatus(), {});
  const index = readFileSync(join(r.outDir, "index.html"), "utf8");
  assert.match(index, /pill--unknown">Ukjent/);
  assert.match(index, /Status fra Microsoft er ikke tilgjengelig/);
  assert.match(index, /Alle tjenester fungerer normalt/);
});

test("validering: «vendorStatus» kan ikke settes for hånd, og skjult leverandør har ikke lenke", () => {
  const s = baseStatus();
  s.groups[1].components[0].vendorStatus = { state: "outage" };
  s.groups[0].components[0].vendor = { name: "X", public: false, statusUrl: "https://status.uniweb.no/" };
  const r = runBuild(s, {});
  assert.equal(r.ok, false);
  assert.match(r.errors.join("\n"), /settes ikke for hånd/);
  assert.match(r.errors.join("\n"), /skal ikke settes når «vendor.public» er false/);
});

test("eksport: status.json og status.csv har gjeldende status, og CSV er trygg i Excel", () => {
  const s = baseStatus();
  s.groups[0].components[0].observedStatus = { state: "degraded", note: "-Telefonen er treg", updated: T };
  const r = runBuild(s, {}, undefined, { microsoft: { state: "operational", fetched: "2026-11-13T11:55:00Z" } });
  const json = JSON.parse(readFileSync(join(r.outDir, "status.json"), "utf8"));
  assert.equal(json.overall.state, "degraded");
  const hd = json.components.find(c => c.id === "helpdesk");
  assert.equal(hd.label, "Redusert");
  assert.equal(hd.source, "Norsk IT Drift");
  assert.equal(json.components.find(c => c.id === "microsoft-365").vendorStatusUrl, "https://status.cloud.microsoft/");
  const csv = readFileSync(join(r.outDir, "status.csv"), "utf8");
  assert.ok(csv.startsWith("\uFEFFGruppe;Tjeneste;Status"));
  assert.match(csv, /Helpdesk og telefon;Redusert;Norsk IT Drift;'-Telefonen er treg/);
});

// Kontroll av ferdig bygg (dist/): CSP-vennlig HTML og påkrevde headere.
function files(dir) {
  return readdirSync(dir).flatMap(n => statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]);
}

test("dist: ingen inline skript, inline stil, hendelsesattributter eller eksterne ressurser", () => {
  const r = build({ log: quiet, now: new Date("2026-11-13T08:00:00Z") });
  assert.equal(r.ok, true);
  const html = files(join(ROOT, "dist")).filter(f => f.endsWith(".html"));
  assert.ok(html.length >= 3);
  for (const f of html) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /<script(?![^>]*\ssrc=)[^>]*>/, `${f}: inline skript`);
    assert.doesNotMatch(s, /\sstyle=|<style/, `${f}: inline stil`);
    assert.doesNotMatch(s, /\son[a-z]+=/, `${f}: hendelsesattributt`);
    assert.doesNotMatch(s, /<(script|img)[^>]+src="(https?:)?\/\/|<link[^>]+rel="(stylesheet|preload|icon|modulepreload)"[^>]+href="(https?:)?\/\//, `${f}: ekstern ressurs`);
    assert.match(s, /<html lang="nb"/);
    assert.match(s, /norskitdrift\.no\/personvern/, `${f}: mangler personvernlenke (WEB-07)`);
  }
  for (const dir of ["data", "docs", "scripts", "config"]) assert.ok(!existsSync(join(ROOT, "dist", dir)), `dist/${dir} skal ikke publiseres`);
});

test("_headers: sikkerhetsheadere er satt, og CSP er streng", () => {
  const h = readFileSync(join(ROOT, "src", "_headers"), "utf8");
  for (const name of ["Strict-Transport-Security: max-age=31536000", "X-Content-Type-Options: nosniff",
    "Referrer-Policy: strict-origin-when-cross-origin", "Permissions-Policy:", "X-Frame-Options: DENY",
    "Cross-Origin-Opener-Policy: same-origin"]) assert.ok(h.includes(name), `mangler ${name}`);
  const csp = h.match(/Content-Security-Policy: (.+)/)[1];
  assert.doesNotMatch(csp, /unsafe-|https?:|\*/);
  for (const d of ["default-src 'none'", "script-src 'self'", "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.includes(d), `CSP mangler ${d}`);
  }
});

test("ingen Pages Functions (ingen åpne endepunkter)", () => {
  assert.ok(!existsSync(join(ROOT, "functions")));
  assert.ok(!existsSync(join(ROOT, "src", "functions")));
  assert.ok(!existsSync(join(ROOT, "src", "_worker.js")));
});

test("vedlikehold skifter status ut fra klokka", () => {
  const vedl = {
    type: "vedlikehold", title: "Oppgradering", status: "planlagt", components: ["helpdesk"],
    scheduledStart: "2026-11-20T21:00:00Z", scheduledEnd: "2026-11-20T22:00:00Z",
    impact: "Telefon kan være borte i korte perioder.", updates: [{ time: T, source: "nitd", text: "Planlagt." }],
  };
  const at = iso => runBuild(baseStatus(), { "2026-11-20-oppgradering.json": vedl }, new Date(iso));
  const page = r => readFileSync(join(r.outDir, "hendelser", "2026-11-20-oppgradering.html"), "utf8");
  assert.match(page(at("2026-11-20T20:00:00Z")), /Vedlikehold · Planlagt/);
  assert.match(page(at("2026-11-20T21:30:00Z")), /Vedlikehold · Pågår/);
  const after = at("2026-11-21T08:00:00Z");
  assert.match(page(after), /Vedlikehold · Fullført/);
  assert.match(readFileSync(join(after.outDir, "arkiv.html"), "utf8"), /Oppgradering/);
  assert.doesNotMatch(readFileSync(join(after.outDir, "index.html"), "utf8"), /Planlagt vedlikehold/);
});

test("hendelsesstatus følger NSM/ISO-fasene, og «detected» er påkrevd", () => {
  const comps = validateStatus(baseStatus(), newCollector(), []);
  for (const status of ["undersokes", "handteres", "overvakes"]) {
    const c = newCollector();
    validateIncident("2026-11-01-test", incident({ status, resolved: null }), comps, c, []);
    assert.deepEqual(c.errors, [], status);
  }
  const c = newCollector();
  validateIncident("2026-11-01-test", incident({ status: "pagaende", resolved: null }), comps, c, []);
  assert.match(c.errors.join("\n"), /«status» må være en av undersokes, handteres, overvakes, lost/);
  const c2 = newCollector();
  validateIncident("2026-11-01-test", incident({ detected: undefined }), comps, c2, []);
  assert.match(c2.errors.join("\n"), /«detected» mangler/);
  const r = runBuild(baseStatus(), { "2026-11-01-test.json": incident({ status: "undersokes", resolved: null }) });
  const page = readFileSync(join(r.outDir, "hendelser", "2026-11-01-test.html"), "utf8");
  assert.match(page, /Hendelse · Undersøkes/);
  // «detected» lagres for sporbarhet (NIS2, ISO 27001 A.5.28), men vises ikke på siden.
  assert.match(page, /Startet <time[^>]*>1\. nov\. 2026 kl\. 10:00/);
});
