// Gjeldende status som JSON og CSV, for nettstedet, andre systemer og Excel.
import { STATE_LABEL, INCIDENT_STATUS, CLOSED, effective } from "./model.mjs";
import { SITE } from "./render.mjs";

const SOURCE_TEXT = { leverandor: "Leverandør", nitd: "Norsk IT Drift" };

function rows(status) {
  const out = [];
  for (const g of status.groups) for (const c of g.components) {
    const { state, source } = effective(c);
    const shown = c.vendor && c.vendor.public !== false;
    out.push({
      id: c.id,
      group: g.name,
      name: c.name,
      state,
      label: STATE_LABEL[state],
      source: source ? SOURCE_TEXT[source] : null,
      note: c.observedStatus?.state !== "operational" ? c.observedStatus?.note || null : null,
      vendor: shown ? c.vendor.name : null,
      vendorStatusUrl: shown ? c.vendor.statusUrl || null : null,
      vendorSince: c.vendorStatus?.since || null,
    });
  }
  return out;
}

export function renderStatusJson({ status, incidents, overallState, now }) {
  const active = incidents.filter(i => i.status !== CLOSED[i.type]).map(i => ({
    id: i.id,
    type: i.type,
    title: i.title,
    status: i.status,
    label: INCIDENT_STATUS[i.type][i.status],
    components: i.components,
    started: i.started || i.scheduledStart,
    end: i.scheduledEnd || null,
    nextUpdate: i.nextUpdate || null,
    url: `${SITE}/hendelser/${i.id}`,
  }));
  return JSON.stringify({
    schema: 1,
    site: SITE,
    generated: now.toISOString(),
    updated: new Date(status.updated).toISOString(),
    overall: { state: overallState, label: STATE_LABEL[overallState] },
    components: rows(status),
    active,
    feed: `${SITE}/feed.xml`,
  }, null, 2) + "\n";
}

// Celler som starter med = + - @ tolkes som formler i Excel. Prefiks med apostrof.
function cell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function renderStatusCsv({ status }) {
  const fmt = iso => iso ? new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)) : "";
  const header = ["Gruppe", "Tjeneste", "Status", "Kilde", "Merknad", "Leverandør", "Leverandørens statusside", "Endret (norsk tid)"];
  const lines = [header, ...rows(status).map(r => [r.group, r.name, r.label, r.source, r.note, r.vendor, r.vendorStatusUrl, fmt(r.vendorSince)])];
  // Semikolon og BOM gjør at norsk Excel åpner fila riktig.
  return "﻿" + lines.map(l => l.map(cell).join(";")).join("\r\n") + "\r\n";
}
