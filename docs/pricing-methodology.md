# Prijsmethodologie

Broncode: `src/features/pricing/statistics.ts`. Volledig deterministisch en
uitputtend getest in `statistics.test.ts`.

## Uitgangspunt

Een verzamelaar die een bedrag ziet, gelooft dat bedrag. Daarom is de bovenste
regel van deze module: **liever geen getal dan een zwak onderbouwd getal.**

Alle bedragen zijn schattingen met een bandbreedte, altijd met bron, datum en
aantal waarnemingen erbij.

## Van waarnemingen naar bandbreedte

`computePriceStatistics(observations, now)`:

```text
1. filter ongeldige waarden        (niet-eindig of ≤ 0)
2. filter op leeftijd              > 180 dagen valt af
3. filter uitschieters             Tukey 1.5 × IQR
4. controleer het minimum          < 3 bruikbare waarnemingen ⇒ null
5. low  = 25e percentiel
   high = 75e percentiel
   mid  = recency-gewogen mediaan
6. bereken confidence en waarschuwingen
```

### Waarom een interkwartielafstand

Min/max zou de band laten bepalen door de twee extreemste listings. Q1–Q3 vangt
de middelste helft van de markt: één optimistische verkoper kan de bovenkant
niet in zijn eentje omhoog trekken.

### Waarom een gewogen mediaan

Het gemiddelde is te gevoelig voor uitschieters. De mediaan negeert recentheid.
De recency-gewogen mediaan doet beide goed: elke waarneming krijgt gewicht
`0.5 ^ (leeftijd / 45 dagen)` en de mid-waarde is de waarde waar het cumulatieve
gewicht 50% passeert.

Een halfwaardetijd van 45 dagen betekent dat een waarneming van drie maanden
geleden een kwart meetelt van een waarneming van vandaag. Verschuift de markt,
dan volgt `mid` binnen weken zonder op één recente verkoop te springen.

### Uitschieterfiltering

Tukey-hekken op 1.5 × IQR. Onder de vier waarnemingen wordt niets verwijderd:
met zo weinig data is er geen basis om iets een uitschieter te noemen.

### Het minimum van drie

Onder drie bruikbare waarnemingen:

```ts
{ low: null, mid: null, high: null, confidence: 0,
  warnings: ['Onvoldoende marktdata: 2 van minimaal 3 bruikbare waarnemingen'] }
```

De UI toont dan "Onvoldoende marktdata". Het rapport telt zo'n kaart **niet** als
€ 0 mee, meldt hem apart, en zet hem in "Verdient extra aandacht".

## Confidence

```text
sampleScore  = min(1, aantal / 30)
spreadScore  = max(0, 1 - relatieveSpreiding / 0.8)      (null ⇒ 0.5)
recencyScore = max(0, 1 - leeftijdNieuwste / 90)

confidence = 0.40 × sampleScore + 0.35 × spreadScore + 0.25 × recencyScore
```

Deze score staat los van de herkenningszekerheid en wordt apart getoond.

## Waarschuwingen

Automatisch toegevoegd bij: verwijderde uitschieters, weggelaten oude
waarnemingen, een relatieve spreiding boven 0.6 ("De gevonden prijsdata lopen
sterk uiteen"), en een nieuwste waarneming ouder dan 60 dagen.

## Conditiebasis

Standaard `ungraded`:

> Prijsindicatie op basis van ongeslabde exemplaren in vergelijkbare, niet
> professioneel beoordeelde staat.

Alleen bij een losse foto met goede kwaliteit wordt `near_mint_assumed`
gebruikt. Er wordt nooit een gradingresultaat voorspeld.

## Van eenheid naar regel naar totaal

```text
unitValue  = wat de provider teruggaf (per exemplaar)
lineValue  = unitValue × quantity        null blijft null
totaal     = som van lineValue over uitsluitend confirmed/corrected kaarten
```

`sumRanges` slaat `null` over in plaats van als 0 te tellen. Het totaal is
daardoor altijd "minstens dit", nooit een gok over de ontbrekende kaarten. Het
aantal kaarten zonder prijsdata staat expliciet in de samenvatting.

## Adapters

### `MockPricingProvider`

Genereert deterministische waarnemingen uit een ankerprijs per demokaart en
draait ze door **dezelfde** statistiekmodule. "Onvoldoende data" gedraagt zich in
mockmodus dus exact zoals in productie. Umbreon VMAX krijgt bewust maar twee
waarnemingen, zodat dat pad altijd zichtbaar is in de demo. Elke schatting draagt
de waarschuwing "Demodata: geen echte marktwaarnemingen".

### `PokemonTcgPricingProvider`

Leest de Cardmarket-aggregaten die de publieke Pokémon TCG API zelf publiceert.
Geen scraping — de waarden zijn onderdeel van de gedocumenteerde API-respons en
staan al in euro's.

Deze bron publiceert aggregaten, geen losse waarnemingen. De adapter is daar
eerlijk over:

- `sampleSize: 0` met de waarschuwing dat het aantal waarnemingen niet
  beschikbaar is;
- confidence afgetopt op 0.70, omdat we zonder waarnemingsaantal niet meer kunnen
  claimen;
- reverse-holo-varianten gebruiken de bijbehorende reverse-holo-velden.

Mapping: `low = lowPrice`, `mid = trendPrice ?? averageSellPrice`,
`high = max(avg30, avg7, averageSellPrice, mid)`. Ontbreekt `mid`, dan geldt het
resultaat als "geen data".

## Wat hier bewust níét gebeurt

- **Geen prijsvoorspelling.** Geen trendlijnen, geen verwachte waarde.
- **Geen rendementsgrafieken.** Het dashboard toont verdeling, geen
  waardeontwikkeling over tijd.
- **Geen koop- of verkoopadvies.** "Verdient extra aandacht" beschrijft
  uitsluitend eigenschappen van de data.
- **Geen scraping.** Alleen bronnen die hun data zelf publiceren voor gebruik.
