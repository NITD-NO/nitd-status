// HTML-maler for statussiden. All tekst fra data escapes. Ingen inline skript eller stil (CSP).
import { STATE_LABEL, INCIDENT_STATUS, CLOSED, SOURCE_LABEL, RANK, STATES, effective } from "./model.mjs";

export const SITE = "https://status.norskitdrift.no";

// Stilark og skript får innholdshash i filnavnet (settes av bygget), så nettleseren aldri
// kombinerer ny HTML med gamle filer fra cache. Se docs/plan.md B25.
export const ASSETS = { css: "/css/status.css", theme: "/js/theme.js", app: "/js/status.js" };
export const PHONE = { text: "69 81 10 00", tel: "+4769811000" };
export const PORTAL = "https://kundeportal.nitd.no";
export const EMAIL = "helpdesk@nitd.no";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const MONTHS = ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."];

function osloParts(iso) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo", year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = t => parts.find(p => p.type === t).value;
  return { y: +get("year"), mo: +get("month"), d: +get("day"), h: get("hour"), mi: get("minute") };
}

/** «13. nov. 2026 kl. 08:29» i norsk tid. */
export function fmt(iso, { year = true } = {}) {
  const p = osloParts(iso);
  return `${p.d}. ${MONTHS[p.mo - 1]}${year ? " " + p.y : ""} kl. ${p.h}:${p.mi}`;
}
/** «kl. 09:30» hvis samme dag som `ref`, ellers full dato. */
export function fmtShort(iso, refIso) {
  const a = osloParts(iso), b = osloParts(refIso);
  if (a.y === b.y && a.mo === b.mo && a.d === b.d) return `kl. ${a.h}:${a.mi}`;
  return fmt(iso, { year: a.y !== b.y });
}
function time(iso, opts) {
  return `<time datetime="${esc(new Date(iso).toISOString())}">${esc(fmt(iso, opts))}</time>`;
}

function pill(state) {
  return `<span class="pill pill--${state}">${esc(STATE_LABEL[state])}</span>`;
}

function layout({ title, description, path, body, checked, version }) {
  return `<!DOCTYPE html>
<html lang="nb" data-version="${esc(version)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}${esc(path)}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#f7fafc" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#07131f" media="(prefers-color-scheme: dark)">
  <link rel="alternate" type="application/atom+xml" title="Driftsstatus – Norsk IT Drift (Atom)" href="/feed.xml">
  <link rel="icon" href="/nitd-mark.svg" type="image/svg+xml">
  <link rel="preload" href="/fonts/source-sans-3-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${ASSETS.css}">
  <script src="${ASSETS.theme}"></script>
  <script src="${ASSETS.app}" defer></script>
</head>
<body>
  <a class="skip-link" href="#innhold">Hopp til innhold</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="/">
        <img src="/nitd-mark.svg" width="32" height="32" alt="">
        <span><span class="brand-name">Norsk IT Drift</span> <span class="brand-sub">Driftsstatus</span></span>
      </a>
      <button class="theme-toggle" type="button" data-theme-toggle hidden>Mørkt tema</button>
    </div>
  </header>
  <div class="wrap">
    <div class="notice" data-version-notice role="status" aria-live="polite"></div>
  </div>
  <main id="innhold" class="wrap">
${body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <p>Statussiden driftes av Norsk IT Drift AS. Alle tidspunkter er oppgitt i norsk tid.${checked ? ` Sist kontrollert ${time(checked)}.` : ""}</p>
      <p>Siden bruker ikke informasjonskapsler eller sporing.</p>
      <p><a href="https://norskitdrift.no/">norskitdrift.no</a> · <a href="https://norskitdrift.no/personvern">Personvern</a> · <a href="https://norskitdrift.no/tilgjengelighet">Tilgjengelighet</a> · <a href="/arkiv">Arkiv</a> · <a href="/feed.xml">Atom-feed</a> · <a href="/status.json">JSON</a> · <a href="/status.csv">CSV</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

function contactBlock() {
  return `<section class="card contact" aria-labelledby="kontakt-tittel">
      <h2 id="kontakt-tittel">Kontakt ved driftshendelser</h2>
      <dl class="contact-list">
        <dt>Telefon</dt><dd><a class="phone" href="tel:${PHONE.tel}">${PHONE.text}</a></dd>
        <dt>Kundeportal</dt><dd><a href="${PORTAL}">kundeportal.nitd.no</a></dd>
        <dt>E-post</dt><dd><a href="mailto:${EMAIL}">${EMAIL}</a></dd>
      </dl>
      <p class="meta">Alle henvendelser registreres i kundeportalen.</p>
      <p class="urgent"><strong>Pågående dataangrep eller kritisk driftsavbrudd:</strong> ring ${PHONE.text} og velg 9. <a href="https://norskitdrift.no/under-angrep">Om akuttlinjen</a></p>
    </section>`;
}

function subscribeBlock() {
  return `<section class="card subscribe" aria-labelledby="abonner-tittel">
      <h2 id="abonner-tittel">Abonnement og data</h2>
      <p>Hendelser og planlagt vedlikehold publiseres som Atom-feed. Feeden kan legges inn i Outlook, Teams eller en annen feedleser uten innlogging.</p>
      <ul class="data-links">
        <li><a href="/feed.xml">Atom-feed</a> <span class="meta">${SITE}/feed.xml</span></li>
        <li><a href="/status.json">Gjeldende status som JSON</a> <span class="meta">for bruk i andre systemer</span></li>
        <li><a href="/status.csv">Gjeldende status som CSV</a> <span class="meta">kan åpnes i Excel</span></li>
      </ul>
    </section>`;
}

function vendorRefs(inc) {
  if (!inc.vendorRefs?.length) return "";
  const refs = inc.vendorRefs.map(r => r.url
    ? `<a href="${esc(r.url)}">${esc(r.vendor)} ${esc(r.ref)}</a>`
    : `${esc(r.vendor)} ${esc(r.ref)}`).join(", ");
  return `<p class="meta">Referanse hos leverandør: ${refs}</p>`;
}

function componentNames(inc, components) {
  return inc.components.map(id => components.get(id)?.name || id).join(", ");
}

function statusLabel(inc) { return INCIDENT_STATUS[inc.type][inc.status]; }

function updatesList(inc, headingLevel = 3, limit = Infinity) {
  const sorted = [...inc.updates].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const more = sorted.length > limit
    ? `\n        <p><a href="/hendelser/${esc(inc.id)}">Se hele loggen (${sorted.length} oppdateringer)<span class="visually-hidden">: ${esc(inc.title)}</span></a></p>`
    : "";
  const items = sorted.slice(0, limit).map(u => `
          <li>
            <p class="log-meta">${time(u.time)}${u.source === "leverandor" ? ` <span class="log-source">· ${esc(inc.vendorRefs?.[0]?.vendor || SOURCE_LABEL.leverandor)}</span>` : ""}</p>
            <p>${esc(u.text)}</p>
          </li>`).join("");
  return `<h${headingLevel} class="log-title">${limit < Infinity && sorted.length > limit ? "Siste oppdateringer" : "Hendelseslogg"} <span class="meta-inline">(nyeste først)</span></h${headingLevel}>
        <ol class="log">${items}
        </ol>${more}`;
}

function incidentWhen(inc) {
  if (inc.type === "vedlikehold") {
    return `<p class="meta">Tidsrom: ${time(inc.scheduledStart)} til ${time(inc.scheduledEnd)}</p>`;
  }
  if (inc.autoResolved) {
    return `<p class="meta">Startet ${time(inc.started)}. ${esc(inc.vendorRefs?.[0]?.vendor || "Leverandøren")} melder normal drift.</p>`;
  }
  return `<p class="meta">Startet ${time(inc.started)}${inc.resolved ? `. Løst ${time(inc.resolved)}` : ""}.</p>`;
}

function incidentDetails(inc, components, { headingLevel = 3, limit = Infinity } = {}) {
  const closed = inc.status === CLOSED[inc.type];
  return `${incidentWhen(inc)}
        <dl class="facts">
          <dt>Berørt</dt><dd>${esc(componentNames(inc, components))}</dd>
          <dt>${closed ? "Beskrivelse under hendelsen" : "Beskrivelse"}</dt><dd>${esc(inc.impact)}</dd>
          ${inc.advice && !closed ? `<dt>Anbefalt tiltak</dt><dd>${esc(inc.advice)}</dd>` : ""}
          ${inc.nextUpdate && !closed ? `<dt>Neste oppdatering</dt><dd>${time(inc.nextUpdate)}</dd>` : ""}
        </dl>
        ${vendorRefs(inc)}
        ${updatesList(inc, headingLevel, limit)}`;
}

function incidentCard(inc, components, { full = true, headingLevel = 3, limit = 3 } = {}) {
  const kind = inc.type === "vedlikehold" ? "Vedlikehold" : "Hendelse";
  return `<article class="card incident incident--${esc(inc.type)} incident--${esc(inc.status)}" aria-labelledby="h-${esc(inc.id)}">
        <p class="tag">${esc(kind)} · ${esc(statusLabel(inc))}</p>
        <h${headingLevel} id="h-${esc(inc.id)}"><a href="/hendelser/${esc(inc.id)}">${esc(inc.title)}</a></h${headingLevel}>
        ${full ? incidentDetails(inc, components, { headingLevel: headingLevel + 1, limit }) : `${incidentWhen(inc)}<p>${esc(inc.impact)}</p>`}
      </article>`;
}

const VENDOR_TEXT = {
  recovering: "melder at tjenesten er i bedring.",
  degraded: "melder redusert tjeneste.",
  outage: "melder driftsavbrudd.",
};

function componentCard(comp) {
  const { state } = effective(comp);
  const v = comp.vendorStatus, o = comp.observedStatus, vendor = comp.vendor;
  const shown = vendor && vendor.public !== false;
  const lines = [];
  if (v && VENDOR_TEXT[v.state]) {
    lines.push(`<p>${esc(shown ? vendor.name : "Leverandøren")} ${VENDOR_TEXT[v.state]}</p>`);
  }
  if (o && o.state !== "operational" && o.note) lines.push(`<p>${esc(o.note)}</p>`);
  if (v && v.state === "unknown" && shown) {
    lines.push(`<p class="meta">Status fra ${esc(vendor.name)} kan ikke vises nå. Se ${esc(vendor.name)}s statusside.</p>`);
  }
  const foot = [];
  if (shown && vendor.statusUrl) foot.push(`<a href="${esc(vendor.statusUrl)}">Statusside hos ${esc(vendor.name)}</a>`);
  return `<li class="component component--${state}">
          <div class="component-head">
            <h4>${esc(comp.name)}</h4>
            ${pill(state)}
          </div>
          ${comp.description ? `<p class="meta">${esc(comp.description)}</p>` : ""}
          ${lines.join("\n          ")}
          ${foot.length ? `<p class="component-foot">${foot.join(" · ")}</p>` : ""}
        </li>`;
}

const HEADLINE = {
  operational: "Alle tjenester fungerer normalt",
  unknown: "Alle tjenester fungerer normalt",
  recovering: "Tjenestene er i bedring",
  degraded: "Én eller flere tjenester har redusert funksjon",
  outage: "Driftsavbrudd",
};

export function overall(status) {
  let s = "operational";
  for (const g of status.groups) for (const c of g.components) {
    const e = effective(c).state;
    if (e !== "unknown" && RANK[e] > RANK[s]) s = e;
  }
  return s;
}

const OSLO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_LABEL = new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Oslo", weekday: "long", day: "numeric", month: "long" });
const osloDay = t => OSLO_DAY.format(new Date(t));
const startOf = i => i.started || i.scheduledStart;
/** Slutt: løst-tidspunkt, planlagt slutt, siste oppdatering (automatisk løst) eller nå (pågår). */
function endOf(i, now) {
  if (i.status !== CLOSED[i.type]) return now.getTime();
  if (i.resolved) return Date.parse(i.resolved);
  if (i.type === "vedlikehold") return Date.parse(i.scheduledEnd);
  return Math.max(...i.updates.map(u => Date.parse(u.time)));
}

/** Kort linje for historikk og arkiv. Viser fakta, ikke beskrivelsen i presens. */
function historyItem(inc, components, headingLevel = 4) {
  const kind = inc.type === "vedlikehold" ? "Vedlikehold" : "Hendelse";
  let when;
  if (inc.type === "vedlikehold") when = `${time(inc.scheduledStart)} til ${time(inc.scheduledEnd)}`;
  else if (inc.autoResolved) when = `Startet ${time(inc.started)}. ${esc(inc.vendorRefs?.[0]?.vendor || "Leverandøren")} melder normal drift.`;
  else when = `Startet ${time(inc.started)}${inc.resolved ? `. Løst ${time(inc.resolved)}` : ""}.`;
  return `<li class="history-item history-item--${esc(inc.status)}">
            <h${headingLevel}><a href="/hendelser/${esc(inc.id)}">${esc(inc.title)}</a></h${headingLevel}>
            <p class="tag">${esc(kind)} · ${esc(statusLabel(inc))}</p>
            <p class="meta">${when}</p>
            <p class="meta">Berørt: ${esc(componentNames(inc, components))}</p>
          </li>`;
}

/** Historikk dag for dag (nyeste først), også dager uten hendelser. */
function historyByDay(incidents, components, now, days) {
  const out = [];
  for (let k = 0; k < days; k++) {
    const t = now.getTime() - k * 864e5;
    const day = osloDay(t);
    // En hendelse vises på alle dager den pågikk: fra startdag til sluttdag (pågående: til i dag).
    const list = incidents.filter(i => osloDay(startOf(i)) <= day && day <= osloDay(endOf(i, now)))
      .sort((a, b) => Date.parse(startOf(b)) - Date.parse(startOf(a)));
    const label = DAY_LABEL.format(new Date(t));
    out.push(`<div class="history-day">
        <h3>${esc(label.charAt(0).toUpperCase() + label.slice(1))}</h3>
        ${list.length
          ? `<ul class="history-list">${list.map(i => historyItem(i, components)).join("")}</ul>`
          : `<p class="meta">Ingen hendelser registrert.</p>`}
      </div>`);
  }
  return out.join("\n      ");
}

export function renderIndex({ status, incidents, components, now, version, checked }) {
  const state = overall(status);
  const activeIncidents = incidents.filter(i => i.type === "hendelse" && i.status !== "lost")
    .sort((a, b) => Date.parse(b.started) - Date.parse(a.started));
  const maintenance = incidents.filter(i => i.type === "vedlikehold" && i.status !== "fullfort")
    .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart));

  const body = `
    <section class="summary summary--${state}" aria-labelledby="status-tittel">
      <h1 id="status-tittel">Driftsstatus</h1>
      <p class="headline">${pill(state)} <span>${esc(HEADLINE[state])}</span></p>
      ${status.message ? `<p class="lead">${esc(status.message)}</p>` : ""}
      ${checked
        ? `<p class="meta" data-checked="${esc(new Date(checked).toISOString())}">Sist kontrollert ${time(checked)}<span data-age></span>.</p>
      <p class="stale" data-stale hidden></p>`
        : ""}
    </section>

    ${activeIncidents.length ? `<section aria-labelledby="pagaende-tittel">
      <h2 id="pagaende-tittel">Pågående hendelser</h2>
      ${activeIncidents.map(i => incidentCard(i, components)).join("\n      ")}
    </section>` : ""}

    ${maintenance.length ? `<section aria-labelledby="vedlikehold-tittel">
      <h2 id="vedlikehold-tittel">Planlagt vedlikehold</h2>
      ${maintenance.map(i => incidentCard(i, components)).join("\n      ")}
    </section>` : ""}

    <section aria-labelledby="komponenter-tittel">
      <h2 id="komponenter-tittel">Tjenestestatus</h2>
      ${status.groups.map(g => `<div class="group">
        <h3 class="group-title" id="gruppe-${esc(g.id)}">${esc(g.name)}</h3>
        <ul class="components" aria-labelledby="gruppe-${esc(g.id)}">
        ${g.components.map(componentCard).join("\n        ")}
        </ul>
      </div>`).join("\n      ")}
    </section>

    ${contactBlock()}

    <section aria-labelledby="historikk-tittel">
      <h2 id="historikk-tittel">Hendelseshistorikk</h2>
      ${historyByDay(incidents, components, now, 7)}
      <p><a href="/arkiv">Arkiv for de siste 90 dagene</a></p>
    </section>

    ${subscribeBlock()}`;
  return layout({
    title: "Driftsstatus – Norsk IT Drift",
    description: "Driftsstatus for Norsk IT Drift og leverandørene Microsoft 365, Sophos, Zyxel og Uniweb. Pågående hendelser, planlagt vedlikehold og historikk.",
    path: "/", body, checked, version,
  });
}

export function renderIncident({ inc, components, status, version, checked }) {
  const body = `
    <p class="breadcrumb"><a href="/">Driftsstatus</a> › <a href="/arkiv">Arkiv</a></p>
    <article class="incident-page" aria-labelledby="h-${esc(inc.id)}">
      <p class="tag">${inc.type === "vedlikehold" ? "Vedlikehold" : "Hendelse"} · ${esc(statusLabel(inc))}</p>
      <h1 id="h-${esc(inc.id)}">${esc(inc.title)}</h1>
      ${incidentDetails(inc, components, { headingLevel: 2 })}
    </article>
    ${contactBlock()}`;
  return layout({
    title: `${inc.title} – Driftsstatus – Norsk IT Drift`,
    description: `${statusLabel(inc)}: ${inc.title}.`,
    path: `/hendelser/${inc.id}`, body, checked, version,
  });
}

export function renderArchive({ incidents, components, status, version, checked }) {
  const closed = incidents.filter(i => i.status === CLOSED[i.type])
    .sort((a, b) => Date.parse(b.started || b.scheduledStart) - Date.parse(a.started || a.scheduledStart));
  const body = `
    <p class="breadcrumb"><a href="/">Driftsstatus</a></p>
    <h1>Arkiv</h1>
    <p class="lead">Avsluttede hendelser og vedlikehold de siste 90 dagene, nyeste først.</p>
    ${closed.length
      ? `<ul class="history-list">${closed.map(i => historyItem(i, components, 2)).join("")}</ul>`
      : `<p>Ingen avsluttede hendelser de siste 90 dagene.</p>`}`;
  return layout({
    title: "Arkiv – Driftsstatus – Norsk IT Drift",
    description: "Avsluttede hendelser og vedlikehold hos Norsk IT Drift de siste 90 dagene.",
    path: "/arkiv", body, checked, version,
  });
}

export function render404({ status, version, checked }) {
  const body = `
    <h1>Fant ikke siden</h1>
    <p class="lead">Adressen finnes ikke på statussiden.</p>
    <p><a href="/">Til driftsstatus</a></p>`;
  return layout({ title: "Fant ikke siden – Driftsstatus – Norsk IT Drift", description: "Siden finnes ikke.", path: "/404", body, checked, version });
}

export { STATES };
