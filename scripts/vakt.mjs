#!/usr/bin/env node
// Vakt for jobben «Leverandørstatus» (B27). Godkjenner direkte commit til main bare hvis
// 1) bare data/status.json er endret,
// 2) bare vendorStatus-felt er endret, og de er gyldige,
// 3) antall automatiske commits siste 24 timer er under grensen (VAKT_MAKS, standard 30).
// Avslutter med kode 1 og forklaring ellers. Da lager workflowen PR i stedet.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sjekkEndring } from "./lib/vakt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const errors = [];

const changed = git("status", "--porcelain").split("\n").filter(Boolean).map(l => l.slice(3));
const others = changed.filter(f => f !== "data/status.json");
if (others.length) errors.push(`Andre filer er endret: ${others.join(", ")}`);

errors.push(...sjekkEndring(git("show", "HEAD:data/status.json"), readFileSync(join(ROOT, "data/status.json"), "utf8")));

const maks = Number(process.env.VAKT_MAKS ?? 30);
const siste = git("log", "--since=24 hours ago", "--author=github-actions[bot]", "--format=%H").split("\n").filter(Boolean).length;
if (siste >= maks) errors.push(`${siste} automatiske commits siste 24 timer (grense ${maks}). Mulig flapping.`);

if (errors.length) {
  for (const e of errors) console.log(`::error::Vakt: ${e}`);
  process.exit(1);
}
console.log(`Vakt: godkjent (${siste} automatiske commits siste 24 timer).`);
