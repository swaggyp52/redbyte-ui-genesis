# DATA_SOURCES

## Roles (frozen)

| Order | Source | Role | Badge |
|---|---|---|---|
| 1 | Her saved foods (versioned) | Daily logging, offline, aliases, pins | Your label / Your recipe |
| 2 | USDA FoodData Central | Deliberate online text search (`mode=online`) | USDA |
| 3 | Open Food Facts | Barcode lookup only, never search-as-you-type | Product database |
| always | Label / custom entry | Missing products, corrections, recipes | Your label |

The server (`apps/server/src/services/search.ts`) is the only outbound caller. It sends the search term or barcode only. Hosts are allow-listed (`providers/http.ts`): `api.nal.usda.gov`, `world.openfoodfacts.org`, HTTPS only, 5 s timeout, no redirects.

## Throttles and cache
- USDA: token bucket 30 burst, refill 200/hour (documented quota 1,000/hour/IP). Search results cached 7 days by normalized query.
- OFF: bucket 5 burst, refill 10/minute (documented 15 reads/minute/IP). Products cached 30 days; not-found cached 1 day.
- 429/503 honour `Retry-After`, otherwise hold 60 s. No automatic retry storms.
- User-Agent: `DailyPlate/<version> (private family food journal; contact: <DP_PROVIDER_CONTACT>)`. Set `DP_PROVIDER_CONTACT` on the Pi.

## Normalization (`normalizationVersion`)

### USDA `usda-1` (`providers/usda.ts`)
- Nutrient numbers: 203 protein, 204 fat, 205 carbohydrate by difference, 291 fiber, 269 or 2000 total sugars, 208 (fallback 957/958) energy kcal. Unit must be G / KCAL or the value is ignored.
- Basis: per 100 g; `servingSizeUnit` ml/MLT → per 100 ml with a warning.
- Portion: `servingSize` + `householdServingFullText` → one named portion in g or ml.
- Preparation inferred from words in the description (raw, cooked/roasted/boiled/grilled/baked, dry/uncooked, prepared, drained).
- Missing → `unknown`. Barcodes from `gtinUpc` kept as strings.

### Open Food Facts `off-1` (`providers/off.ts`)
- v3 product read with an explicit `fields` list; found when `status` is `success`/`success_with_warnings`/`1` and `product` exists.
- `nutrition_data_per` `100g` → per 100 g (per 100 ml when the product/serving unit is ml); `serving` → serving basis with `serving_quantity` as grams or ml.
- `*_modifier` `<` → `less-than`; `~` → `estimated`.
- Carbohydrate: `carbohydrates-total` → reported total; bare `carbohydrates` → **estimated + needsLabelConfirmation** (label conventions differ by country). Fiber and sugar are never added into carbohydrate.
- Portions: serving and whole package when units are compatible with the basis.
- Barcodes: digits only, leading zeros preserved; a 9–12 digit miss is retried padded to 13 (OFF normalization).

### Fixture status
Live calls were **blocked** in the build sandbox. Files under `fixtures/` are shaped after the documented responses and labelled as such. First task on a connected machine: capture two real responses per provider, diff against the fixtures, and bump the normalization version if any field semantics differ.

## Licensing and attribution
- USDA FoodData Central data is CC0; attribution text is stored on every USDA-derived version.
- Open Food Facts database is ODbL, content DbCL, images CC-BY-SA; attribution stored on every OFF-derived version; images are not imported.
- Provider caches live in their own table keyed by provider and are never exported as a combined database. Export (`POST /api/v1/export`) contains only the user's own foods, versions, entries, meals, recipes and goals.
- Private family use only. No redistribution. Corrections are never uploaded back to OFF.
