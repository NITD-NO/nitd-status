// Datamodell og validering for statussiden. Ingen avhengigheter utover Node.
// Se docs/plan.md, avsnitt 4.

export const STATES = ["operational", "recovering", "degraded", "outage"];
export const STATE_LABEL = {
  operational: "Normal",
  recovering: "Bedring",
  degraded: "Redusert",
  outage: "Nede",
};
export const RANK = Object.fromEntries(STATES.map((s, i) => [s, i]));

export const INCIDENT_STATUS = {
  hendelse: { pagaende: "Pågår", overvakes: "Overvåkes", lost: "Løst" },
  vedlikehold: { planlagt: "Planlagt", pagaende: "Pågår", fullfort: "Fullført" },
};
export const CLOSED = { hendelse: "lost", vedlikehold: "fullfort" };
export const SOURCE_LABEL = { nitd: "NITD", leverandor: "Leverandør" };

// Telefon og e-post som kan stå i publisert tekst. Alt annet stopper bygget.
const ALLOWED_PHONES = new Set(["69811000"]);
const ALLOWED_EMAILS = new Set(["helpdesk@nitd.no"]);

// Domener som kan lenkes til eller nevnes i publisert tekst: NITD og godkjente leverandørkilder
// (docs/plan.md avsnitt 5). Alt annet stopper bygget, så interne adresser ikke kan lekke ut.
export const ALLOWED_DOMAINS = [
  "norskitdrift.no", "nitd.no",
  "status.cloud.microsoft", "status.uniweb.no", "nebulastatus.zyxel.com", "status.sophos.com",
];
function allowedHost(host) {
  host = host.toLowerCase().replace(/\.$/, "");
  return ALLOWED_DOMAINS.some(d => host === d || host.endsWith("." + d));
}

// Mønstre for hemmeligheter og interne opplysninger. Treff stopper bygget.
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----/, "nøkkel eller sertifikat"],
  [/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/, "GitHub-token"],
  [/\b(AKIA|ASIA)[A-Z0-9]{16}\b/, "AWS-nøkkel"],
  [/\bxox[abpors]-[A-Za-z0-9-]{10,}/, "Slack-token"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API-nøkkel"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, "JWT/token"],
  [/\b(passord|password|pwd|secret|hemmelighet|api[_ -]?key|token)\s*[:=]/i, "passord eller nøkkel"],
  [/\b[A-Fa-f0-9]{32,}\b/, "lang heksadesimal streng (mulig nøkkel eller hash)"],
  [/\b[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9+/_-])/, "lang tilfeldig streng (mulig nøkkel)"],
];
const IPV4 = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.])/;
const IPV6 = /(?<![\w:])(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}(?![\w:])/i;
const INTERNAL_HOST = /\b[\w-]+(\.[\w-]+)*\.(local|lan|internal|intern|corp|home|localdomain)\b/i;
// Hvert ledd må ha minst to tegn, så forkortelser som «f.eks.» ikke tolkes som domener.
const DOMAIN_IN_TEXT = /\b(?:https?:\/\/)?((?:[a-z0-9][a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]\S*)?/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(-[a-z0-9]+)*$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Den dårligste av to tilstander (null teller som normal). */
export function worst(a, b) {
  const ra = a ? RANK[a] : 0;
  const rb = b ? RANK[b] : 0;
  return STATES[Math.max(ra, rb)];
}

/** Tilstand som vises for en komponent, og hvor opplysningen kommer fra. */
export function effective(component) {
  const v = component.vendorStatus?.state || "operational";
  const o = component.observedStatus?.state || "operational";
  const state = worst(v, o);
  let source = null;
  if (state !== "operational") {
    if (RANK[v] === RANK[o]) source = "Meldt av leverandør og registrert av NITD";
    else if (RANK[v] > RANK[o]) source = "Meldt av leverandør";
    else source = "Registrert av NITD";
  }
  return { state, source };
}

/** Dato (ÅÅÅÅ-MM-DD) i norsk tid. */
export function osloDate(iso) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
  return p; // en-CA gir ÅÅÅÅ-MM-DD
}

class Collector {
  constructor() { this.errors = []; this.warnings = []; }
  error(where, msg) { this.errors.push(`${where}: ${msg}`); }
  warn(where, msg) { this.warnings.push(`${where}: ${msg}`); }
}

function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }

function checkTime(c, where, field, value, required) {
  if (value == null) {
    if (required) c.error(where, `«${field}» mangler`);
    return;
  }
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value) || isNaN(Date.parse(value))) {
    c.error(where, `«${field}» må være ISO 8601 med tidssone (f.eks. 2026-11-12T19:26:00+01:00), fikk ${JSON.stringify(value)}`);
  }
}

function checkUrl(c, where, field, value, required) {
  if (value == null || value === "") {
    if (required) c.error(where, `«${field}» mangler`);
    return;
  }
  let u;
  try { u = new URL(value); } catch { c.error(where, `«${field}» er ikke en gyldig URL`); return; }
  if (u.protocol !== "https:") c.error(where, `«${field}» må være https://`);
  if (u.username || u.password) c.error(where, `«${field}» inneholder brukernavn eller passord`);
  if (!allowedHost(u.hostname)) c.error(where, `«${field}» peker til ${u.hostname}, som ikke er et godkjent domene (se ALLOWED_DOMAINS)`);
}

function checkText(c, where, field, value, { required = false, forbidden = [] } = {}) {
  if (value == null || value === "") {
    if (required) c.error(where, `«${field}» mangler`);
    return;
  }
  if (typeof value !== "string") { c.error(where, `«${field}» må være tekst`); return; }
  if (/<[a-z/!]/i.test(value)) c.error(where, `«${field}» inneholder HTML. Bruk ren tekst.`);
  for (const m of value.matchAll(EMAIL)) {
    if (!ALLOWED_EMAILS.has(m[0].toLowerCase())) c.error(where, `«${field}» inneholder en e-postadresse som ikke er NITDs (personvern)`);
  }
  for (const m of value.matchAll(/(?<![\w+])(?:\+47 ?)?(?:\d ?){7}\d(?![\w])/g)) {
    const digits = m[0].replace(/\D/g, "").replace(/^47(?=\d{8}$)/, "");
    if (!ALLOWED_PHONES.has(digits)) c.error(where, `«${field}» inneholder et telefonnummer som ikke er NITDs (personvern)`);
  }
  for (const [re, what] of SECRET_PATTERNS) {
    if (re.test(value)) c.error(where, `«${field}» ser ut til å inneholde ${what}. Hemmeligheter skal aldri i data/.`);
  }
  if (IPV4.test(value) || IPV6.test(value)) c.error(where, `«${field}» inneholder en IP-adresse`);
  if (INTERNAL_HOST.test(value)) c.error(where, `«${field}» inneholder et internt vertsnavn`);
  for (const m of value.replace(EMAIL, " ").matchAll(DOMAIN_IN_TEXT)) {
    const host = m[1];
    if (/^\d/.test(host)) continue;
    if (!allowedHost(host)) c.error(where, `«${field}» nevner domenet ${host}, som ikke er godkjent (se ALLOWED_DOMAINS)`);
  }
  const lower = value.toLowerCase();
  for (const word of forbidden) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu");
    if (re.test(lower)) c.error(where, `«${field}» inneholder et forbudt ord (se config/forbudte-ord.txt)`);
  }
}

function checkStatusField(c, where, field, s, forbidden, { vendor = false } = {}) {
  if (s == null) return;
  if (!isObj(s)) { c.error(where, `«${field}» må være et objekt eller null`); return; }
  if (!STATES.includes(s.state)) c.error(where, `«${field}.state» må være en av ${STATES.join(", ")}`);
  checkText(c, where, `${field}.note`, s.note, { forbidden });
  checkTime(c, where, `${field}.updated`, s.updated, true);
  if (vendor) {
    checkUrl(c, where, `${field}.url`, s.url, true);
    if (s.refs != null && (!Array.isArray(s.refs) || s.refs.some(r => typeof r !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(r)))) {
      c.error(where, `«${field}.refs» må være en liste med leverandørens referanser`);
    }
  }
}

/** Validerer status.json. Returnerer kart over komponent-ID → komponent. */
export function validateStatus(status, c, forbidden) {
  const where = "data/status.json";
  const components = new Map();
  if (!isObj(status)) { c.error(where, "må være et objekt"); return components; }
  checkTime(c, where, "updated", status.updated, true);
  checkText(c, where, "message", status.message, { forbidden });
  if (!Array.isArray(status.groups) || status.groups.length === 0) {
    c.error(where, "«groups» må være en liste med minst én gruppe");
    return components;
  }
  const groupIds = new Set();
  for (const g of status.groups) {
    const gw = `${where} › ${g?.id ?? "?"}`;
    if (!ID.test(g?.id || "")) c.error(gw, "gruppen mangler gyldig «id»");
    if (groupIds.has(g.id)) c.error(gw, "duplikat gruppe-ID");
    groupIds.add(g.id);
    checkText(c, gw, "name", g.name, { required: true, forbidden });
    if (!Array.isArray(g.components) || g.components.length === 0) { c.error(gw, "«components» mangler"); continue; }
    for (const comp of g.components) {
      const cw = `${gw} › ${comp?.id ?? "?"}`;
      if (!ID.test(comp?.id || "")) { c.error(cw, "komponenten mangler gyldig «id»"); continue; }
      if (components.has(comp.id)) c.error(cw, "duplikat komponent-ID");
      components.set(comp.id, comp);
      checkText(c, cw, "name", comp.name, { required: true, forbidden });
      checkText(c, cw, "description", comp.description, { forbidden });
      if (comp.vendor != null) {
        checkText(c, cw, "vendor.name", comp.vendor.name, { required: true, forbidden });
        checkUrl(c, cw, "vendor.statusUrl", comp.vendor.statusUrl, false);
      }
      if (!("vendorStatus" in comp) || !("observedStatus" in comp)) {
        c.error(cw, "både «vendorStatus» og «observedStatus» må finnes (bruk null når det ikke finnes en kilde)");
      }
      if (comp.vendorStatus != null && comp.vendor == null) c.error(cw, "«vendorStatus» krever «vendor»");
      checkStatusField(c, cw, "vendorStatus", comp.vendorStatus, forbidden, { vendor: true });
      checkStatusField(c, cw, "observedStatus", comp.observedStatus, forbidden);
    }
  }
  return components;
}

/** Validerer én hendelsesfil. `id` er filnavnet uten .json. */
export function validateIncident(id, inc, components, c, forbidden) {
  const where = `data/hendelser/${id}.json`;
  const m = FILE_NAME.exec(id);
  if (!m) c.error(where, "filnavnet må være ÅÅÅÅ-MM-DD-kort-navn.json (små bokstaver, tall og bindestrek)");
  if (!isObj(inc)) { c.error(where, "må være et objekt"); return; }
  const statuses = INCIDENT_STATUS[inc.type];
  if (!statuses) { c.error(where, "«type» må være «hendelse» eller «vedlikehold»"); return; }
  if (!(inc.status in statuses)) c.error(where, `«status» må være en av ${Object.keys(statuses).join(", ")}`);
  checkText(c, where, "title", inc.title, { required: true, forbidden });
  checkText(c, where, "impact", inc.impact, { required: true, forbidden });
  checkText(c, where, "advice", inc.advice, { forbidden });

  if (!Array.isArray(inc.components) || inc.components.length === 0) c.error(where, "«components» må ha minst én komponent");
  else for (const cid of inc.components) if (!components.has(cid)) c.error(where, `ukjent komponent «${cid}» (finnes ikke i status.json)`);

  const closed = inc.status === CLOSED[inc.type];
  if (inc.type === "hendelse") {
    checkTime(c, where, "started", inc.started, true);
    checkTime(c, where, "resolved", inc.resolved, closed);
  } else {
    checkTime(c, where, "scheduledStart", inc.scheduledStart, true);
    checkTime(c, where, "scheduledEnd", inc.scheduledEnd, true);
    checkTime(c, where, "started", inc.started, false);
    checkTime(c, where, "resolved", inc.resolved, false);
    if (inc.scheduledStart && inc.scheduledEnd && Date.parse(inc.scheduledEnd) <= Date.parse(inc.scheduledStart)) {
      c.error(where, "«scheduledEnd» må være etter «scheduledStart»");
    }
  }
  if (!closed && inc.resolved) c.error(where, "«resolved» er satt, men status er ikke avsluttet");
  if (inc.started && inc.resolved && Date.parse(inc.resolved) < Date.parse(inc.started)) c.error(where, "«resolved» er før «started»");
  checkTime(c, where, "nextUpdate", inc.nextUpdate, false);

  const start = inc.type === "hendelse" ? inc.started : inc.scheduledStart;
  if (m && start && ISO_WITH_ZONE.test(start) && osloDate(start) !== m[1]) {
    c.error(where, `datoen i filnavnet (${m[1]}) stemmer ikke med start (${osloDate(start)}, norsk tid)`);
  }

  if (inc.vendorRefs != null) {
    if (!Array.isArray(inc.vendorRefs)) c.error(where, "«vendorRefs» må være en liste");
    else inc.vendorRefs.forEach((r, i) => {
      checkText(c, where, `vendorRefs[${i}].vendor`, r?.vendor, { required: true, forbidden });
      if (typeof r?.ref !== "string" || !/^[A-Za-z0-9._-]{1,40}$/.test(r.ref)) c.error(where, `«vendorRefs[${i}].ref» er ugyldig`);
      checkUrl(c, where, `vendorRefs[${i}].url`, r?.url, false);
    });
  }

  if (!Array.isArray(inc.updates) || inc.updates.length === 0) c.error(where, "«updates» må ha minst én oppdatering");
  else inc.updates.forEach((u, i) => {
    checkTime(c, where, `updates[${i}].time`, u?.time, true);
    if (!(u?.source in SOURCE_LABEL)) c.error(where, `«updates[${i}].source» må være «nitd» eller «leverandor»`);
    checkText(c, where, `updates[${i}].text`, u?.text, { required: true, forbidden });
  });
}

/** Advarsler som ikke stopper bygget. */
export function consistencyWarnings(status, incidents, now, c) {
  const active = incidents.filter(i => i.type === "hendelse" && i.status !== "lost");
  for (const g of status.groups || []) for (const comp of g.components || []) {
    const { state } = effective(comp);
    if (state !== "operational" && !active.some(i => i.components?.includes(comp.id))) {
      c.warn(`data/status.json › ${comp.id}`, `tilstand «${STATE_LABEL[state]}» uten en pågående hendelse som peker på komponenten`);
    }
  }
  for (const i of incidents) {
    if (i.status !== CLOSED[i.type] && i.nextUpdate && Date.parse(i.nextUpdate) < now.getTime()) {
      c.warn(`data/hendelser/${i.id}.json`, "«nextUpdate» er passert. Oppdater hendelsen.");
    }
  }
}

export function newCollector() { return new Collector(); }
