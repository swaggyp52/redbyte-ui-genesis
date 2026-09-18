# DATA_SOURCES

## Roles (frozen)

| Order | Source | Role | Badge |
|---|---|---|---|
| 1 | Her saved foods (versioned) | Daily logging, offline, aliases, pins | Your label / Your recipe |
| 2 | USDA FoodData Central | Deliberate online text search with paging (`mode=online&page=n`), food details for household portions, and a verified-GTIN branded lookup after an OFF miss | USDA |
| 3 | Open Food Facts | Barcode lookup only (v3 product read), never search-as-you-type; no OFF search endpoint is used | Product database |
| always | Label / custom entry | Missing products, corrections, recipes | Your label |

The server (`apps/server/src/services/search.ts`) is the only outbound caller. It sends the search term or barcode only. Hosts are allow-listed (`providers/http.ts`): `api.nal.usda.gov`, `world.openfoodfacts.org`, HTTPS only, 5 s timeout, no redirects.

## Lookup order
- Text: the phone ranks its own foods and meals instantly (shared `rankLocalFoods` in `@daily-plate/domain`, identical on the Pi); an explicit search or "Search more foods" asks the Pi, which caches and calls USDA. "More results" fetches the next page (10 per page, up to 20 pages).
- Barcode: phone-saved foods → Pi-saved foods → Open Food Facts (raw code, then 13-digit padded) → USDA branded search by GTIN, accepted only when the returned `gtinUpc` equals the code ignoring leading zeros. A saved product never contacts a provider (unless the phone asks `remote=1`).
- Details: `GET /foods/details/usda/:fdcId` fetches the documented `/fdc/v1/food/{id}` record for household portions; branded records do not need it.

## Throttles and cache
- USDA: token bucket 30 burst, refill 200/hour (documented quota 1,000/hour/IP; DEMO_KEY is far lower and unsuitable for production). Search pages cached 7 days by `search:<normalization>:<dataTypes>:<pageSize>:p<page>:<query>`; details 30 days; GTIN hits 30 days, misses 1 day.
- OFF: bucket 5 burst, refill 10/minute (documented 15 reads/minute/IP). Products cached 30 days; not-found cached 1 day.
- 429/503 honour `Retry-After`, otherwise hold 60 s. No automatic retry storms.
- User-Agent: `DailyPlate/<version> (private family food journal; contact: <DP_PROVIDER_CONTACT>)`. Set `DP_PROVIDER_CONTACT` on the Pi.

## Normalization (`normalizationVersion`)

### USDA `usda-2` (`providers/usda.ts`)
- Data types requested: Foundation, SR Legacy, Survey (FNDDS), Branded. FNDDS brings survey foods and beverages with portion weights (cup, tablespoon, piece).
- Two response shapes are normalized by one function: search hits (`nutrientNumber`/`nutrientId`/`value`) and detail records (`nutrient.number`/`nutrient.id`/`amount`). Nutrient numbers win; ids (1003/1004/1005/1079/1063/2000/1008) are the fallback when a record carries no numbers (FNDDS). Unit must be G / KCAL.
- Basis: per 100 g. Branded records whose `servingSizeUnit` is ml/MLT are treated as per 100 ml with a visible warning, following USDA's branded documentation that values are stated per 100 g or per 100 ml by serving unit. Neither rule is applied to reference foods.
- Branded detail `labelNutrients` (per serving) are used only for a field the per-100 list lacks, and only when `servingSize` is known (value × 100 / servingSize). No serving size → unknown.
- Household portions: each `foodPortions` entry with a `gramWeight` becomes a portion for ONE unit: a leading count in `portionDescription` ("0.5 cup", "1 large") is divided out; "Quantity not specified" falls back to `measureUnit.name` + `modifier`; entries without a gram weight are dropped. The label serving (`servingSize` + `householdServingFullText`) stays first.
- Preparation inferred from description words (raw; cooked/roasted/boiled/grilled/baked/fried; dry/uncooked; prepared; drained).
- Relevance is re-ranked on the Pi by `rankCandidates`: whole-name and coverage matches first; for a short generic query (≤ 2 words, no variant or brand word) reference/survey records outrank branded ones; variant words in the query (vanilla, zero, raw, cooked, unsweetened…) must appear in the name; records are deduplicated by provider id only, never by name.
- Missing → `unknown`. Barcodes from `gtinUpc` kept as strings.

### Open Food Facts `off-1` (`providers/off.ts`)
- v3 product read with an explicit `fields` list; found when `status` is `success`/`success_with_warnings`/`1` and `product` exists.
- `nutrition_data_per` `100g` → per 100 g (per 100 ml when the product/serving unit is ml); `serving` → serving basis with `serving_quantity` as grams or ml.
- `*_modifier` `<` → `less-than`; `~` → `estimated`.
- Carbohydrate: `carbohydrates-total` → reported total; bare `carbohydrates` → **estimated + needsLabelConfirmation** (label conventions differ by country). Fiber and sugar are never added into carbohydrate.
- Portions: serving and whole package when units are compatible with the basis.
- Barcodes: digits only, leading zeros preserved; a 9–12 digit miss is retried padded to 13 (OFF normalization).

### Evidence kinds
Three kinds are kept apart: **synthetic robustness fixtures** (`fixtures/synthetic/`), **documented-shape examples** (`fixtures/usda/`, `fixtures/off/`: shaped after the published response formats, values illustrative), and **authentic captures** (none yet; when added they go under `fixtures/captures/<provider>/<date>/` with source URL, date, environment and sha256 in a sidecar `.meta.json`). Live calls were **blocked** in every cloud environment available to this campaign (egress denied). First task on a connected machine: capture two real responses per provider and per shape (search, detail, product), diff against the documented-shape examples, and bump the normalization version if any semantics differ.

## Catalog coverage benchmark
`fixtures/benchmark/catalog-cases.json` is a fixed 80-case set (15 basic, 15 cooked/mixed, 20 packaged, 15 beverages, 10 restaurant, 5 ambiguous/negative) with intended identity, preparation, acceptable portion and whether an exact brand is required. It carries **no expected nutrition**. `apps/server/dist/benchmark/run.js --mode replay` runs the cases through the real search service against fixtures and reports per-category rank/portion/completeness; its report states **NOT MEASURED** for live coverage. `--mode live` is an explicit, rate-bounded run (one query every 4 s) that needs a real USDA key and records the environment; it is not part of any automated test. Restaurant items with no trustworthy record stay reported gaps.

## Adding another provider (policy)
Keep `FoodCandidate` as the extension point. Before wiring any commercial catalog (fatsecret included) establish, in writing: US coverage; search/details/barcode entitlement on the tier actually available; attribution text; permitted cache duration; the right to keep diary snapshots indefinitely; user export rights; and what happens to historical records after cancellation. fatsecret's published Basic tier excludes barcode scanning and caching, and its storage terms restrict retaining most content beyond 24 hours without an applicable agreement, which conflicts with Pi-owned snapshots and offline reuse; it is therefore not integrated. Renaming provider data as "custom food" is not a storage-rights workaround.

## Licensing and attribution
- USDA FoodData Central data is CC0; attribution text is stored on every USDA-derived version.
- Open Food Facts database is ODbL, content DbCL, images CC-BY-SA; attribution stored on every OFF-derived version; images are not imported.
- Provider caches live in their own table keyed by provider and are never exported as a combined database. Export (`POST /api/v1/export`) contains only the user's own foods, versions, entries, meals, recipes and goals.
- Private family use only. No redistribution. Corrections are never uploaded back to OFF.
