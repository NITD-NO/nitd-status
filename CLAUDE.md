# CLAUDE.md – status.norskitdrift.no

Statusside for Norsk IT Drift (NITD). Statisk side bygget fra JSON i `data/`.
GitHub → Cloudflare Pages → `https://status.norskitdrift.no`. Driftes uavhengig av norskitdrift.no.
Skriv norsk bokmål. Svar kort. Si fra bare når noe er ferdig, feiler eller trenger beslutning fra Johannes.

Les før arbeid med tokens, secrets, deploy eller Cloudflare: `NITD-NO/nitd-repo-standard`
(`CLAUDE.md`, `baseline.yaml`, `docs/sikkerhet/nokler-og-tilganger.md`, `docs/oppstart/cloudflare-pages.md`).
Plan, datamodell, kilder, risiko og åpne spørsmål: `docs/plan.md`. Oppdater den når noe er besluttet.

## Arbeidsflyt
Branch → pull request → kvalitetssjekk grønn → merge → Cloudflare Pages deployer automatisk.

- Ikke push direkte til `main`. Commit-meldinger på norsk.
- Ikke merge selv. Vent på grønn sjekk og godkjenning fra Johannes.
  Unntak: statusoppdateringer som bare endrer `data/`, når Johannes har godkjent det for den konkrete hendelsen.
- Etter merge: kontroller at endringen er ute på `https://status.norskitdrift.no/…`, med en cache-buster i URL-en.

## Verktøy agenten bruker
- git: commit og `git push -u origin <branch>`
- GitHub MCP: create_pull_request; pull_request_read (get_check_runs); merge_pull_request (bare når det er godkjent)
- subscribe_pr_activity / unsubscribe_pr_activity: følge en PR til den er merget
- create_trigger / send_later: planlagte sjekker. Slettes når de ikke lenger trengs.
- curl mot offentlige leverandørkilder og mot status.norskitdrift.no for kontroll

## Cloudflare
- Deploy skjer via Git-koblingen i Cloudflare Pages. Den trenger ingen token.
- Agenten får bare tokens med lesetilgang. Trengs en endring i Cloudflare: beskriv den og be Johannes om et midlertidig token, som slettes etterpå.
- Ingen hemmeligheter i chat, kode, dokumentasjon eller prompter. Secrets ligger i GitHub Actions secrets eller miljøinnstillingene, aldri i repoet.

## Regler for innhold
- Rolig og konkret: hva som er berørt, hva kundene bør gjøre og når neste oppdatering kommer (`nextUpdate`).
- Ingen kundenavn, personopplysninger, interne systemnavn eller verktøynavn. Skriv «Overvåking», «Kundeportal» og «helpdesksystemet», ikke verktøyets navn.
  Bygget stopper på ord i `config/forbudte-ord.txt`, e-post/telefon som ikke er NITDs, hemmeligheter, IP-adresser,
  interne vertsnavn og domener som ikke er godkjent (`ALLOWED_DOMAINS` i `scripts/lib/model.mjs`).
- Kontakt ved hendelse: telefon 69 81 10 00 (akutt: trykk 9), https://kundeportal.nitd.no og helpdesk@nitd.no. Alt havner i kundeportalen.
- `observedStatus` («Registrert av NITD») settes alltid manuelt etter en vurdering, aldri automatisk fra målinger.
- `vendorStatus` er det leverandøren selv melder, med lenke og referanse. Ikke gjett.
- Tider lagres med tidssone (ISO 8601). Microsoft oppgir UTC. Siden viser norsk tid.
- Hendelser slettes aldri. De arkiveres (vises i 90 dager, ligger i repoet etter det).
- Gjennomgangen etter en hendelse skrives i HaloPSA og publiseres ikke. Ingen interne saksnumre i `data/`.
- Kilder: bare offisielle, offentlige statussider og feeder uten innlogging. Aldri Downdetector, aldri skraping eller omgåelse av sperrer.

## Slik oppdateres status under en hendelse
1. Lag branch, f.eks. `status/2026-11-13-microsoft`.
2. Oppdater `data/status.json` (`updated`, berørte komponenter, `message`).
3. Ny hendelse: `data/hendelser/ÅÅÅÅ-MM-DD-kort-navn.json` (dato = start i norsk tid). Ellers: legg ny oppdatering øverst i `updates`, oppdater `nextUpdate`.
4. `scripts/sjekk.sh` lokalt, så PR. Når hendelsen er løst: `status: "lost"`, `resolved`, og komponentene tilbake til `operational`.

## Kvalitetskrav
- Kjør `scripts/sjekk.sh` før PR (validering, tester, bygg). Den kjøres også som statussjekken `sjekk`.
- WCAG 2.2 AA i lyst og mørkt tema. Workflowen «Kvalitet (UU + Lighthouse)» stopper alvorlige UU-brudd.
  Testverktøyene er låst i `scripts/qa/package-lock.json`. Ingen `npx`.
- Ingen tredjepartsskript, eksterne fonter, inline skript eller inline stil (CSP i `src/_headers`).
- Ingen Pages Functions eller andre åpne endepunkter uten godkjenning fra Johannes (se `docs/plan.md` 7.2).
