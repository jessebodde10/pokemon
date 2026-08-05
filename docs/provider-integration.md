# Provideradapters toevoegen

Alle externe systemen zitten achter vier interfaces in `src/providers/types.ts`.
Een adapter toevoegen raakt nooit een service of een component.

## Algemeen recept

1. Implementeer de interface in `src/providers/<soort>/`.
2. Voeg de naam toe aan de betreffende enum in `src/config/env.ts`.
3. Registreer hem in de bijbehorende `resolve*()` in
   `src/providers/registry.ts`.
4. Documenteer de nieuwe variabelen in `.env.example`.

De registry lost elke provider onafhankelijk op en valt individueel terug op de
mock. Ontbreekt een sleutel, dan gaat alleen díé provider naar mock.

## Regels waar elke adapter zich aan houdt

- **Gooi typed errors** (`CatalogProviderError`, `PricingProviderError`,
  `RecognitionProviderError`), nooit ruwe fetch-fouten.
- **Zet een timeout.** `AbortSignal.timeout(...)` op elke aanroep.
- **Valideer de respons met Zod.** Externe data is onbetrouwbare input.
- **Log geen payloads of sleutels.** De logger redacteert, maar geef hem geen
  reden.
- **Verzin niets.** Ontbrekende data is `null`, geen schatting.

## Prijsprovider

```ts
import { computePriceStatistics } from '@/features/pricing/statistics';

export class MyPricingProvider implements PricingProvider {
  readonly name = 'my-pricing';

  async getPriceEstimate(input: PricingRequest): Promise<PriceEstimate> {
    const observations = await this.fetchObservations(input.catalogCard);
    const stats = computePriceStatistics(observations);

    return {
      currency: 'EUR',
      low: stats.low,
      mid: stats.mid,
      high: stats.high,
      sampleSize: stats.sampleSize,
      sourceName: 'Mijn bron',
      sourceUrl: 'https://…',
      lastUpdatedAt: stats.newestObservationAt ?? new Date().toISOString(),
      conditionBasis: input.conditionBasis ?? 'ungraded',
      confidence: stats.confidence,
      warnings: stats.warnings,
    };
  }
}
```

Gebruik **altijd** `computePriceStatistics` wanneer je losse waarnemingen hebt.
Daarmee gelden overal dezelfde regels voor minimumaantal, uitschieters en
recency-weging, en gedraagt "onvoldoende data" zich identiek.

Lever je bron alleen aggregaten? Rapporteer dat dan eerlijk: `sampleSize: 0`,
een expliciete waarschuwing en een afgetopte confidence. Zie
`PokemonTcgPricingProvider`.

### Bronnen kiezen

Scrape geen website die dat niet toestaat. Gebruik gedocumenteerde API's met
expliciete gebruiksvoorwaarden en respecteer hun rate limits.

## Catalogusprovider

```ts
export class MyCatalogProvider implements CardCatalogProvider {
  readonly name = 'my-catalog';
  async searchCards(query: CardSearchQuery): Promise<CardCatalogResult[]> { … }
  async getCardById(id: string): Promise<CatalogCard | null> { … }
}
```

`searchCards` moet minimaal `name`, `cardNumber`, `setCode`, `setName` en
`pokedexNumber` ondersteunen — dat zijn de vier ingangen van de zoekdialoog plus
de setcode die de pijplijn gebruikt.

Zorg dat `cardNumber` het formaat `nummer/settotaal` heeft; de matcher splitst
daarop. Vul `variant` in waar mogelijk: zonder variant kan holo niet van reverse
holo worden onderscheiden en blijft de datakwaliteit laag.

`getCardById` retourneert `null` bij een onbekend id, en gooit alleen bij een
echte storing.

## Herkenningsprovider

```ts
export class MyVisionProvider implements CardRecognitionProvider {
  readonly name = 'my-vision';

  async recognizeImage(
    imageUrl: string,
    context: RecognitionContext,
  ): Promise<Array<CardRecognitionResult & { region: CardRegion }>> { … }

  async recognizeCard(input: CardRecognitionInput) { … }
}
```

Implementeer `recognizeImage` wanneer je model in één pass kan detecteren en
herkennen — dat is het voorkeurspad.

**Valideer de modeloutput altijd met `parseVisionResponse`.** Sla nooit iets op
dat niet door het Zod-schema is gekomen. Modellen produceren onder druk
plausibel ogende maar verzonnen kaartnummers; het schema plus de prompt-instructie
"never guess a card number" zijn samen de verdediging daartegen.

`RecognitionContext` geeft `{ imageId, imageIndex, loadImage }`. Storage paths
bevatten willekeurige bytes en zijn dus onbruikbaar als cachesleutel — gebruik
`imageId`.

**Gebruik `context.loadImage()` in plaats van de URL op te halen.** De pijplijn
leest de bytes rechtstreeks uit de opslag en geeft ze mee. Zou je in plaats
daarvan de signed URL fetchen, dan moet die vanaf het publieke internet
bereikbaar zijn — en dan is lokale ontwikkelopslag onbruikbaar en heb je een
gehoste bucket nodig alleen om het model de foto te laten zien. De
meegeleverde vision-adapter valt alleen terug op de URL als `loadImage`
ontbreekt.

### Een ander model configureren

```env
AI_VISION_PROVIDER=anthropic
AI_VISION_API_KEY=sk-...
AI_VISION_MODEL=claude-opus-5
```

of elk OpenAI-compatibel endpoint:

```env
AI_VISION_PROVIDER=openai-compatible
AI_VISION_BASE_URL=https://mijn-endpoint/v1
AI_VISION_API_KEY=...
AI_VISION_MODEL=mijn-model
```

De vision-adapter haalt de afbeelding zelf op via de signed URL en stuurt hem als
base64. Die URL moet dus bereikbaar zijn voor de provider: dat is het geval bij
Supabase Storage, maar niet bij de lokale ontwikkelopslag.

## Repository vervangen

`PokoraRepository` is óók een adapter. Voor een andere database: implementeer de
interface, registreer hem in `src/repositories/index.ts`. Let op de invarianten
die de services aannemen:

- `replaceDetectedCards` vervangt álle kaarten van een sessie en ruimt
  bijbehorende kandidaten en prijzen op;
- `listDetectedCards` sorteert op `position`, dan `id`;
- `savePriceEstimate` houdt één actuele schatting per kaart;
- `addCollectionItem` voegt samen op (user, card, condition) door `quantity` op
  te tellen;
- `deleteSession` cascadeert naar alles wat eruit is afgeleid.

## Testen

Elke adapter verdient minimaal:

- een test dat geldige data correct wordt gemapt;
- een test dat een misvormde respons een typed error geeft en niets opslaat;
- een test dat ontbrekende data `null` oplevert en geen verzonnen waarde.

Zie `ai-output.test.ts` voor het patroon bij onbetrouwbare externe input.
