// Kontroll av at bare vendorStatus er endret i data/status.json (B27).
import { STATES } from "./model.mjs";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function strip(status) {
  const copy = JSON.parse(JSON.stringify(status));
  for (const g of copy.groups || []) for (const c of g.components || []) delete c.vendorStatus;
  return copy;
}

/** Returnerer liste med feil. Tom liste = godkjent. */
export function sjekkEndring(beforeText, afterText) {
  let before, after;
  try { before = JSON.parse(beforeText); after = JSON.parse(afterText); }
  catch (e) { return [`data/status.json kan ikke leses (${e.message})`]; }
  const errors = [];
  if (JSON.stringify(strip(before)) !== JSON.stringify(strip(after))) {
    errors.push("Andre felt enn vendorStatus er endret i data/status.json");
  }
  for (const g of after.groups || []) for (const c of g.components || []) {
    const vs = c.vendorStatus;
    if (vs == null) continue;
    if (!c.vendor?.feed) errors.push(`${c.id}: vendorStatus uten vendor.feed`);
    if (![...STATES, "unknown"].includes(vs.state)) errors.push(`${c.id}: ugyldig tilstand «${vs.state}»`);
    if (typeof vs.since !== "string" || !ISO.test(vs.since)) errors.push(`${c.id}: ugyldig «since»`);
    const extra = Object.keys(vs).filter(k => !["state", "since"].includes(k));
    if (extra.length) errors.push(`${c.id}: ukjente felt i vendorStatus (${extra.join(", ")})`);
  }
  return errors;
}
