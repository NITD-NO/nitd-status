#!/usr/bin/env node
// Henter leverandørstatus og oppdaterer vendorStatus i data/status.json (B27).
// Kjøres av .github/workflows/leverandorstatus.yml. Ingen KI, ingen tokens, ingen secrets.
// Miljø: RECHECK_MS (standard 60000) = ventetid før bekreftelseskallet.
// Skriver «changed» og «summary» til $GITHUB_OUTPUT.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchVendors } from "./lib/vendors.mjs";
import { oppdater, oppsummer } from "./lib/hent.mjs";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "status.json");
const status = JSON.parse(readFileSync(FILE, "utf8"));

const fetchStates = async feeds => Object.fromEntries(
  Object.entries(await fetchVendors(feeds)).map(([f, v]) => [f, v.state]));

const changes = await oppdater({
  status,
  fetchStates,
  recheckMs: Number(process.env.RECHECK_MS ?? 60000),
});

const summary = oppsummer(changes).replace(/[\r\n]/g, " ");
if (changes.length) {
  writeFileSync(FILE, JSON.stringify(status, null, 2) + "\n");
  console.log(`Endret: ${summary}`);
} else {
  console.log("Ingen endring.");
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changes.length ? "true" : "false"}\nsummary=${summary}\n`);
}
