# Architectuur

## Uitgangspunt

Valtivo AI doet één ding: van foto's naar een controleerbaar collectierapport. De
architectuur is daaromheen gebouwd met twee harde regels:

1. **Businesslogica staat nooit in een React-component.** Componenten renderen;
   services beslissen.
2. **Alles wat buiten de applicatie ligt is een adapter.** Vision, catalogus,
   prijzen én opslag. Geen enkele service kent een concrete implementatie.

## Lagen

```text
app/            routes, server actions, route handlers
  ↓ roept aan
services/       orkestratie, autorisatie, statusovergangen
  ↓ gebruikt
features/       pure domeinlogica (matching, statistiek, rapport, kwaliteit)
repositories/   data-access interface + implementaties
providers/      externe systemen achter vier interfaces
```

Afhankelijkheden wijzen altijd naar beneden. `features/` importeert geen
repository en geen provider: het zijn pure functies over domeintypes, en daarom
uitputtend te testen zonder mocks.

## Requestflow

Een typische reviewactie:

```text
ReviewBoard (client component)
  → confirmCardAction        app/analyze/actions.ts   Zod-validatie, requester
  → confirmCardMatch         services/analysis-service.ts
      → loadCardForRequester → assertCanAccess        autorisatie
      → repository.updateDetectedCard                 persistentie
      → refreshSessionCounters                        afgeleide tellers
      → repository.recordEvent + trackEvent           audit + analytics
  ← ActionResult<T>                                   nooit een exception
```

Server actions retourneren een discriminated union in plaats van te gooien. De
client krijgt daardoor altijd een veilige Nederlandse melding en nooit een stack
trace.

## De vier providerinterfaces

Gedefinieerd in `src/providers/types.ts`, opgelost in `src/providers/registry.ts`.

| Interface                 | Mock                          | Echte adapter                   |
| ------------------------- | ----------------------------- | ------------------------------- |
| `CardDetectionProvider`   | `MockCardDetectionProvider`   | — (vision doet het in één pass) |
| `CardRecognitionProvider` | `MockCardRecognitionProvider` | `VisionCardRecognitionProvider` |
| `CardCatalogProvider`     | `MockCardCatalogProvider`     | `PokemonTcgCatalogProvider`     |
| `PricingProvider`         | `MockPricingProvider`         | `PokemonTcgPricingProvider`     |

De registry lost elke provider **onafhankelijk** op. Een ontbrekende
vision-sleutel zet alleen de herkenning terug op mock; catalogus en prijzen
blijven live. Dat voorkomt de klassieke faalmodus waarin één ontbrekende
configuratie de hele applicatie naar demomodus duwt zonder dat iemand het merkt.

### RecognitionContext

`recognizeImage(url, context)` krijgt naast de URL een `{ imageId, imageIndex }`.
Dat is geen decoratie: storage paths bevatten willekeurige bytes (bewust, zie
beveiliging), waardoor ze ongeschikt zijn als seed of cachesleutel. De mock seedt
op `imageIndex` en is daardoor reproduceerbaar; echte adapters gebruiken het voor
logcorrelatie of caching.

## Repository als adapter

`ValtivoRepository` heeft twee implementaties. De keuze valt bij de eerste
aanroep van `getRepository()`:

```text
Supabase URL + anon key + service-role key aanwezig  → SupabaseValtivoRepository
anders                                               → InMemoryValtivoRepository
```

Dezelfde splitsing bestaat voor `FileStorage` (`SupabaseFileStorage` /
`LocalFileStorage` / `InMemoryFileStorage` voor tests).

Deze keuze is bewust en heeft een prijs. De winst: `pnpm dev`, `pnpm test` en de
volledige e2e-flow draaien zonder enige externe dienst, wat de MVP eerlijk
verifieerbaar maakt. De prijs: de in-memory store is vluchtig en single-instance.
Zie `mvp-limitations.md`.

De Supabase-repository gebruikt de service-role key en omzeilt dus RLS. Dat mag,
omdat elke aanroep al door `assertCanAccess` is gegaan. RLS blijft bestaan als
tweede laag voor alles wat met een eindgebruiker-JWT bij Postgres aankomt.

## Statusmachine

`src/services/analysis-state.ts`.

```text
created ──▶ uploading ──▶ processing ──▶ needs_review ──▶ completed
   │            │              │              │               │
   └────────────┴──────────────┴──────────────┴───▶ failed ────┘
                                       (failed → uploading | processing)
```

Elke overgang loopt via `assertTransition`. Een ongeldige overgang levert een
`InvalidStateTransitionError` met HTTP 409 in plaats van een stille corruptie.

### Voortgang is afgeleid, niet gesimuleerd

`progressPercent(status, statusDetail)` rekent het percentage uit de werkelijk
opgeslagen pipelinestap. De processing-pagina pollt `/api/analysis/[id]/status`.
Er is geen enkele timer die de balk vooruit duwt: staat de backend stil, dan
staat de balk stil. Dat is een productprincipe, geen implementatiedetail.

## Rapportgeneratie

`generateCollectionReport(sessionId, requester)` in `src/services/report-service.ts`.

```text
1. autoriseer de sessie
2. laad kaarten, afbeeldingen, prijzen, catalogusrecords
3. bouw ReportCards            (unitValue → lineValue via quantity)
4. bereken datakwaliteit       computeDataQuality — vaste regels
5. selecteer aandachtskaarten  collectAttentionReasons — beschrijvend
6. tel totalen                 totalForConfirmedCards — alleen confirmed
7. verzamel waarschuwingen
8. stel de narrative samen     uit exact dezelfde berekende feiten
```

Stap 8 is het gevoeligste punt. De narrative is deterministisch opgebouwd uit de
cijfers van stap 3–7. Een taalmodel mag deze tekst later herformuleren, maar
krijgt dan uitsluitend deze feiten plus `reportNarrativeSchema` — het kan geen
bedrag, trend of kaartgegeven van zichzelf introduceren.

## Foutafhandeling

`src/lib/errors/app-error.ts` definieert typed errors met een code, een
HTTP-status en een Nederlandse `userMessage`.

```text
UploadValidationError            422  "Deze afbeelding kunnen we niet verwerken…"
AnalysisNotFoundError            404  "Deze analyse bestaat niet meer…"
UnauthorizedAnalysisAccessError  403  "Je hebt geen toegang tot deze analyse."
RecognitionProviderError         502  "We konden een deel van de kaarten niet…"
CatalogProviderError             502  "De kaartcatalogus is tijdelijk niet…"
PricingProviderError             502  "We konden de marktinformatie nu niet…"
InsufficientPricingDataError     200  "Onvoldoende marktdata…"
RateLimitedError                 429  contextafhankelijk
InvalidStateTransitionError      409  "Deze actie is in de huidige status…"
```

`InsufficientPricingDataError` heeft bewust status 200: te weinig data is een
geldige uitkomst, geen storing.

## Analytics

`src/services/analytics.ts` definieert één interface met twee implementaties
(console, noop). Events dragen alleen aantallen en identifiers die we zelf
beheren — nooit e-mailadressen, bestandsnamen of beeldinhoud. `trackEvent` vangt
zijn eigen fouten: analytics mag nooit een gebruikersflow breken.

## Waarom geen TanStack Query

De spec noemde het "indien dat duidelijk voordeel geeft". Er is precies één
pollende view (processing) en die heeft één endpoint zonder cache-invalidatie,
zonder gedeelde state en zonder optimistic updates. Een `useEffect` met een
timeout doet dat in twintig regels. De extra dependency zou hier niets oplossen
dat er is.
