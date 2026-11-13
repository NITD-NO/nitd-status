# Plan: status.norskitdrift.no

Status: **utkast til godkjenning** (13. nov. 2026). Eier: Johannes.
Intern fil. Den publiseres ikke (bare `dist/` publiseres).

## 1. Mål

En rolig og troverdig statusside som kunder og ansatte stoler på under hendelser.
Den driftes uavhengig av norskitdrift.no: eget repo, eget Cloudflare Pages-prosjekt,
ingen felles kode og ingen avhengighet til nettstedets skript, stilark eller data.

## 2. Beslutninger i dette utkastet

| # | Beslutning | Begrunnelse |
|---|---|---|
| B1 | Siden **bygges ferdig til statisk HTML** i CI (`node scripts/build.mjs` → `dist/`). Ingen rammeverk og ingen npm-pakker i bygget, bare Node. | Siden virker uten JavaScript, er rask under last og har ingenting å oppdatere. Feil i data stopper bygget i stedet for å gi en halvveis side. |
| B2 | Cloudflare Pages: build-kommando `node scripts/build.mjs`, output `dist`, produksjon = `main`, Node 22. | Avklaring etterspurt i oppgaven. |
| B3 | **Ingen Pages Functions** i første versjon (ingen `functions/`). | Kravet «ingen åpne endepunkter». `dist/` inneholder bare genererte filer, så interne stier (`data/`, `docs/`, `scripts/`) finnes ikke på nettet og trenger ingen sperre. |
| B4 | Kildedata (`data/`) publiseres ikke direkte. Bygget lager bare det besøkende trenger: HTML, `feed.xml` og `versjon.json` (tidsstempel). | Baseline: «`/data/` publiserer bare det besøkende trenger». |
| B5 | Atom-feed (`/feed.xml`), ikke RSS. | Atom har `updated` per oppføring, så feedlesere viser nye oppdateringer i samme hendelse. |
| B6 | Tema følger systemet (`prefers-color-scheme`), med knapp for å bytte. Valget lagres lokalt (`localStorage`, ingen cookie). | WCAG i lyst og mørkt tema, samme nøkkel (`nitd_theme`) som nettstedet. |
| B7 | «Registrert av NITD» (`observedStatus`) publiseres **alltid manuelt**, etter en vurdering. Aldri automatisk fra målinger. | Egne målinger kan gi feil alarm. En feil rød status svekker tilliten mer enn en litt sen gul. |
| B8 | Hendelser slettes aldri. Avsluttede hendelser vises i arkivet i 90 dager. Eldre filer blir liggende i `data/hendelser/` (og i git-historikken), men publiseres ikke. | Sporbarhet for ISO 27001 og NIS2. |
| B10 | **Ingen manuelt vedlikehold av leverandørstatus.** `vendorStatus` settes bare automatisk fra offentlige, maskinlesbare kilder (7.1). Har leverandøren ingen slik kilde, er `vendorStatus` alltid `null`, og siden viser en fast lenke til leverandørens egen statusside. Besluttet av Johannes 13. nov. 2026. | Statussiden skal være sannhetskilden og ikke kreve vedlikehold. En manuell kopi av leverandørens status blir fort utdatert. |
| B11 | **Kundeportal** får `vendorStatus` automatisk fra leverandørens offentlige feed, men vises **uten leverandørnavn og uten lenke** («Meldt av leverandør»). Modellen får `vendor.public: false` for dette. Besluttet av Johannes 13. nov. 2026. | Ingen vedlikehold, og ingen verktøynavn på siden. |
| B12 | **Uniweb vises som to komponenter:** «Webhotell (Uniweb)» = Uniwebs gruppe «Web hosting» + «Domains / DNS». «E-post (Uniweb)» = gruppen «E-mail» + «Domains / DNS». Hver viser den dårligste av sine underkomponenter. Besluttet av Johannes 13. nov. 2026. | Kunder med bare nettside eller bare e-post ser straks om de er berørt. DNS-feil rammer begge. |
| B13 | Komponenten heter **«Zyxel Nebula»**. Leverandørstatus fra nebulastatus.zyxel.com. Feil på selve utstyret vises som «Registrert av NITD». Besluttet av Johannes 13. nov. 2026. | Navnet sier presist hva leverandørstatusen gjelder. |
| B14 | **Akuttlinjen** («ring 69 81 10 00 og trykk 9» ved aktivt angrep eller akutt driftsstans) står alltid i kontaktboksen, med lenke til norskitdrift.no/under-angrep. Besluttet av Johannes 13. nov. 2026. | Fast tekst, ingen vedlikehold. Samme tilbud som på nettstedet. |
| B15 | Kontaktboksen viser **telefon, kundeportal og helpdesk@nitd.no**. Alle henvendelser havner i kundeportalen. Besluttet av Johannes 13. nov. 2026. | Kunden velger kanal; telefon står først fordi e-post kan være nede ved feil hos Microsoft. |
| B16 | **Erstattet av B20.** ~~Automatisk leverandørstatus:~~ planlagt GitHub Actions-jobb lager PR og merger selv når sjekkene er grønne og PR-en bare endrer `vendorStatus`. Alt annet krever Johannes. Se 7.1. Besluttet av Johannes 13. nov. 2026. | Ingen vedlikehold, også om natten. Vakt i koden begrenser hva som kan merges uten menneske. |
| B17 | **Jevnlig bygg** via Cloudflare deploy hook (7.3), og vedlikehold skifter status ut fra klokka. Besluttet «hver time»; satt til **annenhver time** fordi Cloudflare Pages Free har 500 bygg per måned (hver time ≈ 744). Hver time krever Pages Pro. Besluttet av Johannes 13. nov. 2026. | Arkiv og vedlikehold holder seg riktige uten vedlikehold. |
| B18 | **Hendelsesstatus etter NSM og ISO:** Undersøkes, Håndteres, Overvåkes, Løst, og nytt felt `detected`. NIS2-klassifisering publiseres ikke. Komponentstatus (Normal, Bedring, Redusert, Nede) beholdes. Besluttet av Johannes 13. nov. 2026. | Kjente faser fra NSM 4.2–4.4 og ISO 27001 A.5.25–5.28 gir felles språk med revisjon og NIS2. |
| B19 | **Komponenter uten maskinlesbar leverandørkilde** (Sophos) vises som «Normal» til NITD registrerer feil, med teksten «Leverandøren publiserer ikke maskinlesbar status» og lenke til leverandørens side. Besluttet av Johannes 13. nov. 2026. | «Normal» skal ikke se ut som en bekreftelse fra leverandøren. |
| B20 | **Leverandørstatus hentes når siden bygges**, ikke via PR. Erstatter B16. Ingen workflow skriver til repoet. Besluttet 13. nov. 2026 etter innspill fra Johannes om at siden skal være vedlikeholdsfri. | Enklere og tryggere: ingen skrivetilgang for workflows, ingen unntak i baseline. |
| B21 | **Tjenestestatus som kort**, gruppert i «Norsk IT Drift» og «Leverandører», med navn, status og lenke til leverandørens statusside. Etiketten «Registrert av NITD» vises ikke. Leverandørens melding vises som «Microsoft melder …». Besluttet av Johannes 13. nov. 2026. | Saklig og oversiktlig. Det er opplagt at NITD står bak egne merknader. |
| B22 | **Åpne data:** `/status.json` og `/status.csv` (Excel) med gjeldende status, i tillegg til Atom-feeden. CORS åpen, ingen personopplysninger. Besluttet av Johannes 13. nov. 2026. | Nettstedet og andre systemer kan vise status uten egen kopi. |
| B23 | **Statusen endres bare av systemet i Cloudflare (leverandørstatus) og av NITD-ansatte (hendelser og egen vurdering).** Ingen API-tokens og ingen Claude-økter brukes til statusoppgaver. Leverandørens meldinger skrives ikke av i hendelsesloggen. Besluttet av Johannes 13. nov. 2026. | Driften av statussiden skal ikke avhenge av AI eller tokens. Mindre risiko, ingen løpende kostnad. |
| B24 | **Selvgående avslutning:** en hendelse med `autoResolve: "<kilde>"` vises som løst, en NITD-merknad med `clearWhen` forsvinner og meldingen øverst med `messageClearWhen` skjules når leverandøren melder normal drift. «Ukjent» avslutter ingenting. Besluttet av Johannes 13. nov. 2026. | Tjenesten skal være autonom. Ingen trenger å rydde opp etter leverandørhendelser. |
| B25 | **Cache:** stilark og skript får innholdshash i filnavnet og caches i ett år. HTML, feed og data sendes med `no-cache`. Besluttet 13. nov. 2026 etter at gammel versjon ble vist etter oppdatering. | Nettleser og Cloudflare kan aldri kombinere ny HTML med gamle filer. |
| B26 | **Kontrakt med norskitdrift.no:** banneret leser `/status.json`. Feltene `overall.state`, `active[].type`, `active[].title` og CORS-headeren (`Access-Control-Allow-Origin: *`) endres eller fjernes ikke uten avtale med Johannes. Låst med test i `scripts/test.mjs`. Avtalt 13. nov. 2026. | Statussiden er den ene kilden til status (B9). |
| B9 | Statussiden er den ene kilden til status. På sikt viser banneret på norskitdrift.no bare en lenke hit. | Status finnes ett sted, og de to sidene kan ikke vise ulik status. |

## 3. Struktur

```
nitd-status/
├── data/
│   ├── status.json                 # gjeldende status per komponent (én fil)
│   └── hendelser/
│       └── ÅÅÅÅ-MM-DD-kort-navn.json   # én fil per hendelse eller vedlikehold
├── src/                            # kopieres til dist/ (CSS, JS, fonter, statiske filer)
│   ├── css/status.css
│   ├── js/theme.js                 # setter tema før første tegning
│   ├── js/status.js                # temaknapp + varsel om ny versjon
│   ├── fonts/                      # Source Sans 3 (egen server, OFL-lisens)
│   ├── _headers                    # sikkerhetsheadere for Cloudflare Pages
│   ├── robots.txt
│   └── .well-known/security.txt
├── scripts/
│   ├── build.mjs                   # validerer data og bygger dist/
│   ├── lib/                        # validering, rendering, feed
│   ├── test.mjs                    # enhetstester (node:test) + kontroll av dist/
│   ├── sjekk.sh                    # samlet sjekk (brukes av workflowen «sjekk»)
│   └── qa/                         # låste testverktøy: axe, Lighthouse, serve, Playwright
├── docs/                           # intern dokumentasjon (publiseres ikke)
└── .github/                        # workflows og Dependabot
```

Sider som bygges:

| URL | Innhold |
|---|---|
| `/` | Samlet status, pågående hendelser med logg, komponenter, planlagt vedlikehold, siste 7 dager, kontakt, abonnement |
| `/hendelser/<id>` | Én hendelse med full logg (nyeste først). Feeden lenker hit. |
| `/arkiv` | Avsluttede hendelser og vedlikehold siste 90 dager |
| `/feed.xml` | Atom-feed med hendelser og vedlikehold (siste 90 dager) |
| `/versjon.json` | `{"updated": …}`. Brukes av siden til å si fra om ny status. |
| `/404.html` | Feilside |

## 4. Datamodell

Tider lagres som ISO 8601 **med tidssone** (`2026-11-12T19:26:00+01:00` eller
`…Z`). Microsoft oppgir UTC. Siden viser alltid norsk tid (`Europe/Oslo`).
Tid uten sone stopper bygget.

### 4.1 Tilstander

| Verdi | Vises som | Rang |
|---|---|---|
| `operational` | Normal | 0 |
| `recovering` | Bedring | 1 |
| `degraded` | Redusert | 2 |
| `outage` | Nede | 3 |

Verdiene er de samme som i dagens `driftsstatus.json` på nettstedet.

### 4.2 `data/status.json`

```json
{
  "updated": "2026-11-13T08:45:00+01:00",
  "message": "Valgfri kort melding øverst. Tom når alt er normalt.",
  "groups": [
    {
      "id": "egne",
      "name": "Norsk IT Drift",
      "components": [
        {
          "id": "helpdesk",
          "name": "Helpdesk og telefon",
          "description": "Kort forklaring av hva komponenten er.",
          "observedStatus": { "state": "degraded", "note": "…", "updated": "…" }
        },
        {
          "id": "kundeportal",
          "name": "Kundeportal",
          "vendor": { "name": "Leverandøren", "public": false, "feed": "kundeportal" },
          "observedStatus": { "state": "operational", "note": "", "updated": "…" }
        }
      ]
    },
    {
      "id": "leverandorer",
      "name": "Leverandører",
      "components": [
        {
          "id": "microsoft-365",
          "name": "Microsoft 365",
          "vendor": { "name": "Microsoft", "statusUrl": "https://status.cloud.microsoft/", "feed": "microsoft" },
          "observedStatus": { "state": "operational", "note": "", "updated": "…" }
        }
      ]
    }
  ]
}
```

Regler:

- `observedStatus` er det NITD selv ser (saker fra flere kunder, egne målinger).
  Settes manuelt etter vurdering (B7).
- `vendor.feed` peker på en kilde i `scripts/lib/vendors.mjs`. Bygget henter
  leverandørens tilstand og legger den på komponenten som `vendorStatus` (bare i
  minnet). `vendorStatus` kan ikke settes i `data/` (B10, B20).
- `vendor.public: false` skjuler leverandørens navn og lenke (B11).
- Svarer ikke kilden, vises «Ukjent» med lenke til leverandørens statusside. «Ukjent»
  teller ikke i samlet status.
- Kortet viser den dårligste av leverandørens og NITDs tilstand. Leverandørens melding
  vises som fast tekst («Microsoft melder redusert tjeneste.»), NITDs merknad som ren
  tekst uten etikett (B21).
- Samlet status øverst: «Alle tjenester fungerer normalt», «Tjenestene er i bedring»,
  «Én eller flere tjenester har redusert funksjon» eller «Driftsavbrudd».

### 4.3 `data/hendelser/ÅÅÅÅ-MM-DD-kort-navn.json`

Datoen i filnavnet er startdatoen (norsk tid). Filnavnet uten `.json` er hendelsens
`id` og URL. Bygget stopper hvis de ikke stemmer.

```json
{
  "type": "hendelse",
  "title": "Forstyrrelser i Microsoft 365 (e-post)",
  "status": "handteres",
  "components": ["microsoft-365", "helpdesk"],
  "started": "2026-11-12T19:26:00+01:00",
  "detected": "2026-11-12T19:26:00+01:00",
  "resolved": null,
  "impact": "Hva er berørt, med vanlige ord.",
  "advice": "Hva kundene bør gjøre nå.",
  "nextUpdate": "2026-11-13T09:30:00+01:00",
  "vendorRefs": [
    { "vendor": "Microsoft", "ref": "MO1550821", "url": "https://status.cloud.microsoft/" }
  ],
  "updates": [
    { "time": "2026-11-13T08:29:00+01:00", "source": "leverandor", "text": "…" },
    { "time": "2026-11-12T19:26:00+01:00", "source": "nitd", "text": "…" }
  ]
}
```

| Felt | Hendelse (`type: hendelse`) | Vedlikehold (`type: vedlikehold`) |
|---|---|---|
| `status` | `undersokes` · `handteres` · `overvakes` · `lost` | `planlagt` · `pagaende` · `fullfort` |
| Tider | `started` (når feilen startet), `detected` (når NITD ble kjent med den), `resolved` (påkrevd når `lost`) | `scheduledStart`, `scheduledEnd` (påkrevd), `started`/`resolved` valgfritt |

Hendelsesstatus følger fasene i NSMs grunnprinsipper for IKT-sikkerhet (v2.1, kap. 4) og
ISO/IEC 27001:2022 vedlegg A / ISO/IEC 27035 (B18):

| Status | Betyr | NSM | ISO 27001:2022 |
|---|---|---|---|
| Undersøkes | Hendelsen er registrert og vurderes | 4.2 Vurder og klassifiser hendelser | A.5.25 Vurdering og beslutning |
| Håndteres | Tiltak pågår | 4.3 Kontroller og håndter hendelser | A.5.26 Respons |
| Overvåkes | Tiltak er gjennomført, vi følger med | 4.3 (gjenoppretting) | A.5.26 Respons |
| Løst | Normal drift er gjenopprettet | – | – |
| *(ikke publisert)* | Evaluering i HaloPSA | 4.4 Evaluer og lær av hendelser | A.5.27 Læring |

`detected` gir sporbarhet (A.5.28) og er tidspunktet NIS2-fristene regnes fra
(tidlig varsel 24 t, melding 72 t, sluttrapport 1 mnd.). Om en hendelse er
«vesentlig» etter NIS2, er en intern vurdering som meldes til myndighetene. Den
står i HaloPSA og publiseres ikke.
| `source` i `updates` | `nitd` eller `leverandor` | samme |

Vedlikehold skifter status ut fra klokka ved hvert bygg: `planlagt` → `pagaende` ved
`scheduledStart` → `fullfort` ved `scheduledEnd`. Bare avlysning eller endret tidsrom
krever endring i fila.

Hendelsesloggen vises nyeste først. Gjennomgangen etter en hendelse skrives i
HaloPSA og publiseres ikke. Hendelsesfilen har ingen interne referanser (heller
ikke saksnummer i HaloPSA), siden alt i `data/` kan havne på nettet ved en feil.
Koblingen gjøres fra HaloPSA-saken til hendelsens URL.

### 4.4 Validering i bygget

Bygget stopper ved:

- ukjent tilstand, type eller status, manglende påkrevde felt
- tid uten tidssone, `resolved` før `started`, `scheduledEnd` før `scheduledStart`
- komponent-ID i en hendelse som ikke finnes i `status.json`, duplikat-ID
- filnavn som ikke følger `ÅÅÅÅ-MM-DD-navn.json`, eller dato som ikke stemmer med start
- lenker som ikke er `https://`
- HTML i tekstfelt (all tekst er ren tekst og escapes)
- e-postadresser og telefonnumre andre enn NITDs egne (personvern)
- ord fra `config/forbudte-ord.txt` (verktøy-, system- og kundenavn). Fila publiseres ikke.
  På siden brukes generiske navn: «Kundeportal», «Overvåking» og «helpdesksystemet».
- hemmeligheter: private nøkler, tokens (GitHub, AWS, Slack, JWT, API-nøkler),
  «passord:»/«token=» o.l., og lange tilfeldige strenger
- IP-adresser (IPv4 og IPv6) og interne vertsnavn (`.local`, `.lan`, `.internal`, `.corp` …)
- lenker og domener i tekst som ikke er NITDs eller en godkjent leverandørkilde
  (`ALLOWED_DOMAINS` i `scripts/lib/model.mjs`), og lenker med brukernavn/passord

Bygget **advarer** (stopper ikke) når en komponent ikke er normal uten at en
pågående hendelse peker på den, og når `nextUpdate` er passert.

## 5. Kilder

Verifisert 13. nov. 2026 fra skymiljø, uten innlogging. Detaljer i README.

| Leverandør | Offisiell kilde | Format | Vurdering |
|---|---|---|---|
| Microsoft 365 | `https://status.cloud.microsoft/api/posts/mac` og `/api/feed/mac` | JSON og RSS | **Verifisert.** Tider i UTC. Feeden har tittel, status («Service degradation» o.l.), tekst og «Next update by» i UTC, men **ikke** referansen (f.eks. `MO1550821`). Referansen hentes fra Microsoft 365 admin center og legges inn manuelt. |
| Uniweb | `https://status.uniweb.no` (Atlassian Statuspage): `/api/v2/summary.json`, `/history.rss`, `/history.atom` | JSON, RSS, Atom | **Verifisert.** Har egne komponenter for «Web hosting» og «E-mail» (med underkomponenter). Tidssone Europe/Amsterdam. |
| Zyxel | `https://www.nebulastatus.zyxel.com` (Atlassian Statuspage): `/api/v2/summary.json`, `/history.rss`, `/history.atom` | JSON, RSS, Atom | **Verifisert.** Gjelder bare Nebula (skytjenesten). Ikke brannmurer uten Nebula, firmware eller sårbarheter. Uten `www.` svarer adressen ikke. |
| Kundeportalen (HaloPSA, intern kilde) | `https://status.haloservicesolutions.com` (status.io), RSS: `/pages/63ef45da7ee94905308a1a4a/rss` | RSS | **Verifisert.** Kundeportalen kjører på HaloPSA. Verktøynavnet skal ikke stå på siden. Etter B11: brukes automatisk som `vendorStatus` på «Kundeportal», vist uten navn og lenke. |
| Sophos | `https://status.sophos.com` (oppgitt som offisiell statusside i Sophos' egen dokumentasjon) | Ukjent | **Ikke verifisert maskinelt.** Siden svarer 403 «Invalid request blocked» på automatiske kall fra skymiljøet. Vi omgår ikke sperren. Etter B10: `vendorStatus` er alltid `null`, siden viser fast lenke til status.sophos.com, og `observedStatus` settes bare når NITD ser en feil. Sophos Notification Service (SMS/e-post til enkeltpersoner, med reCAPTCHA) brukes ikke som kilde. Senere: test om siden svarer fra GitHub Actions med vanlige kall; gjør den det, tas den med i 7.1. |

Ikke brukt: Downdetector, StatusGator, isdown.app og lignende (tredjepart, skraping
eller innlogging).

Mapping fra leverandørstatus til våre tilstander (forslag, brukes i senere automatikk):

| Microsoft `Status` | Statuspage-komponent | Vår tilstand |
|---|---|---|
| Service restored, Post-incident report published, (ingen aktiv post) | `operational` | `operational` |
| Extended recovery, Service recovery | – | `recovering` |
| Investigating, Service degradation | `degraded_performance`, `partial_outage` | `degraded` |
| Service interruption | `major_outage` | `outage` |
| – | `under_maintenance` | vises som vedlikehold, `degraded` |

## 6. Første leveranse (denne PR-en)

- Denne planen, README, CLAUDE.md, SECURITY.md, Dependabot, `.gitignore`.
- Bygg med validering, forside, hendelsessider, arkiv, Atom-feed og 404.
- Komponenter: **Helpdesk og telefon, Kundeportal, Overvåking** og **Microsoft 365**.
  Sophos, Zyxel og Uniweb legges til i neste PR, når kildene over er godkjent.
- `_headers` med CSP uten `unsafe-inline`, HSTS og øvrige headere.
- CI: `sjekk` (bygg, validering, tester) og `Kvalitet (UU + Lighthouse)` med låste
  verktøy i `scripts/qa/package-lock.json` (ingen `npx`).
- Startdata: pågående Microsoft-hendelse (12.–13. nov.), overført fra
  `driftsstatus.json` på nettstedet. **Må oppdateres eller avsluttes før merge.**

## 7. Senere (planlagt, ikke bygget)

### 7.1 Automatisk henting fra leverandører

**Bygget (B20).** Leverandørstatus hentes når siden bygges (`scripts/lib/vendors.mjs`),
ikke via PR. Det erstatter PR- og automerge-løsningen i B16:

- Ingen workflow skriver til repoet, så unntak for ACT-02 og automerge trengs ikke.
- Bare tilstanden brukes, mappet etter tabellen i avsnitt 5. Leverandørens tekst publiseres ikke.
- Kilde nede eller ukjent svar → «Ukjent» på kortet, advarsel i byggeloggen, bygget fortsetter.
- Siden bygges på nytt annenhver time (`.github/workflows/bygg-jevnlig.yml`, B17) og ved
  hver endring i `main`. «Hentet kl. …» står på hvert kort.
- Ulempe: leverandørstatus lagres ikke i git. Historikken finnes hos leverandøren, og
  hendelser skrives som før i `data/hendelser/`.
- Tester og CI bygger med `--offline` (ingen nettkall). Produksjonsbygget i Cloudflare henter.

### 7.2 Sikkerhetsvarsler via webhook (Sophos, Zyxel, Microsoft)

Krever en Pages Function, altså et åpent endepunkt. **Bygges ikke før Johannes har
godkjent.** Minimumskrav:

- Signaturkontroll (HMAC med delt hemmelighet i Cloudflare-miljøet, eller
  leverandørens signaturordning) og tidsstempel med kort gyldighet mot gjentak.
- Rate limiting (Cloudflare-regel foran endepunktet) og maks størrelse på kroppen.
- Streng validering mot skjema. Ukjente felt avvises.
- Endepunktet publiserer aldri noe selv. Det lagrer et forslag (f.eks. som GitHub-issue
  eller PR via et token med minst mulig tilgang), og en person vurderer.
- Egen sti (`/hooks/<leverandør>`), egen logg uten personopplysninger, egen trusselvurdering.
- Sikkerhetsvarsler er ikke driftsstatus. De bør vises i egen seksjon eller ikke publiseres.

### 7.3 Andre

- Banneret på norskitdrift.no lenker hit (B9) og leser ikke egen status.
- **Bygg hver time (B17):** planlagt workflow kaller en Cloudflare deploy hook, slik at
  90-dagers arkivet og vedlikeholdsstatus oppdateres uten endringer i data.
  Hook-URL-en er en hemmelighet: GitHub-secret `CF_DEPLOY_HOOK_URL` i miljøet `production`
  (SCR-05), sendt inn via `env`, aldri skrevet til logg (ACT-11). Workflowen lages når
  Johannes har opprettet hooken og secreten, så den ikke feiler hver time før det.

## 8. Risiko

| Risiko | Konsekvens | Tiltak |
|---|---|---|
| **Samme leverandør i bunn.** Statussiden og nettstedet ligger begge hos Cloudflare (Pages og DNS for norskitdrift.no). | Ved feil hos Cloudflare går begge ned samtidig. | **Kjent svakhet, akseptert permanent** (Johannes, 13. nov. 2026). Ikke speil. Kontaktinfo (telefon) står også i signatur, avtaler og kundeportal. |
| Statussiden ligger under norskitdrift.no | Feil i DNS-sonen tar også statussiden | Som over. DNSSEC og to eiere på Cloudflare-kontoen. |
| Feil alarm fra egne målinger | Unødig uro hos kunder | B7: manuell vurdering før «Registrert av NITD». |
| Utdatert side under en hendelse | Tap av tillit | `nextUpdate` på hver hendelse, advarsel i bygget når den er passert, synlig «Sist oppdatert». |
| Leverandør melder ikke feil | Siden viser grønt mens kunder har problemer | `observedStatus` (vår egen «down detector»). |
| Personopplysninger eller interne navn i tekst | Brudd på GDPR / avsløring av interne systemer | Validering i bygget (4.4), gjennomgang i PR, ingen fritekst fra kunder. |
| Merge krever en person | Treg oppdatering midt i natten | Unntak for `data/`-endringer når Johannes har godkjent for hendelsen (CLAUDE.md). Byggetid < 1 min. |
| Kundeportalen (HaloPSA) er nede | Kunder kan ikke melde sak, og vi mister saksverktøyet under hendelsen | Telefon 69 81 10 00 står alltid på siden. Kundeportalen er egen komponent. |
| Sophos sperrer automatiske kall | Ingen automatisk leverandørstatus for Sophos | Fast lenke til Sophos' side, `observedStatus` ved feil (B10). |
| Leverandørstatus er manuell til automatikken (7.1) finnes | Microsoft-statusen kan bli utdatert | 7.1 prioriteres som neste leveranse. |
| GitHub Free: ingen håndhevet branch protection i private repoer | Direkte push til main mulig | Unntak i baseline (utløper 2027-01-15). Agenten pusher aldri til main. |
| Sårbarheter i testverktøy (lhci-avhengigheter) | Kun i CI, ikke på nettsiden | Dependabot for `scripts/qa`, samme som nettstedet. |

## 9. Åpne spørsmål til Johannes

1. ~~Godkjenne kildene, særlig Sophos.~~ **Besluttet (B10):** ingen manuell leverandørstatus; Sophos får fast lenke og bare «Registrert av NITD».
2. ~~Uniweb: én eller to komponenter.~~ **Besluttet (B12):** to komponenter.
3. ~~Zyxel: navn.~~ **Besluttet (B13):** «Zyxel Nebula».
4. ~~Akuttlinjen.~~ **Besluttet (B14):** alltid i kontaktboksen.
5. ~~Helpdesk-e-post.~~ **Besluttet (B15):** alle tre kanaler vises.
6. ~~Engelsk.~~ **Besluttet:** bare norsk.
7. ~~ACT-02 for automatisk PR.~~ **Erstattet (B20):** henting ved bygg, ingen unntak trengs.
8. ~~Daglig bygg.~~ **Besluttet (B17):** hver time.
9. ~~Speil hos annen leverandør.~~ **Besluttet:** ikke aktuelt. Cloudflare-avhengigheten aksepteres.
10. ~~Startdata.~~ **Besluttet:** Microsoft-hendelsen fra 12.–13. nov. blir liggende som
    første hendelse. Den oppdateres eller avsluttes før merge.

11. ~~Kundeportal og leverandørstatus.~~ **Besluttet (B11):** automatisk, uten navn og lenke.
12. ~~Forbudte ord.~~ **Besluttet:** generiske navn på siden («helpdesksystemet» o.l.), navneliste
    i `config/forbudte-ord.txt`, og mønstersjekk for hemmeligheter, IP-er, interne verter og
    ukjente domener. Johannes fyller på navnelisten ved behov.
13. ~~Microsoft-referanser.~~ **Besluttet:** MO/EX-nummer bare i hendelsesfila (`vendorRefs`),
    skrevet av den som lager hendelsen. Automatikken viser status og lenke uten nummer.

## 10. Oppgaver for Johannes (kan ikke gjøres av agenten)

1. Cloudflare Pages: nytt prosjekt koblet til `NITD-NO/nitd-status`.
   Build-kommando `node scripts/build.mjs`, output `dist`, produksjon `main`,
   miljøvariabel `NODE_VERSION=22`. Preview-adresser bak Cloudflare Access.
2. Eget domene `status.norskitdrift.no` på prosjektet.
3. Egne tokens med bare lesetilgang for statusrepoet. Ikke gjenbruk fra nettstedet.
4. Cloudflare deploy hook for produksjon, lagt som GitHub-secret `CF_DEPLOY_HOOK_URL`
   i miljøet `production` (B17). Si fra når den finnes, så lages workflowen.
6. Beskytt `main` (så langt GitHub Free tillater), installer Claude GitHub App på repoet,
   sett topic `nettside`, beskrivelse og homepage (SET-06).
