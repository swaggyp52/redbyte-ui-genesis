# Project Format & Migrations

The canonical, versioned project contract and its migration chain. Code is the
authority (`packages/rb-logic-core`); this doc tracks intent and the corpus.

## Versioning model

- A serialized project is a JSON document with a top-level integer `formatVersion`.
- `CURRENT_PROJECT_FORMAT_VERSION` is the single source of truth in code.
- **Deserialize** = read `formatVersion` → apply each migration `vN -> vN+1` in order
  until current → validate. A document with no version is treated as the legacy
  pre-versioned shape (`v0`) and migrated forward.
- **Serialize** = always emit `CURRENT_PROJECT_FORMAT_VERSION`, canonical key order,
  no wall-clock/random values.
- **Round-trip invariant:** `deserialize(serialize(p)) ≡ p` (deep-equal on the
  normalized document) for every project at the current version.
- **Idempotent upgrade invariant:** migrating an already-current document is a no-op.

## Migration registry

| From | To | Summary | Test |
|------|----|---------|------|
| v0 (legacy, no version tag) | v1 | Wrap the P1 persisted/serialized shape in the explicit versioned envelope; normalize connection refs (nested shape only). | _(P2-1)_ |

_(rows appended as the format grows: source model, filesets, imported snapshots, …)_

## Migration corpus

Fixtures live under `packages/rb-logic-core/src/__tests__/fixtures/project-format/`
(one file per historical version/shape). Each corpus entry asserts:

1. It loads without throwing.
2. It upgrades to the current version.
3. The upgraded document passes validation and round-trips.
4. Known semantic content (nodes, connections, buses, hierarchy) is preserved.

## Rules

- Never delete or mutate a shipped migration; only append.
- Never renumber versions.
- The flat connection shape (`fromNodeId`/`toNodeId`) is never valid at any version;
  `normalizePortRef` throws on it.
