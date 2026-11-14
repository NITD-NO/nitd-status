// Henter leverandørstatus fra offisielle, offentlige kilder når siden bygges (B10, B20).
// Bare tilstanden brukes. Leverandørens egen tekst publiseres ikke.
// Svarer ikke kilden, blir tilstanden «unknown», og siden viser «Ukjent» med lenke.

const TIMEOUT_MS = 30000;

async function getJson(url) {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "nitd-status/1.0 (+https://status.norskitdrift.no)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const RANK = { operational: 0, recovering: 1, degraded: 2, outage: 3 };
const worstOf = states => states.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "operational");

// Microsoft 365: status.cloud.microsoft/api/posts/mac. Ingen aktiv post = normal drift.
const MICROSOFT = {
  "service degradation": "degraded",
  "investigating": "degraded",
  "investigation suspended": "degraded",
  "service interruption": "outage",
  "restoring service": "recovering",
  "service recovery": "recovering",
  "extended recovery": "recovering",
  "available": "operational", // Microsofts normaltilstand når ingen hendelse er aktiv
  "service restored": "operational",
  "post-incident report published": "operational",
  "false positive": "operational",
  "resolved": "operational",
};
export function mapMicrosoft(data) {
  const posts = Array.isArray(data) ? data : data && typeof data === "object" && Object.keys(data).length ? [data] : [];
  if (posts.length === 0) return "operational";
  const states = posts.map(p => MICROSOFT[String(p?.Status || "").toLowerCase()]);
  if (states.some(s => !s)) return "unknown"; // ukjent statusverdi: ikke gjett
  return worstOf(states);
}

// Atlassian Statuspage (Uniweb, Zyxel Nebula): /api/v2/summary.json
const STATUSPAGE = {
  operational: "operational",
  degraded_performance: "degraded",
  partial_outage: "degraded",
  under_maintenance: "degraded",
  major_outage: "outage",
};
/** Dårligste tilstand blant komponentene i gruppene og komponentene som er nevnt ved navn. */
export function mapStatuspage(data, names = null) {
  const comps = data?.components;
  if (!Array.isArray(comps)) return "unknown";
  let selected = comps.filter(c => !c.group);
  if (names) {
    const groups = comps.filter(c => c.group && names.includes(c.name)).map(c => c.id);
    selected = comps.filter(c => !c.group && (names.includes(c.name) || groups.includes(c.group_id)));
    if (selected.length === 0) return "unknown";
  }
  const states = selected.map(c => STATUSPAGE[c.status]);
  if (states.some(s => !s)) return "unknown";
  return worstOf(states);
}

// status.io (kundeportalens leverandør): api.status.io/1.0/status/<side>. Vi bruker region EU.
const STATUSIO = { 100: "operational", 200: "degraded", 300: "degraded", 400: "degraded", 500: "outage", 600: "outage" };
export function mapStatusio(data, services, region) {
  const list = data?.result?.status;
  if (!Array.isArray(list)) return "unknown";
  const states = [];
  for (const s of list.filter(s => services.includes(s.name))) {
    const c = (s.containers || []).find(c => c.name === region);
    states.push(STATUSIO[c ? c.status_code : s.status_code]);
  }
  if (states.length === 0 || states.some(s => !s)) return "unknown";
  return worstOf(states);
}

/** Kildene. Nøkkelen brukes i data/status.json (vendor.feed). */
export const FEEDS = {
  microsoft: { url: "https://status.cloud.microsoft/api/posts/mac", map: mapMicrosoft },
  "zyxel-nebula": { url: "https://www.nebulastatus.zyxel.com/api/v2/summary.json", map: d => mapStatuspage(d) },
  "uniweb-webhotell": { url: "https://status.uniweb.no/api/v2/summary.json", map: d => mapStatuspage(d, ["Web hosting", "Domains / DNS"]) },
  "uniweb-epost": { url: "https://status.uniweb.no/api/v2/summary.json", map: d => mapStatuspage(d, ["E-mail", "Domains / DNS"]) },
  kundeportal: { url: "https://api.status.io/1.0/status/63ef45da7ee94905308a1a4a", map: d => mapStatusio(d, ["Halo Core Application", "Email Processing"], "EU") },
};

/** Henter alle kilder parallelt. Returnerer { feed: { state, fetched } }. Feiler aldri. */
export async function fetchVendors(feedNames, now = new Date(), log = console) {
  const urls = [...new Set(feedNames.map(f => FEEDS[f].url))];
  const raw = Object.fromEntries(await Promise.all(urls.map(async u => {
    try { return [u, { ok: true, data: await getJson(u) }]; }
    catch (e) { log.warn(`ADVARSEL leverandørkilde svarte ikke: ${u} (${e.message})`); return [u, { ok: false }]; }
  })));
  const out = {};
  for (const f of feedNames) {
    const r = raw[FEEDS[f].url];
    let state = "unknown";
    if (r.ok) { try { state = FEEDS[f].map(r.data); } catch { state = "unknown"; } }
    if (state === "unknown" && r.ok) log.warn(`ADVARSEL ukjent svar fra kilden for ${f}`);
    out[f] = { state, fetched: now.toISOString() };
  }
  return out;
}

/** Uten nett (tester, lokal sjekk): alle kilder «unknown». */
export function offlineVendors(feedNames, now = new Date()) {
  return Object.fromEntries(feedNames.map(f => [f, { state: "unknown", fetched: now.toISOString() }]));
}
