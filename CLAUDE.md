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

## Hvem endrer statusen (B23, besluttet av Johannes 13. nov. 2026)

- **Leverandørstatus** endres bare av systemet i Cloudflare: bygget henter offentlige kilder.
  Ingen API-tokens, ingen Claude-økter og ingen planlagte Claude-oppgaver brukes til dette.
- **Hendelser og NITDs vurdering** skrives av ansatte i NITD.
- Claude skriver ikke statustekster, oppdaterer ikke hendelser og overvåker ikke leverandører.
  Claude arbeider bare med koden til siden, og bare når Johannes ber om det.
- Leverandørens egne meldinger skrives ikke av i hendelsesloggen. Kortet og lenken viser dem.

## Kontrakt med norskitdrift.no (B26)

Banneret på norskitdrift.no leser `/status.json`. Ikke endre eller fjern `overall.state`,
`active[].type`, `active[].title` eller CORS-headeren på `/status.json` uten avtale med Johannes.
Nye felt kan legges til. Testen «kontrakt» i `scripts/test.mjs` skal aldri svekkes.

## Selvgående avslutning (B24)

- Hendelse med `"autoResolve": "microsoft"` (eller annen kilde) vises som løst når leverandøren melder normal drift.
- NITD-merknad med `"clearWhen": "<kilde>"` i `observedStatus` forsvinner samtidig.
- `"messageClearWhen": "<kilde>"` i `status.json` skjuler meldingen øverst.
- Kilden «Ukjent» (svarer ikke) avslutter ingenting.

## Regler for innhold
- Skriv om tjenestene og hva kunden bør gjøre. Aldri om hvordan siden er laget, hentes eller oppdateres.
- Rolig og konkret: hva som er berørt, hva kundene bør gjøre og når neste oppdatering kommer (`nextUpdate`).
- Ingen kundenavn, personopplysninger, interne systemnavn eller verktøynavn. Skriv «Overvåking», «Kundeportal» og «helpdesksystemet», ikke verktøyets navn.
  Bygget stopper på ord i `config/forbudte-ord.txt`, e-post/telefon som ikke er NITDs, hemmeligheter, IP-adresser,
  interne vertsnavn og domener som ikke er godkjent (`ALLOWED_DOMAINS` i `scripts/lib/model.mjs`).
- Kontakt ved hendelse: telefon 69 81 10 00 (akutt: trykk 9), https://kundeportal.nitd.no og helpdesk@nitd.no. Alt havner i kundeportalen.
- `observedStatus` (NITDs egen vurdering) settes alltid manuelt, aldri automatisk fra målinger.
- Leverandørstatus hentes automatisk når siden bygges (`vendor.feed`, `scripts/lib/vendors.mjs`). Den settes aldri for hånd.
- Språk: saklig og faglig, som i en SLA-rapport. Korte setninger, ingen muntlige uttrykk.
- Tider lagres med tidssone (ISO 8601). Microsoft oppgir UTC. Siden viser norsk tid.
- Hendelser slettes aldri. De arkiveres (vises i 90 dager, ligger i repoet etter det).
- Gjennomgangen etter en hendelse skrives i HaloPSA og publiseres ikke. Ingen interne saksnumre i `data/`.
- Kilder: bare offisielle, offentlige statussider og feeder uten innlogging. Aldri Downdetector, aldri skraping eller omgåelse av sperrer.

## Slik oppdateres status under en hendelse
1. Lag branch, f.eks. `status/2026-11-13-microsoft`.
2. Oppdater `data/status.json` (`updated`, berørte komponenter, `message`).
3. Ny hendelse: `data/hendelser/ÅÅÅÅ-MM-DD-kort-navn.json` (dato = start i norsk tid). Ellers: legg ny oppdatering øverst i `updates`, oppdater `nextUpdate`.
4. `scripts/sjekk.sh` lokalt, så PR. Når hendelsen er løst: `status: "lost"`, `resolved`, og komponentene tilbake til `operational`.

Hendelsesstatus (NSM 4.2–4.4, ISO 27001 A.5.25–5.27): `undersokes` → `handteres` → `overvakes` → `lost`.
`started` = når feilen startet, `detected` = når NITD ble kjent med den (NIS2-fristene regnes herfra).
NIS2-klassifisering og gjennomgang står i HaloPSA, aldri på siden.

## Kvalitetskrav
- Kjør `scripts/sjekk.sh` før PR (validering, tester, bygg). Den kjøres også som statussjekken `sjekk`.
- WCAG 2.2 AA i lyst og mørkt tema. Workflowen «Kvalitet (UU + Lighthouse)» stopper alvorlige UU-brudd.
  Testverktøyene er låst i `scripts/qa/package-lock.json`. Ingen `npx`.
- Ingen tredjepartsskript, eksterne fonter, inline skript eller inline stil (CSP i `src/_headers`).
- Ingen Pages Functions eller andre åpne endepunkter uten godkjenning fra Johannes (se `docs/plan.md` 7.2).
