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
      "name": "Egne tjenester",
      "components": [
        {
          "id": "helpdesk",
          "name": "Helpdesk og telefon",
          "description": "Kort forklaring av hva komponenten er.",
          "vendorStatus": null,
          "observedStatus": { "state": "degraded", "note": "…", "updated": "…" }
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
          "vendor": { "name": "Microsoft", "statusUrl": "https://status.cloud.microsoft/" },
          "vendorStatus": {
            "state": "degraded",
            "note": "Kort, norsk sammendrag av det Microsoft melder.",
            "refs": ["MO1550821"],
            "url": "https://status.cloud.microsoft/",
            "updated": "2026-11-13T07:29:09Z"
          },
          "observedStatus": { "state": "operational", "note": "", "updated": "…" }
        }
      ]
    }
  ]
}
```

Regler:

- `vendorStatus` er det leverandøren selv melder: tilstand, lenke og leverandørens
  referanse. `null` for egne tjenester og for leverandører uten offentlig kilde.
- `observedStatus` er det NITD selv ser (saker fra flere kunder, egne målinger).
  Settes manuelt etter vurdering (B7).
- Siden viser **den dårligste** av de to og skriver kilden:
  - leverandøren verst → «Meldt av leverandør»
  - NITD verst → «Registrert av NITD»
  - like, og ikke normal → «Meldt av leverandør og registrert av NITD»
  - begge normale → ingen kildetekst
- Samlet status øverst er den dårligste komponenten: «Alle tjenester virker normalt»,
  «Noen tjenester er redusert», «Noen tjenester er i bedring» eller «Driftsstans».

### 4.3 `data/hendelser/ÅÅÅÅ-MM-DD-kort-navn.json`

Datoen i filnavnet er startdatoen (norsk tid). Filnavnet uten `.json` er hendelsens
`id` og URL. Bygget stopper hvis de ikke stemmer.

```json
{
  "type": "hendelse",
  "title": "Forstyrrelser i Microsoft 365 (e-post)",
  "status": "pagaende",
  "components": ["microsoft-365", "helpdesk"],
  "started": "2026-11-12T19:26:00+01:00",
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
| `status` | `pagaende` · `overvakes` · `lost` | `planlagt` · `pagaende` · `fullfort` |
| Tider | `started`, `resolved` (påkrevd når `lost`) | `scheduledStart`, `scheduledEnd` (påkrevd), `started`/`resolved` valgfritt |
| `source` i `updates` | `nitd` eller `leverandor` | samme |

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
- ord fra `config/forbudte-ord.txt` (interne system- og verktøynavn, kundenavn).
  Fila fylles av NITD og publiseres ikke.

Bygget **advarer** (stopper ikke) når en komponent ikke er normal uten at en
pågående hendelse peker på den, og når `nextUpdate` er passert.

## 5. Kilder

Verifisert 13. nov. 2026 fra skymiljø, uten innlogging. Detaljer i README.

| Leverandør | Offisiell kilde | Format | Vurdering |
|---|---|---|---|
| Microsoft 365 | `https://status.cloud.microsoft/api/posts/mac` og `/api/feed/mac` | JSON og RSS | **Verifisert.** Tider i UTC. Feeden har tittel, status («Service degradation» o.l.), tekst og «Next update by» i UTC, men **ikke** referansen (f.eks. `MO1550821`). Referansen hentes fra Microsoft 365 admin center og legges inn manuelt. |
| Uniweb | `https://status.uniweb.no` (Atlassian Statuspage): `/api/v2/summary.json`, `/history.rss`, `/history.atom` | JSON, RSS, Atom | **Verifisert.** Har egne komponenter for «Web hosting» og «E-mail» (med underkomponenter). Tidssone Europe/Amsterdam. |
| Zyxel | `https://www.nebulastatus.zyxel.com` (Atlassian Statuspage): `/api/v2/summary.json`, `/history.rss`, `/history.atom` | JSON, RSS, Atom | **Verifisert.** Gjelder bare Nebula (skytjenesten). Ikke brannmurer uten Nebula, firmware eller sårbarheter. Uten `www.` svarer adressen ikke. |
| Kundeportalen (HaloPSA, intern kilde) | `https://status.haloservicesolutions.com` (status.io), RSS: `/pages/63ef45da7ee94905308a1a4a/rss` | RSS | **Verifisert.** Kundeportalen kjører på HaloPSA. Verktøynavnet skal ikke stå på siden, så kilden brukes **bare internt** som grunnlag for `observedStatus` på «Kundeportal». Ingen lenke dit fra siden. Se åpent spørsmål 11. |
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

### 7.1 Automatisk henting fra leverandører (GitHub Actions → PR)

- Planlagt workflow (f.eks. hvert 10. minutt i arbeidstid, hvert 30. ellers) henter
  Microsoft, Uniweb og Zyxel, mapper status etter tabellen over og oppdaterer
  **bare `vendorStatus`** i `status.json`. Endring → PR med kort norsk sammendrag.
- Aldri `observedStatus`, aldri merge (B7, BRA-01).
- Tillatelser: `contents: write` og `pull-requests: write` kun i den jobben. Krever at
  ACT-02 (workflows kan ikke opprette PR) får et registrert unntak, **eller** at
  PR-en lages av Claude-økten. Beslutning hos Johannes.
- Ingen secrets trengs: alle kilder er offentlige.

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
- Daglig bygg (Cloudflare deploy hook fra en planlagt workflow) slik at 90-dagers
  arkivet og planlagt vedlikehold oppdateres også uten endringer i data.
  Deploy hook-URL-en er en hemmelighet og legges som GitHub-secret.

## 8. Risiko

| Risiko | Konsekvens | Tiltak |
|---|---|---|
| **Samme leverandør i bunn.** Statussiden og nettstedet ligger begge hos Cloudflare (Pages og DNS for norskitdrift.no). | Ved feil hos Cloudflare går begge ned samtidig. | **Kjent svakhet, akseptert nå.** Senere: vurder speil hos en annen leverandør og/eller statusdomene i en annen DNS-sone. Kontaktinfo (telefon) står også i signatur, avtaler og kundeportal. |
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
2. **Uniweb**: én komponent «Uniweb (webhotell og e-post)» som i oppgaven, eller to?
   Forslag: én komponent, som viser den dårligste av Uniwebs «Web hosting» og «E-mail».
3. **Zyxel**: holder det at komponenten gjelder Nebula, eller skal den hete «Zyxel Nebula»?
4. **Akuttlinjen**: skal «trykk 9» (aktiv trussel) vises ved hendelser, som på nettstedet?
5. **Helpdesk-e-post**: skal `helpdesk@nitd.no` stå på siden, eller bare telefon og kundeportal
   (som i oppgaven)? Utkastet bruker bare telefon og kundeportal.
6. **Engelsk**: trengs en engelsk versjon eller oppsummering?
7. **ACT-02** for automatisk PR fra workflow (7.1): unntak, eller skal Claude-økten lage PR-ene?
8. **Daglig bygg** med deploy hook (7.3): ja/nei.
9. **Speil hos annen leverandør** (risiko 1): når skal det vurderes?
10. **Startdata**: skal Microsoft-hendelsen fra 12.–13. nov. ligge med som første
    hendelse (sporbarhet), eller starter vi tomt?

11. **Kundeportal og leverandørstatus**: kundeportalen er HaloPSA. Forslag: komponenten
    står under «Egne tjenester» med `vendorStatus: null`, og HaloPSA-feeden brukes bare
    internt. Alternativ: vise «Meldt av leverandør» uten navn og lenke. Hva foretrekker du?
12. **Forbudte ord**: hvilke interne system- og verktøynavn skal i `config/forbudte-ord.txt`
    (i dag bare «HaloPSA»)? Navnet på overvåkingsverktøyet bør inn.
13. **Microsoft-referanser**: feeden mangler MO/EX-nummer. Skal vi vise referansen (krever
    manuell innlegging fra admin center), eller bare lenke til Microsofts statusside?

## 10. Oppgaver for Johannes (kan ikke gjøres av agenten)

1. Cloudflare Pages: nytt prosjekt koblet til `NITD-NO/nitd-status`.
   Build-kommando `node scripts/build.mjs`, output `dist`, produksjon `main`,
   miljøvariabel `NODE_VERSION=22`. Preview-adresser bak Cloudflare Access.
2. Eget domene `status.norskitdrift.no` på prosjektet.
3. Egne tokens med bare lesetilgang for statusrepoet. Ikke gjenbruk fra nettstedet.
4. Beskytt `main` (så langt GitHub Free tillater), installer Claude GitHub App på repoet,
   sett topic `nettside`, beskrivelse og homepage (SET-06).
