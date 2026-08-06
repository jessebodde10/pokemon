# Pokora

Upload foto's van je Pokémon-kaarten en ontvang een transparante collectieanalyse
met kaartnamen, geschatte marktwaarden en opvallende kaarten.

> Waarden en conditie-inschattingen zijn indicatief. Pokora is geen
> professionele taxateur of gradingdienst.

---

## Inhoud

- [Wat het product doet](#wat-het-product-doet)
- [Productprincipes in code](#productprincipes-in-code)
- [Functies](#functies)
- [Architectuur](#architectuur)
- [Installatie](#installatie)
- [Mockmodus](#mockmodus)
- [Supabase-configuratie](#supabase-configuratie)
- [Environment variables](#environment-variables)
- [Tests uitvoeren](#tests-uitvoeren)
- [Productiebuild](#productiebuild)
- [Provideradapters toevoegen](#provideradapters-toevoegen)
- [Onderhoud en retentie](#onderhoud-en-retentie)
- [Veiligheids- en privacykeuzes](#veiligheids--en-privacykeuzes)
- [Bekende beperkingen](#bekende-beperkingen)

---

## Wat het product doet

Eén kernflow, zo goed mogelijk uitgevoerd:

1. **Uploaden** — losse kaarten of binderpagina's (`/analyze`)
2. **Analyseren** — lokaliseren, herkennen, matchen, prijzen (`/analyze/[id]/processing`)
3. **Controleren** — jij bevestigt of corrigeert elke kaart (`/analyze/[id]/review`)
4. **Rapporteren** — bandbreedtes, bronnen, datakwaliteit (`/analyze/[id]/report`)

Ingelogde gebruikers bewaren analyses en bouwen een collectie op via `/dashboard`.

## Productprincipes in code

Deze principes zijn geen richtlijn maar constraint; ze zijn afgedwongen in code
en gedekt door tests.

| Principe                                | Waar het leeft                                                | Test                                |
| --------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| Nooit een verzonnen prijs               | `computePriceStatistics` geeft `null` onder `MIN_SAMPLE_SIZE` | `statistics.test.ts`                |
| Ontbrekende prijs is niet € 0           | `sumRanges` slaat `null` over in plaats van als 0 te tellen   | `totals.test.ts`                    |
| Alleen bevestigde kaarten in het totaal | `totalForConfirmedCards`                                      | `totals.test.ts`                    |
| Menselijke controle verplicht           | pipeline zet nooit `userConfirmed: true`                      | `analysis-flow.integration.test.ts` |
| Datakwaliteit zonder taalmodel          | `computeDataQuality` is een gewogen regelset                  | `data-quality.test.ts`              |
| AI-output is niet te vertrouwen         | `parseVisionResponse` valideert alles met Zod                 | `ai-output.test.ts`                 |
| Geen financieel advies                  | `collectAttentionReasons` beschrijft alleen de data           | `analysis-flow.integration.test.ts` |
| Autorisatie per analyse                 | `assertCanAccess`                                             | `analysis-access.test.ts`           |

Een concreet voorbeeld van hoe streng dit is: als het herkende kaartnummer de
kandidaat tegenspreekt, wordt de matchscore hard afgetopt onder de
auto-selectdrempel (`CONTRADICTED_NUMBER_CEILING`). Anders zou een kaart die op
naam, set, variant en taal klopt maar aantoonbaar de verkeerde print is, zichzelf
stilzwijgend in je collectie schrijven.

## Functies

**Gast**

- één analyse per 24 uur, maximaal 3 afbeeldingen
- volledige review- en rapportflow
- analyse verloopt automatisch na 24 uur

**Ingelogde gebruiker**

- 5 analyses per 24 uur, maximaal 10 afbeeldingen per analyse
- analyses bewaren en terugzien
- correcties opslaan, kaarten aan de collectie toevoegen
- analyses en foto's definitief verwijderen

## Architectuur

```text
src/
  app/                 routes, server actions, route handlers
  components/          ui/, upload/, analysis/, review/, report/, collection/, layout/
  features/            domeinlogica, puur en testbaar
    analysis/          beeldkwaliteit- en conditieheuristiek
    auth/              sessie- en requesterresolutie
    card-catalog/      gewogen matching
    pricing/           prijsstatistiek
    report/            totalen, datakwaliteit, aandachtspunten
  lib/                 errors, logging, validation, images, supabase, random
  providers/           detection/, recognition/, catalog/, pricing/ + registry
  repositories/        PokoraRepository + supabase/in-memory + storage
  services/            applicatieservices (orkestratie, autorisatie, state)
  types/               domein- en rapporttypes
  test/                testbootstrap en fixtures
```

De regel die de structuur draagt: **React-componenten bevatten geen
businesslogica.** Server actions in `src/app/**/actions.ts` valideren input,
lossen de requester server-side op en delegeren naar `src/services/*`. Services
gebruiken repositories en providers via hun interface, nooit via een concrete
implementatie.

### Vier vervangbare providers

```ts
interface CardDetectionProvider   { detectCards(imageUrl): Promise<DetectedCardRegion[]> }
interface CardRecognitionProvider { recognizeCard(input): Promise<CardRecognitionResult>
                                    recognizeImage?(url, ctx): Promise<...> }
interface CardCatalogProvider     { searchCards(query), getCardById(id) }
interface PricingProvider         { getPriceEstimate(input): Promise<PriceEstimate> }
```

`src/providers/registry.ts` kiest per provider onafhankelijk een implementatie en
valt individueel terug op de mock. Een ontbrekende prijssleutel legt de herkenning
dus niet plat.

### Ook de opslag is een adapter

Dit is de belangrijkste architectuurbeslissing van dit project. `PokoraRepository`
heeft twee implementaties:

- **Supabase** — zodra `NEXT_PUBLIC_SUPABASE_URL`, de anon key én de service-role
  key aanwezig zijn
- **In-memory** — anders

Daardoor draaien `pnpm dev`, `pnpm test` en `pnpm test:e2e` volledig zonder
externe dienst. De prijs is expliciet: de in-memory store is vluchtig en niet
geschikt voor productie. Zie [Bekende beperkingen](#bekende-beperkingen).

### Statusmachine

`created → uploading → processing → needs_review → completed`, met `failed` als
zijuitgang. Elke overgang loopt via `assertTransition`, zodat een dubbel
verzonden formulier of een verouderd tabblad luid faalt in plaats van de sessie
te corrumperen.

De voortgangsbalk leest de werkelijk opgeslagen pipelinestap. Er is geen timer en
geen animatie die losstaat van de backend: staat de backend stil, dan staat de
balk stil.

## Installatie

Vereist Node 20.11+ en pnpm 9.

```bash
pnpm install
```

```bash
cp .env.example .env.local
```

```bash
pnpm dev
```

De app draait op <http://localhost:3000>. Met een lege `.env.local` start hij in
volledige mockmodus — geen Supabase, geen API-sleutels, geen e-mailprovider.

## Mockmodus

`APP_MODE=mock` (de standaard) zet alle vier de providers op hun mock:

- `MockCardDetectionProvider` — deterministische kaartregio's
- `MockCardRecognitionProvider` — een gescript demodeck
- `MockCardCatalogProvider` — 26 duidelijk gemarkeerde demokaarten
- `MockPricingProvider` — gesimuleerde waarnemingen door dezelfde
  statistiekmodule als de echte adapters

De eerste afbeelding van elke analyse levert altijd hetzelfde demodeck op:
Charizard ex, Pikachu, Mew ex, Umbreon VMAX, Bulbasaur, een Charizard ex met lage
herkenningszekerheid, een onleesbare kaart, Mewtwo en Gengar ex. Umbreon VMAX
heeft opzettelijk te weinig prijswaarnemingen, zodat het pad "Onvoldoende
marktdata" altijd in de demo zichtbaar is.

Providerfouten simuleren:

```bash
DEV_FORCE_PROVIDER_ERROR=recognition
```

Geldige waarden: `none`, `detection`, `recognition`, `catalog`, `pricing`.

### Inloggen zonder e-mailprovider

Zonder Supabase en met `DEV_AUTH_FALLBACK=true` accepteert `/login` elk
e-mailadres en zet een lokaal ondertekend sessiecookie. De gebruiker-id is een
stabiele hash van het e-mailadres, dus je collectie overleeft een herstart. Deze
fallback wordt hard uitgeschakeld zodra `NODE_ENV=production`.

## Supabase-configuratie

1. Maak een project aan op supabase.com.
2. Zet `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Voer de migraties uit — via de Supabase CLI:

   ```bash
   supabase db push
   ```

   of plak `supabase/migrations/*.sql` in volgorde in de SQL-editor.

4. Zet in Auth → URL Configuration de redirect-URL op
   `{NEXT_PUBLIC_APP_URL}/api/auth/callback`.

Migratie `0003` maakt de private bucket `pokora-uploads` aan met een limiet van
10 MB en een MIME-allowlist. Zodra de drie variabelen staan, schakelt de app bij
de volgende start automatisch over op Supabase.

## Live providers aanzetten

De vier providers schakelen onafhankelijk van elkaar. `APP_MODE=live` is de
schakelaar die de `*_PROVIDER`-variabelen laat meetellen; met `APP_MODE=mock`
blijft alles mock, ongeacht wat er verder staat. Dat is bewust: de e2e-suite zet
`APP_MODE=mock` en raakt daardoor nooit een externe API.

### Catalogus en prijzen (werkt nu, zonder sleutel)

```env
APP_MODE=live
CARD_CATALOG_PROVIDER=pokemontcg
PRICING_PROVIDER=pokemontcg
CARD_CATALOG_API_KEY=
```

Dit levert echte kaartrecords en echte Cardmarket-prijzen. Twee dingen om te
weten:

- **Vraag een gratis sleutel aan op <https://dev.pokemontcg.io/>.** Anoniem is
  de API hard gelimiteerd: bij een handvol aanroepen achter elkaar komen er
  429's en 500's terug. De adapter vangt dat op met drie pogingen en backoff, en
  een kaart die alsnog niet op te zoeken is blijft gewoon op `pending` staan
  voor handmatige correctie — maar met sleutel gebeurt dit simpelweg niet.
- **De prijssnapshot van deze bron loopt achter.** Ten tijde van schrijven was
  de Cardmarket-update ruim 200 dagen oud. Het rapport toont dat eerlijk als
  "Bijgewerkt: N dagen geleden" plus een waarschuwing, en kapt de confidence af.

### Kaartherkenning (vereist jouw eigen sleutel)

```env
APP_MODE=live
AI_VISION_PROVIDER=anthropic
AI_VISION_API_KEY=sk-ant-...
AI_VISION_MODEL=claude-opus-5
```

of een OpenAI-compatibel endpoint:

```env
AI_VISION_PROVIDER=openai-compatible
AI_VISION_BASE_URL=https://mijn-endpoint/v1
AI_VISION_API_KEY=...
AI_VISION_MODEL=mijn-model
```

Zonder sleutel valt alleen de herkenning terug op de mock; catalogus en prijzen
blijven live. In de serverlog staat dan:

```text
Vision provider configured without API key; using mock
```

Supabase is hiervoor **niet** nodig. De pijplijn geeft de afbeeldingsbytes
rechtstreeks aan de provider mee (`RecognitionContext.loadImage`), dus de foto
hoeft niet vanaf het publieke internet bereikbaar te zijn.

## Environment variables

Alle variabelen zijn optioneel; `.env.example` documenteert ze volledig. De
belangrijkste:

| Variabele                       | Standaard  | Betekenis                                |
| ------------------------------- | ---------- | ---------------------------------------- |
| `APP_MODE`                      | `mock`     | `mock` of `live`                         |
| `NEXT_PUBLIC_SUPABASE_URL`      | leeg       | leeg ⇒ in-memory store                   |
| `SUPABASE_SERVICE_ROLE_KEY`     | leeg       | vereist voor de Supabase-repository      |
| `GUEST_MAX_IMAGES`              | `3`        | uploadlimiet gasten                      |
| `USER_MAX_IMAGES`               | `10`       | uploadlimiet ingelogd                    |
| `GUEST_DAILY_ANALYSIS_LIMIT`    | `1`        | _geslaagde_ analyses per 24 uur          |
| `USER_DAILY_ANALYSIS_LIMIT`     | `5`        | _geslaagde_ analyses per 24 uur          |
| `GUEST_DAILY_ATTEMPT_LIMIT`     | `5`        | pogingen per 24 uur, ongeacht uitkomst   |
| `USER_DAILY_ATTEMPT_LIMIT`      | `25`       | pogingen per 24 uur, ongeacht uitkomst   |
| `GUEST_ANALYSIS_TTL_HOURS`      | `24`       | bewaartermijn gastanalyses               |
| `ATTENTION_VALUE_THRESHOLD_EUR` | `25`       | drempel voor "verdient extra aandacht"   |
| `RATE_LIMIT_SALT`               | dev-waarde | **verplicht wijzigen in productie**      |
| `AI_VISION_PROVIDER`            | `mock`     | `mock`, `anthropic`, `openai-compatible` |
| `CARD_CATALOG_PROVIDER`         | `mock`     | `mock`, `pokemontcg`                     |
| `PRICING_PROVIDER`              | `mock`     | `mock`, `pokemontcg`                     |

`src/config/env.ts` parseert alles met Zod en gooit een fout zonder waarden te
loggen. Een ongeldige waarde valt terug op de standaard in plaats van de app te
laten crashen.

## Tests uitvoeren

```bash
pnpm test
```

137 unit- en integratietests. De integratietest draait de volledige serviceketen
— upload, pipeline, review, rapport, collectie — op de mockproviders en de
in-memory store, zonder de businesslogica te stubben.

```bash
pnpm test:e2e
```

Playwright bouwt de app productiegereed en doorloopt de hoofdflow: landing →
upload → analyse → review → bevestigen → rapport, inclusief de controle dat
"Onvoldoende marktdata" als tekst verschijnt en niet als bedrag.

Eerste keer:

```bash
pnpm test:e2e:install
```

## Productiebuild

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

```bash
pnpm start
```

## Provideradapters toevoegen

Een echte prijsbron toevoegen:

1. Implementeer `PricingProvider` in `src/providers/pricing/`.
2. Gebruik `computePriceStatistics` uit `src/features/pricing/statistics.ts` zodat
   de regels rond minimumaantal waarnemingen, uitschieters en recency-weging
   identiek blijven aan de rest van het systeem.
3. Voeg de naam toe aan de enum `PRICING_PROVIDER` in `src/config/env.ts`.
4. Registreer hem in `resolvePricing()` in `src/providers/registry.ts`.

Meer detail in [`docs/provider-integration.md`](docs/provider-integration.md).

**Scraping is geen optie.** De meegeleverde `PokemonTcgPricingProvider` leest de
Cardmarket-aggregaten die de publieke Pokémon TCG API zelf publiceert. Omdat die
bron aggregaten levert en geen losse waarnemingen, rapporteert de adapter
`sampleSize: 0` met een expliciete waarschuwing en een afgetopte confidence — in
plaats van een aantal te suggereren dat hij niet kent.

## Onderhoud en retentie

Verlopen gastanalyses opruimen:

```bash
pnpm maintenance:token
```

```bash
curl -X POST http://localhost:3000/api/maintenance/cleanup -H "x-maintenance-token: <token>"
```

Op Supabase kan dit ook via `pg_cron`; migratie `0003` bevat het commentaar met
het `cron.schedule`-statement.

## Veiligheids- en privacykeuzes

- **Uploadvalidatie op de bytes, niet op het label.** `inspectImage` leest de
  echte header. Een `.png` die in werkelijkheid PHP is, wordt geweigerd.
- **Bestandsnamen worden serverzijdig gegenereerd.** De originele naam wordt
  alleen getoond en nooit gebruikt om een pad te bouwen.
- **Private opslag met kortlopende signed URLs.** In dev serveert
  `/api/storage` bytes alleen bij een geldige HMAC-handtekening.
- **IP's worden nooit leesbaar opgeslagen.** Rate limiting gebruikt uitsluitend
  een gezouten HMAC van (guest token, IP).
- **Autorisatie server-side én RLS.** De dashboardroutes checken in de layout
  _en_ in elke dataloader; migratie `0002` zet RLS-policies als tweede laag.
- **Gastanalyses zijn alleen bereikbaar met het httpOnly guest token.**
  Een verlopen gastanalyse geeft "niet gevonden", niet "geen toegang" — dat
  voorkomt dat het bestaan van een sessie lekt.
- **Geen sleutels naar de client.** `src/config/env.ts` gooit als het per
  ongeluk in een client bundle belandt.
- **Logs redacteren zelf.** De logger vervangt alles dat op een sleutel, token of
  e-mailadres lijkt door `[redacted]`.
- **Gebruikers zien nooit een stack trace.** Elke `AppError` draagt een
  Nederlandse `userMessage`; het technische detail blijft op de server.

## Bekende beperkingen

Zie [`docs/mvp-limitations.md`](docs/mvp-limitations.md) voor de volledige lijst.
De belangrijkste:

- **De in-memory store is vluchtig.** Zonder Supabase verdwijnt alles bij een
  herstart. Prima voor demo en tests, niet voor productie.
- **De pipeline draait in het applicatieproces.** Geen externe queue, dus met
  meerdere instances is een lopende analyse niet hervatbaar. Bewuste
  MVP-afweging; de stap naar een queue staat beschreven in de docs.
- **Conditie wordt niet echt beoordeeld.** Bij een binderfoto blijft de conditie
  altijd `unknown`. Dat is geen tekortkoming maar een ontwerpkeuze.
- **Alleen ongeslabde Pokémon-kaarten.** Geen PSA/BGS/CGC, geen Magic, Yu-Gi-Oh!
  of One Piece.
- **De demodata zijn geen marktdata.** In mockmodus draagt elk bedrag de
  waarschuwing "Demodata: geen echte marktwaarnemingen".
- **De interface is Nederlandstalig.** De architectuur is voorbereid op
  meertaligheid, maar er is nog geen i18n-laag.

## Documentatie

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/data-model.md`](docs/data-model.md)
- [`docs/provider-integration.md`](docs/provider-integration.md)
- [`docs/recognition-pipeline.md`](docs/recognition-pipeline.md)
- [`docs/pricing-methodology.md`](docs/pricing-methodology.md)
- [`docs/mvp-limitations.md`](docs/mvp-limitations.md)

## Licentie

MIT — zie [`LICENSE`](LICENSE). Je mag de code vrij gebruiken, aanpassen en
verspreiden, ook commercieel, zolang de copyrightvermelding meegaat. De software
wordt geleverd zonder enige garantie.

De licentie dekt alleen deze broncode. Kaartnamen, setnamen en marktdata die de
app via externe bronnen ophaalt vallen daar niet onder; die blijven van hun
respectieve rechthebbenden.

---

Pokora is niet verbonden aan, en wordt niet gesteund door, de uitgevers of
rechthebbenden van de Pokémon-kaarten. Kaart- en setnamen worden uitsluitend
beschrijvend gebruikt.
