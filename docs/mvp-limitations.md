# MVP-beperkingen

Wat deze versie bewust niet doet, en waarom.

## Buiten scope, per specificatie

Niet ondersteund: Yu-Gi-Oh!, Magic: The Gathering, One Piece; geslabde kaarten
(PSA, Beckett, CGC); automatische koop- of verkoopbeslissingen; prijsvoorspelling;
automatisch inkopen; peer-to-peer verkoop; gradinggaranties.

## Technische afwegingen

### De in-memory store is vluchtig

Zonder Supabase draait alles op `Map`s in het geheugen. Data verdwijnt bij een
herstart.

_Waarom toch:_ zonder deze laag zou elke ontwikkelaar én elke CI-run een
Supabase-project nodig hebben om ook maar één test te draaien. Nu draaien
`pnpm dev`, `pnpm test` en de volledige e2e-flow zonder externe dienst, wat de
acceptatiecriteria eerlijk verifieerbaar maakt.

_Voor productie:_ zet de drie Supabase-variabelen. De app schakelt automatisch
over.

### De pijplijn draait in het applicatieproces

`startAnalysisInBackground` start een achtergrondtaak; een `Set` voorkomt dubbele
runs. Met meerdere instances is een lopende analyse niet hervatbaar: valt het
proces om, dan blijft de sessie op `processing` staan tot de gebruiker op
"opnieuw proberen" klikt.

_Waarom:_ de spec vroeg expliciet geen externe queue te bouwen voor de MVP.

_Migratiepad:_ de statusmachine en de per-stap-persistentie zijn er al op
voorbereid. Een queue toevoegen betekent: `startAnalysisInBackground` vervangen
door een job-enqueue, `runAnalysis` als worker draaien, en de stap uit
`status_detail` als hervattingspunt gebruiken. De rest van de code verandert
niet.

### Geen echte crops opgeslagen

`crop_storage_path` bestaat in het schema maar blijft `null`. De reviewkaartjes
tonen de uitsnede via CSS-transform op de originele foto (`RegionCrop`).

_Waarom:_ dat scheelt per kaart een afgeleid bestand plus de bijbehorende
opslag- en opruimlogica, en ziet er identiek uit.

_Consequentie:_ de vision-provider krijgt de volledige foto, niet een uitsnede.
Bij de eenpass-aanpak is dat juist gewenst.

### Beeldinspectie zonder native dependency

`src/lib/images/inspect.ts` leest de headers van JPEG, PNG en WEBP met de hand.

_Waarom:_ geen `sharp` of `libvips` nodig, dus geen build-complicaties.

_Beperking:_ alleen deze drie formaten, en alleen dimensies — geen resize,
rotatie of EXIF-oriëntatie. Een foto die staand is gemaakt maar liggend is
opgeslagen wordt niet automatisch gedraaid.

### Rate limiting telt sessies

Limieten worden afgeleid uit het aantal aangemaakte sessies in een rollend
venster van 24 uur.

_Beperking:_ een gebruiker die een sessie aanmaakt maar niets uploadt, verbruikt
toch quota.

_Waarom acceptabel:_ het maakt de limiet afdwingbaar zónder aparte
counter-infrastructuur, en het is het aanmaken van sessies dat we willen
beperken.

### Geen i18n-laag

De interface is volledig Nederlandstalig; teksten staan inline. Het domein is
taalonafhankelijk (codes zoals `AttentionReasonCode` en `DataQualityFactor.key`
zijn stabiele identifiers), dus een vertaallaag is later toe te voegen zonder de
logica te raken.

_Waarom:_ een i18n-framework toevoegen voor één taal levert alleen overhead.

### Auth-fallback in ontwikkeling

Zonder Supabase accepteert `/login` elk e-mailadres en zet een lokaal ondertekend
cookie. Hard uitgeschakeld zodra `NODE_ENV=production`.

_Waarom:_ anders is de hele ingelogde ervaring onbereikbaar zonder
e-mailprovider.

### Conditie blijft `unknown`

Bij een binderfoto is de conditie altijd `unknown`. Alleen een losse foto met
goede kwaliteit levert `possibly_near_mint` of `possibly_lightly_played`.

_Waarom:_ dit is geen tekortkoming maar het punt. Randen, hoeken, oppervlak en
achterkant zijn op een binderfoto simpelweg niet zichtbaar. Een conditieoordeel
geven zou schijnzekerheid zijn.

### Prijsbron levert aggregaten

`PokemonTcgPricingProvider` leest Cardmarket-aggregaten en kent het aantal
onderliggende waarnemingen niet. Hij rapporteert `sampleSize: 0` met een
waarschuwing en een confidence van maximaal 0.70.

_Beter:_ een bron met losse verkoopwaarnemingen, die dan door
`computePriceStatistics` kan.

### Demodata is geen marktdata

In mockmodus dragen alle bedragen de waarschuwing "Demodata: geen echte
marktwaarnemingen" en toont het rapport dat prominent. De demokaarten hebben
namen als "Scarlet & Violet 151 (demo)" en de artwork is een lokaal gegenereerde
SVG met het label "DEMO-AFBEELDING".

## Wat er als eerste bij zou moeten

1. **Externe queue** voor de pijplijn — de enige beperking die productiegebruik
   met meerdere instances echt in de weg zit.
2. **Prijsbron met losse waarnemingen**, zodat `sampleSize` en confidence echte
   betekenis krijgen.
3. **Losse voor- en achterkantfoto's per kaart**, waardoor de conditie-inschatting
   voor het eerst betekenisvol wordt.
4. **i18n**, te beginnen met Engels.
5. **Bulkacties in de review** ("bevestig alle matches boven 85%"), de duidelijkste
   ergonomiewinst bij een volle binderpagina.
