// Atom-feed (RFC 4287) med én oppføring per hendelse eller vedlikehold.
// «updated» er siste oppdatering, slik at feedlesere viser nye meldinger i samme hendelse.
import { INCIDENT_STATUS, SOURCE_LABEL } from "./model.mjs";
import { SITE, esc, fmt } from "./render.mjs";

function latest(inc) {
  const times = inc.updates.map(u => Date.parse(u.time));
  if (inc.resolved) times.push(Date.parse(inc.resolved));
  return new Date(Math.max(...times));
}

function entryText(inc, components) {
  const names = inc.components.map(id => components.get(id)?.name || id).join(", ");
  const lines = [
    `Status: ${INCIDENT_STATUS[inc.type][inc.status]}`,
    `Berørt: ${names}. ${inc.impact}`,
  ];
  if (inc.type === "vedlikehold") lines.push(`Tidsrom: ${fmt(inc.scheduledStart)} til ${fmt(inc.scheduledEnd)}`);
  if (inc.advice) lines.push(`Hva du bør gjøre: ${inc.advice}`);
  if (inc.nextUpdate && !inc.resolved) lines.push(`Neste oppdatering: ${fmt(inc.nextUpdate)}`);
  lines.push("", "Hendelseslogg (nyeste først):");
  for (const u of [...inc.updates].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))) {
    lines.push(`${fmt(u.time)} (${SOURCE_LABEL[u.source]}): ${u.text}`);
  }
  lines.push("", "Kontakt ved hendelse: 69 81 10 00 eller https://kundeportal.nitd.no");
  return lines.join("\n");
}

export function renderFeed({ incidents, components, status }) {
  const items = [...incidents].sort((a, b) => latest(b) - latest(a));
  const updated = new Date(Math.max(Date.parse(status.updated), ...items.map(i => latest(i).getTime())));
  const entries = items.map(inc => {
    const url = `${SITE}/hendelser/${inc.id}`;
    const published = inc.type === "vedlikehold" ? inc.scheduledStart : inc.started;
    const label = INCIDENT_STATUS[inc.type][inc.status];
    const kind = inc.type === "vedlikehold" ? "Vedlikehold" : "Hendelse";
    return `  <entry>
    <id>tag:status.norskitdrift.no,2026:hendelser/${esc(inc.id)}</id>
    <title>${esc(`${kind} (${label.toLowerCase()}): ${inc.title}`)}</title>
    <link rel="alternate" type="text/html" href="${esc(url)}"/>
    <published>${new Date(published).toISOString()}</published>
    <updated>${latest(inc).toISOString()}</updated>
    <content type="text">${esc(entryText(inc, components))}</content>
  </entry>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="nb">
  <id>${SITE}/</id>
  <title>Driftsstatus – Norsk IT Drift</title>
  <subtitle>Hendelser og planlagt vedlikehold. Tider i feeden er UTC, tekstene viser norsk tid.</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE}/feed.xml"/>
  <link rel="alternate" type="text/html" href="${SITE}/"/>
  <updated>${updated.toISOString()}</updated>
  <author><name>Norsk IT Drift</name><uri>https://norskitdrift.no/</uri></author>
  <icon>${SITE}/nitd-mark.svg</icon>
${entries}
</feed>
`;
}
