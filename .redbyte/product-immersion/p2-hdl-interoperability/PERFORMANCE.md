# P2 Performance & Durability

Scale/durability evidence for the versioned project format and source model. Numbers
are captured under pinned Node 20.19.0; record method + machine caveat with each.

## Targets (working hypotheses, refined with data)

- Serialize + round-trip of a "complex reference project" (many modules, buses, source
  files, constraint sets) completes well within interactive budget.
- Migration of the corpus is linear in document size; no quadratic blowups.
- Deterministic serialization: identical input → byte-identical output across runs.

## Measurements

| Scenario | Metric | Value | Method / caveat |
|----------|--------|-------|-----------------|
| _(pending P2-1 / P2-8)_ | | | |
