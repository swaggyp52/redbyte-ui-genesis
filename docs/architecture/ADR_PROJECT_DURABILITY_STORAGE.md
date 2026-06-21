---
doc_status: current
last_validated: 2026-06-21
owner: Connor Angiel
used_by_claude: true
role: project durability storage decision for Product Trust Reset v2
---

# ADR: Project Durability Storage

## Status

Accepted as a foundation decision; implementation remains future work.

## Context

RedByte currently uses browser-local storage for runtime state, saved project snapshots, session metadata, and a legacy autosave draft. This is acceptable for browser E0 proof but not enough to call the product classroom-reliable under repeated sessions, corrupt writes, quota pressure, or multi-tab use.

The Product Trust Reset v2 branch should not jump directly to a storage migration while Verify truth is still being reconstructed. A backend change would create too much risk and would not by itself solve the user-facing trust model.

## Decision

Keep the current `localStorage` persistence for this Phase 3 foundation slice, but document the target durability model and require the next reliability implementation to introduce a storage facade before any backend migration.

The target facade must support:

- atomic-ish journaled save steps
- rolling snapshots
- explicit decode/corruption diagnostics
- multi-tab/session owner detection
- quota failure reporting
- `.rbproj` roundtrip compatibility
- browser rehearsal gates that use multiple fresh contexts

## Rejected Alternatives

| Alternative | Why rejected now |
|---|---|
| Immediate IndexedDB migration | Higher blast radius than this foundation slice and not required for the Verify truth-state work. |
| Add Dexie now | Adds dependency and API commitment before storage contracts are proven. |
| Add schema validator dependency now | Useful later, but current `.rbproj` encode/decode and focused tests are enough for this slice. |
| Leave durability as undocumented localStorage behavior | Keeps classroom reliability risks implicit and lets UI polish hide fragile persistence. |

## Consequences

- Current project format and saved snapshot bytes remain unchanged.
- The next durability slice has an explicit target and can be gated without changing Verify semantics.
- Browser E0 proof remains honest: reload/recovery paths are covered, but multi-context classroom reliability is not yet proven.

## Attribution

Connor Angiel
