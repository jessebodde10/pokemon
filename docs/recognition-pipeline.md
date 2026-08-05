# Herkenningspijplijn

Broncode: `src/services/analysis-pipeline.ts`.

## Zes stappen

Elke stap wordt op de sessie opgeslagen vóórdat de volgende begint. De
processing-pagina leest die stap; de voortgangsbalk kan dus niet vooruitlopen op
werk dat nog niet gedaan is.

| Stap | `status_detail`        | Wat er gebeurt                                |
| ---- | ---------------------- | --------------------------------------------- |
| 1    | `preparing_images`     | Beeldkwaliteitsscore per afbeelding           |
| 2    | `locating_cards`       | Kaartregio's bepalen                          |
| 3    | `recognising_cards`    | Naam, nummer, taal, variant lezen             |
| 4    | `matching_catalog`     | Kandidaten zoeken en wegen                    |
| 5    | `fetching_market_data` | Prijsschattingen ophalen                      |
| 6    | `building_report`      | Tellers bijwerken, status naar `needs_review` |

## Stap 1 — beeldkwaliteit

`computeImageQualityScore` combineert resolutie met gerapporteerde
waarschuwingen:

```text
resolutiescore = clamp((megapixels - 0.3) / 3.7, 0, 1)
score          = 0.35 + resolutiescore * 0.65
score         -= som van de waarschuwingsstraffen
```

Straffen: `blurry` 0.28, `low resolution` 0.25, `partially covered` 0.22,
`glare` 0.18, `dark` 0.15, `angle` 0.12, onbekend 0.08.

Deze score telt mee in de datakwaliteit en beïnvloedt de conditie-inschatting.

## Stap 2 en 3 — lokaliseren en herkennen

Twee paden, afhankelijk van de provider:

**Eén pass (voorkeur).** Ondersteunt de provider `recognizeImage`, dan levert één
aanroep alle regio's mét herkenning. Vision-modellen doen dit goedkoper en
nauwkeuriger dan los croppen. Zowel de mock als de vision-adapter gebruiken dit
pad, zodat mock en productie dezelfde code doorlopen.

**Twee passes (fallback).** Anders: `detectCards` levert regio's, daarna
`recognizeCard` per regio. Waarschuwingen van beide stappen worden samengevoegd.

De provider krijgt een `RecognitionContext { imageId, imageIndex }`. Storage
paths bevatten willekeurige bytes en zijn dus onbruikbaar als seed of
cachesleutel; de mock seedt op `imageIndex` en is daardoor reproduceerbaar.

### De vision-adapter vertrouwt het model niet

`VisionCardRecognitionProvider` is generiek: `anthropic` of elk
OpenAI-compatibel endpoint, via environment variables.

De systeemprompt eist puur JSON en verbiedt gissen:

> Only report what is actually legible. Use null when you cannot read a field.
> Never guess a card number.

De ruwe output gaat door `parseVisionResponse`:

1. `extractJsonObject` haalt het eerste gebalanceerde object eruit — modellen
   wikkelen JSON graag in proza of markdown-fences. Strings en escapes worden
   correct overgeslagen bij het tellen van accolades.
2. `JSON.parse`.
3. `visionResponseSchema` (Zod) valideert alles: coördinaten tussen 0 en 1,
   `x + width ≤ 1`, `y + height ≤ 1`, confidence tussen 0 en 1, taal in
   `en | nl | unknown`.

Faalt een stap, dan:

- wordt de fout gelogd **zonder** de modeloutput (foto's kunnen persoonlijke
  context bevatten en de payload is groot);
- wordt er niets opgeslagen;
- gaat de sessie naar `failed` met een begrijpelijke melding;
- worden de afbeeldingen op `needs_manual_review` gezet;
- krijgt de gebruiker een "opnieuw proberen"-knop.

Velden met een `.catch()` in het schema degraderen in plaats van te falen: een
onbekende taal wordt `unknown`, een te lange variantlijst wordt afgekapt. Alleen
structurele fouten zijn fataal.

## Stap 3b — onbekende kaarten

Levert de herkenning noch een naam noch een kaartnummer, dan start de kaart
direct als `unknown`. Er wordt geen catalogus bevraagd — zoeken op niets levert
willekeurige suggesties, en een willekeurige suggestie is erger dan geen.

## Stap 4 — matchen

Per kaart:

1. Zoek in de catalogus op naam + nummer (max 25 resultaten).
2. Levert dat niets op, zoek dan opnieuw op alleen de naam.
3. Weeg alle kandidaten met `rankCandidates`.
4. Bewaar de beste vijf met score en onderbouwing.
5. Ligt de beste boven `AUTO_SELECT_THRESHOLD` (0.62), preselecteer hem.

### Weging

| Factor        | Weging |
| ------------- | ------ |
| Kaartnummer   | 0.34   |
| Naam          | 0.30   |
| Set           | 0.16   |
| Variant       | 0.10   |
| Taal          | 0.06   |
| Uitgiftedatum | 0.04   |

Factoren waarover de input niets beweert, worden **overgeslagen** en hun weging
wordt herverdeeld. Een herkenning die alleen een naam kon lezen wordt dus niet
gestraft voor informatie die ze nooit geclaimd heeft.

### Het vetorecht van het kaartnummer

```ts
if (numberReason && numberReason.score === 0) {
  score = Math.min(score, CONTRADICTED_NUMBER_CEILING); // 0.5
}
```

Zonder deze aftopping haalde een kandidaat die klopt op naam, set, variant én
taal maar een aantoonbaar ander kaartnummer heeft, alsnog 0.66 — ruim boven de
auto-selectdrempel. Dat is precies de fout die stilzwijgend de verkeerde print in
een collectie schrijft. Een gelezen nummer dat tegenspreekt is een hard signaal.

Een afwijkend settotaal bij een kloppend nummer (`199/165` vs `199/197`) is
zwakker en scoort 0.6 in plaats van 0: dat komt vaak door herprints.

### Preselectie is geen bevestiging

`selectedCatalogCardId` wordt gezet, `userConfirmed` blijft `false`. Een
voorgeselecteerde kaart telt niet mee in het rapporttotaal totdat de gebruiker
hem bevestigt. Dit is afgedekt door een integratietest.

## Stap 5 — prijzen

Alleen voor kaarten met een geselecteerde match. Resultaten worden per
catalogus-id gecachet binnen de run, zodat drie exemplaren van dezelfde kaart één
aanroep kosten.

Faalt de prijsprovider, dan wordt een expliciete "geen data"-schatting opgeslagen
met een waarschuwing — de succesvolle herkenning gaat niet verloren omdat de
prijsbron plat lag.

## Stap 6 — afronden

Tellers bijwerken, afbeeldingen op `processed`, sessie naar `needs_review`,
`analysis_completed` in de audit log.

## Foutafhandeling

Faalt de pijplijn, dan gaat de sessie naar `failed` met een Nederlandse melding,
komen de afbeeldingen op `needs_manual_review`, en wordt `analysis_failed`
gelogd met alleen de foutcode. De gebruiker ziet nooit providerdetails.

## Uitvoeringsmodel

`startAnalysisInBackground` start de run zonder de server action te blokkeren.
Een `Set` van sessie-id's voorkomt dubbele runs.

Bewuste MVP-beperking: dit werkt binnen één applicatieproces. Met meerdere
instances is een lopende analyse niet hervatbaar. De spec vroeg expliciet geen
externe queue te bouwen tenzij noodzakelijk. Het migratiepad staat in
`mvp-limitations.md`.

## Handmatige correctie

Naast de automatische pijplijn:

- **`reanalyseCard`** — draait stap 4 opnieuw voor één kaart en zet hem terug op
  `pending`.
- **`changeCardMatch`** — kiest een andere kaart, markeert als `corrected` en
  haalt direct nieuwe prijsdata op.
- **`markCardUnknown`** — wist de selectie en zet de status op `unknown`.
- **`removeDetectedCard`** — verwijdert kaart, kandidaten en prijs.
