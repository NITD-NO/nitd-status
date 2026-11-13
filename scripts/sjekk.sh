#!/usr/bin/env bash
# Samlet sjekk før merge (baseline ACT-08). Krever bare Node 22, ingen npm-pakker.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== Validerer data =="
node scripts/build.mjs --check

echo "== Tester =="
node --test scripts/test.mjs

echo "== Bygger dist/ =="
node scripts/build.mjs --offline

echo "== Kontrollerer at interne filer ikke er med i dist/ =="
if find dist -name '*.md' -o -name '*.mjs' -o -name '*.sh' -o -name 'package*.json' | grep -q .; then
  echo "Interne filer funnet i dist/" >&2; exit 1
fi
echo "OK"
