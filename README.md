# nitd-status – status.norskitdrift.no

Statusside for Norsk IT Drift. Statisk HTML bygget fra JSON, uten database, innlogging,
tredjepartsskript eller åpne endepunkter. Plan og beslutninger: [`docs/plan.md`](docs/plan.md).

## Bygg og test

Krever bare Node 22.

```bash
scripts/sjekk.sh
```

Det validerer `data/`, kjører testene og bygger `dist/`. Kun validering: `node scripts/build.mjs --check`.
Forhåndsvis lokalt med en hvilken som helst statisk server mot `dist/`.

Cloudflare Pages: build-kommando `node scripts/build.mjs`, output `dist`, produksjon `main`.

## Struktur

| Sti | Innhold |
|---|---|
| `data/status.json` | Gjeldende status per komponent (`vendorStatus` og `observedStatus`) |
| `data/hendelser/ÅÅÅÅ-MM-DD-navn.json` | Én fil per hendelse eller planlagt vedlikehold |
| `config/forbudte-ord.txt` | Ord som ikke skal publiseres (verktøynavn o.l.). Publiseres ikke |
| `src/` | CSS, JS, fonter, `_headers`, `robots.txt`, `security.txt`. Kopieres til `dist/` |
| `scripts/build.mjs`, `scripts/lib/` | Validering, HTML-sider og Atom-feed |
| `scripts/test.mjs` | Tester (`node --test`) |
| `scripts/qa/` | Låste testverktøy (axe, Lighthouse) for CI |

Publisert: `/`, `/hendelser/<id>`, `/arkiv`, `/feed.xml` (Atom), `/versjon.json`.

## Leverandørkilder

Offisielle, offentlige kilder uten innlogging. Verifisert 13. nov. 2026 med `curl` fra skymiljø.
Downdetector og andre tredjepartstjenester brukes ikke.

| Komponent | Kilde | Format | Status |
|---|---|---|---|
| Microsoft 365 | <https://status.cloud.microsoft/api/posts/mac> og <https://status.cloud.microsoft/api/feed/mac> | JSON, RSS | Verifisert (200). Tider i UTC. Inneholder ikke MO/EX-referansen; den legges inn manuelt fra admin center. |
| Uniweb (webhotell og e-post) | <https://status.uniweb.no> – `/api/v2/summary.json`, `/history.rss`, `/history.atom` | JSON, RSS, Atom | Verifisert (200). Atlassian Statuspage. Relevante komponenter: «Web hosting» og «E-mail». |
| Zyxel | <https://www.nebulastatus.zyxel.com> – `/api/v2/summary.json`, `/history.rss`, `/history.atom` | JSON, RSS, Atom | Verifisert (200). Gjelder bare Nebula-skytjenesten. `status.zyxel.com` og adressen uten `www.` svarer ikke. |
| Sophos | <https://status.sophos.com> | Ukjent | **Ikke verifisert maskinelt.** Oppgitt som offisiell statusside i Sophos' dokumentasjon, men svarer 403 på automatiske kall. Sperren omgås ikke. Bare lenke og manuell `vendorStatus`; `observedStatus` er hovedkilden. |
| Kundeportal (intern kilde) | Leverandørens statusside, RSS (se `docs/plan.md` avsnitt 5) | RSS | Verifisert (200). Brukes bare internt, siden verktøynavn ikke skal stå på siden. |

Første versjon viser egne tjenester og Microsoft 365. Sophos, Zyxel og Uniweb kommer i neste PR.
