# Fixtures

Live calls to `api.nal.usda.gov` and `world.openfoodfacts.org` were **blocked** by
the egress policy of the cloud build environment on 2026-09-18, so none of these
files is a captured live response. Each file is shaped after the provider's
documented response format and is used only to exercise the adapters. Nutrient
numbers inside them are illustrative and must not be seeded into a real account.

| File | Purpose |
|------|---------|
| `usda/search-banana.json` | Shape of `GET /fdc/v1/foods/search` for a generic SR Legacy food; per-100 g nutrients, household serving. |
| `usda/search-branded-liquid.json` | Branded liquid with `servingSizeUnit: "ml"`; exercises the per-100 ml basis warning and a missing sugar field. |
| `off/product-leading-zero.json` | Shape of the Open Food Facts v3 product read for a 13-digit code with a leading zero, `nutrition_data_per: "100g"`, a `<` modifier on fiber, missing sugar. |
| `off/product-per-serving.json` | Product reported per serving with `serving_quantity`, and a `carbohydrates-total` field present. |
| `synthetic/octoberfest-synthetic.json` | **Explicitly synthetic** beverage record for arithmetic tests. It is *not* Samuel Adams nutritional data. The real product must be verified from its label or a supported database record before use. |

Re-capture real payloads (and recheck field semantics) once provider access is available; see `DATA_SOURCES.md`.
