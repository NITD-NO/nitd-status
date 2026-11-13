// Logikk for jobben «Leverandørstatus» (B27). Ingen KI, ingen tokens.
// Endrer bare vendorStatus ({ state, since }) i data/status.json.
import { STATE_LABEL } from "./model.mjs";

function componentsWithFeed(status) {
  return status.groups.flatMap(g => g.components).filter(c => c.vendor?.feed);
}

const label = s => (s ? STATE_LABEL[s] || s : "ikke satt");

/**
 * Henter status, bekrefter endringer med et nytt kall og oppdaterer `status` på stedet.
 * - fetchStates(feeds) → Promise<{ feed: state }>, der state kan være «unknown».
 * - En endring godtas bare hvis to kall med `recheckMs` mellomrom gir samme svar (mot feil alarm).
 * Returnerer listen over bekreftede endringer. Tom liste = ingen endring, ingen commit.
 */
export async function oppdater({ status, fetchStates, recheckMs = 60000, now = () => new Date(),
  sleep = ms => new Promise(r => setTimeout(r, ms)), log = console }) {
  const comps = componentsWithFeed(status);
  const feeds = [...new Set(comps.map(c => c.vendor.feed))];
  const stored = Object.fromEntries(feeds.map(f => [f, comps.find(c => c.vendor.feed === f).vendorStatus?.state]));

  const first = await fetchStates(feeds);
  const candidates = feeds.filter(f => first[f] && first[f] !== stored[f]);
  if (candidates.length === 0) return [];

  log.log(`Mulig endring for ${candidates.join(", ")}. Bekrefter om ${Math.round(recheckMs / 1000)} s.`);
  await sleep(recheckMs);
  const second = await fetchStates(candidates);

  const changes = [];
  const at = now().toISOString();
  for (const f of candidates) {
    if (second[f] !== first[f]) {
      log.warn(`ADVARSEL ${f}: svarene var ulike (${first[f]} / ${second[f]}). Ingen endring.`);
      continue;
    }
    for (const c of comps.filter(c => c.vendor.feed === f)) {
      c.vendorStatus = { state: first[f], since: at };
      changes.push({ feed: f, name: c.name, from: stored[f], to: first[f] });
    }
  }
  return changes;
}

/** «Microsoft 365: Redusert → Normal; Zyxel Nebula: Normal → Redusert» */
export function oppsummer(changes) {
  return changes.map(c => `${c.name}: ${label(c.from)} → ${label(c.to)}`).join("; ");
}
