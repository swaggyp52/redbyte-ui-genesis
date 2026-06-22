---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: project durability storage decision for Product Trust Reset v2
---

# ADR: Project Durability Storage

## Status

Accepted and partially implemented for Product Trust Reset v2 Phase 3H.

## Context

RedByte uses browser-local storage for runtime state, saved project snapshots, session metadata, and a legacy autosave draft. That is acceptable for browser E0 proof, but raw scattered writes were not enough to call the product classroom-reliable under repeated sessions, corrupt writes, quota pressure, or multi-tab use.

The Product Trust Reset v2 branch should not jump directly to a storage migration while Verify truth is still being reconstructed. A backend change would create too much risk and would not by itself solve the user-facing trust model.

## Decision

Keep browser-local persistence and introduce a storage facade before any backend migration.

Phase 3F keeps that decision. It adds browser proof gates, 30-context rehearsal scripts, richer Diagnostics support data, and a minimal multi-tab storage-event warning. It does not introduce a new storage backend, change `.rbproj`, or claim journaled commits.

Phase 3H implements the first facade boundary in `packages/rb-apps/src/apps/ide/projectStorageFacade.ts`. It preserves existing raw storage bytes and project/snapshot formats, but routes active runtime persistence, saved snapshots/index, session metadata, and legacy autosave through facade helpers.

The Phase 3H facade supports:

- atomic-ish journaled save steps
- last-known-good runtime recovery
- bounded recovery points
- explicit decode/corruption diagnostics
- multi-tab/session writer and revision detection
- quota failure reporting
- `.rbproj` roundtrip compatibility
- backup export/import for local support recovery
- browser gates and rehearsal storage waves that use fresh contexts

Deferred beyond Phase 3H:

- IndexedDB or backend migration
- full collaborative conflict merge UI
- roster/account/cloud sync
- screen-reader certification without a real assistive-technology pass

## Rejected Alternatives

| Alternative | Why rejected now |
|---|---|
| Immediate IndexedDB migration | Higher blast radius than this foundation slice and not required for the Verify truth-state work. |
| Add Dexie now | Adds dependency and API commitment before storage contracts are proven. |
| Add schema validator dependency now | Useful later, but current `.rbproj` encode/decode and focused tests are enough for this slice. |
| Leave durability as undocumented localStorage behavior | Keeps classroom reliability risks implicit and lets UI polish hide fragile persistence. |
| Change `.rbproj` or snapshot bytes now | Not required to close the browser-local durability boundary and would raise import/export/golden blast radius. |
| Add cloud sync/accounts now | Not needed for browser E0 classroom proof and would add product/account complexity before local recovery is trustworthy. |

## Consequences

- Current project format and saved snapshot bytes remain unchanged.
- Runtime persistence still writes the existing `rb.ide.project-runtime.v1` raw JSON for compatibility, with Phase 3H sidecars for journal, last-known-good, recovery points, and recovery status.
- Browser E0 proof now covers facade contract tests, committed journal/LKG/recovery sidecars, malformed-current recovery, future schema fail-closed behavior, quota recovery UI, dirty update guard, multi-tab warning, diagnostics storage fields, and accessible recovery actions.
- This remains browser-local durability proof. It does not claim backend sync, full conflict merge resolution, Vivado/Basys3 E1-E3 proof, or screen-reader certification.

## Attribution

Connor Angiel
