# Datamodel

Migraties: `supabase/migrations/0001_initial_schema.sql`,
`0002_row_level_security.sql`, `0003_storage_and_retention.sql`.

## Overzicht

```text
auth.users
   │
   ├── profiles            (1:1)
   ├── analysis_sessions   (1:n)  ──┬── analysis_images        (1:n)
   │                                ├── detected_cards         (1:n)
   │                                └── audit_events           (1:n)
   └── collection_items    (1:n)

detected_cards ──┬── card_match_candidates (1:n, max 5)
                 └── price_estimates       (1:1 actueel)

catalog_cards  ← gedeelde referentiedata, geen eigenaar
```

Deletes cascaderen naar beneden vanaf `analysis_sessions`. Een analyse
verwijderen verwijdert dus werkelijk alles wat eruit is afgeleid.

## Tabellen

### `profiles`

`id` (FK `auth.users`), `display_name`, `locale`, `created_at`, `updated_at`.

### `analysis_sessions`

De centrale tabel. Twee constraints doen het echte werk:

```sql
constraint analysis_sessions_owner_check check (
  (user_id is not null and guest_token is null)
  or (user_id is null and guest_token is not null)
)
```

Een sessie heeft één eigenaar — een gebruiker óf een gasttoken, nooit beide en
nooit geen. Dat maakt de autorisatielogica in `assertCanAccess` een
tweewegssplitsing zonder randgevallen.

```sql
constraint analysis_sessions_guest_expiry_check check (
  user_id is not null or expires_at is not null
)
```

Een gastsessie zónder vervaldatum kan niet bestaan. Retentie is daarmee een
schema-eigenschap in plaats van een belofte in applicatiecode.

`owner_hash` is een gezouten HMAC van (user id, guest token, IP) en dient
uitsluitend voor rate limiting. Er staat geen leesbaar IP-adres in de database.

`status_detail` bevat de huidige pipelinestap, waaruit de voortgangsbalk wordt
afgeleid.

### `analysis_images`

`storage_path` is een serverzijdig gegenereerd pad (`{sessionId}/{32 hex}.ext`).
`original_filename` bestaat alleen om te tonen. Een MIME-check op databaseniveau
weigert alles buiten JPEG/PNG/WEBP.

`quality_warnings` (jsonb) en `quality_score` voeden de datakwaliteitsberekening.

### `detected_cards`

```sql
position integer not null default 0
```

Dit veld verdient toelichting, want het is er ná een testfout gekomen. Kaarten
worden in één batch ingevoegd: ze delen `created_at` tot op de milliseconde en
dragen willekeurige UUID's. Sorteren op `(created_at, id)` gaf daardoor een
volgorde die per run verschilde — de reviewlijst zou bij elke refresh kunnen
herschikken. `position` is de expliciete ordinale positie die de pipeline
toekent (afbeelding na afbeelding, regio na regio).

`review_status` is `pending | confirmed | corrected | unknown | removed`.
`user_confirmed` staat los daarvan en wordt **nooit** door de pipeline op `true`
gezet: dat is per definitie een menselijke handeling.

`condition_estimate` staat standaard op `unknown` en blijft dat bij een
binderfoto.

### `card_match_candidates`

Maximaal vijf per kaart, met `rank` (0 = beste), `match_score` en
`match_reasons` (jsonb). De reasons bevatten per factor de score, de weging en
een Nederlandse toelichting, zodat de UI kan uitleggen _waarom_ een kaart is
voorgesteld.

`unique (detected_card_id, catalog_card_id)` voorkomt dubbele kandidaten.

### `catalog_cards`

Gedeelde referentiedata met een tekst-id (het externe id van de bron), zodat een
kaart uit twee analyses hetzelfde record deelt. Geïndexeerd op `lower(name)`,
`card_number`, `(set_code, card_number)` en `pokedex_number` — precies de vier
zoekingangen van de zoekdialoog.

### `price_estimates`

```sql
low_value numeric(12,2),   -- nullable
mid_value numeric(12,2),   -- nullable
high_value numeric(12,2)   -- nullable
```

Nullable is hier de hele kern. "Geen data" moet onderscheidbaar blijven van
"waarde 0"; zou dit `not null default 0` zijn, dan zou elk totaal er
gezaghebbend uitzien en systematisch te laag zijn.

```sql
constraint price_estimates_band_order check (
  low_value is null or high_value is null or low_value <= high_value
)
```

`sample_size`, `source_name`, `source_updated_at`, `confidence` en `warnings`
worden allemaal in de UI getoond. Transparantie is een schema-eis, geen
UI-keuze.

### `collection_items`

`unique (user_id, catalog_card_id, condition_estimate)` — dezelfde kaart in
dezelfde staat wordt samengevoegd door `quantity` op te tellen in plaats van een
tweede rij te maken.

### `audit_events`

Append-only. Alleen leesbaar voor de eigenaar; schrijven gaat uitsluitend via de
service-role, zodat een client geen audittrail kan vervalsen.

## Row level security

Migratie `0002` zet RLS aan op alle tabellen.

De applicatie gebruikt de service-role key en omzeilt RLS — autorisatie gebeurt
in `assertCanAccess`. RLS is de tweede laag: alles wat met een
eindgebruiker-JWT bij Postgres aankomt (dashboard, toekomstige client SDK) ziet
alleen eigen rijen.

`owns_analysis_session(uuid)` is een `stable security definer`-functie die de
policies op afgeleide tabellen kort en index-vriendelijk houdt.

**Gastanalyses zijn via RLS niet bereikbaar.** Dat is opzet: een gasttoken zit in
een httpOnly cookie en wordt alleen server-side gecontroleerd. Er is geen
JWT-claim waarmee een gast rechtstreeks bij Postgres zou kunnen.

## Opslag

Migratie `0003` maakt de bucket `pokora-uploads` aan: `public = false`, limiet
10 MB, MIME-allowlist. Er zijn géén storage-policies voor `anon` of
`authenticated` — objecten zijn uitsluitend bereikbaar via signed URLs die de
server aanmaakt nadat hij het verzoek heeft geautoriseerd.

## Retentie

`delete_expired_guest_analyses()` verwijdert verlopen gastsessies en geeft de
bijbehorende `storage_path`-waarden terug, zodat de aanroeper ook de bestanden
kan opruimen. Te plannen via `pg_cron` of via
`POST /api/maintenance/cleanup`.

`touch_updated_at()`-triggers houden `updated_at` bij op `profiles`,
`analysis_sessions`, `detected_cards`, `catalog_cards` en `collection_items`.

## In-memory equivalent

`InMemoryPokoraRepository` implementeert dezelfde interface met `Map`s op
`globalThis` (zodat hot reload een lopende analyse niet wist). Het respecteert
dezelfde invarianten: cascade bij delete, samenvoegen van collectie-items,
sorteren op `position`. De audit-buffer is begrensd op 5000 events zodat een
langlopende devserver geen geheugen lekt.
