---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: classroom project durability model for RedByte
---

# RedByte Project Durability Model

This model defines how RedByte should protect classroom work across reloads, recoveries, imports, and repeated sessions.

## Current Storage Authorities

| Concern | Owner | Storage |
|---|---|---|
| Portable project interchange | `packages/rb-apps/src/export/projectFormat.ts` | `.rbproj` encoded JSON |
| Browser storage facade | `packages/rb-apps/src/apps/ide/projectStorageFacade.ts` | Local-browser runtime, snapshot/index, session, legacy autosave, journal, last-known-good, recovery, backup keys |
| Saved IDE project snapshots | `packages/rb-apps/src/apps/ide/projectPersistence.ts` through the facade | Existing `localStorage` project snapshot and index keys |
| Runtime project state | `packages/rb-apps/src/apps/ide/projectRuntime.ts` through the facade-backed Zustand storage adapter | Existing `rb.ide.project-runtime.v1` raw JSON plus Phase 3H sidecar keys |
| Last session metadata | `packages/rb-apps/src/apps/ide/persistence/labSession.ts` through the facade | Existing `rb.ide.sessionMeta.v1` key |
| Legacy autosave draft | `packages/rb-apps/src/apps/IdeApp.tsx` through the facade | Existing `rb-autosave-circuit` fallback key |

## Current Guarantee

The app can save and restore a project from local browser storage, list valid saved snapshots, ignore invalid snapshot wrappers, restore last-session metadata when the snapshot decodes, and preserve `.rbproj` as the portable project handoff.

Phase 3F adds focused browser proof for the current guarantee:

- `ide:gate:project-durability-v2` proves saved snapshot, saved-project index, runtime state, and reload restore for a renamed loaded project.
- `ide:gate:verify-corrupt-state-recovery-v2` proves malformed runtime/session browser storage does not crash the app or resurrect trusted Verify PASS.
- `ide:gate:verify-multitab-conflict-v2` proves another tab writing the runtime project key raises a visible Reload/Dismiss warning instead of remaining silent.
- `rehearsal:classroom-30`, `rehearsal:classroom-verify`, and `rehearsal:classroom-recovery` run 30 isolated browser contexts and write local evidence under `.redbyte/rehearsal/phase-3f/`.

Phase 3H extends the current guarantee:

- `ide:gate:project-storage-facade-v2` proves the facade writes committed journal metadata, last-known-good runtime, and recovery points while preserving the runtime key.
- `ide:gate:atomic-save-journal-v2` proves failed/quota writes are classified and do not mark a save committed.
- `ide:gate:project-schema-migration-v2` proves future-schema recovery metadata fails closed instead of being misread.
- `ide:gate:project-quota-recovery-v2` proves a forced quota failure surfaces a visible backup/retry/dismiss recovery banner.
- `ide:gate:project-multitab-conflict-v2` proves same-origin multi-tab writes still show an explicit saved-work-changed warning.
- `ide:gate:dirty-update-guard-v2` proves dirty work raises a browser beforeunload confirmation instead of silently relying on best-effort save.
- `ide:gate:project-recovery-workflow-v2` proves malformed current runtime recovers from last-known-good without resurrecting trusted PASS.
- `ide:gate:diagnostics-storage-v2` proves Diagnostics exposes facade schema, journal, last-known-good, recovery, quota, and recovery-status fields.
- `ide:gate:recovery-accessibility-v2` proves recovery warnings use `role="alert"` and named backup/retry/dismiss actions.
- The classroom rehearsal script now writes Phase 3H evidence under `.redbyte/rehearsal/phase-3h/` and records storage waves G-K for journal, last-known-good, recovery point, snapshot/index, and reload runtime availability.

## Current Limits

- The facade is browser-local and `localStorage` compatible; no backend, cloud sync, roster/account recovery, or IndexedDB migration exists.
- The save journal is atomic-ish browser metadata, not a transactional database.
- Recovery points are bounded local sidecars, not a user-facing full history manager.
- Multi-tab conflicts are warned and stale-writer saves are blocked in facade contract tests, but full conflict merge/resolution UI remains future work.
- Quota failures are surfaced with backup/retry actions, but the app cannot expand browser quota.
- Browser gates cover key reload/recovery paths and the rehearsal records storage waves; human classroom rehearsal, actual screen-reader certification, and hardware proof remain separate.

## Target Guarantee

For classroom use, RedByte should be able to say:

1. The current project can be restored after reload.
2. A corrupt current runtime does not destroy the last good project.
3. A student can choose a recovery candidate with clear recency and project identity.
4. Multiple tabs cannot silently overwrite a project without a visible conflict.
5. Storage quota or persistence failure is surfaced as an action, not hidden as a status line.
6. Imported projects and autosaved drafts never become trusted Verify evidence without rerun freshness checks.

## Target Architecture

- Keep `.rbproj` as the portable format.
- Keep `.rbproj` as the portable format and preserve existing browser storage bytes for compatibility.
- Keep project runtime writes behind `createProjectRuntimeStorage()`.
- Keep saved snapshots/index, session metadata, and legacy autosave behind facade helpers.
- Use sidecar journal, last-known-good, recovery-point, and recovery-status keys for browser-local durability.
- Track writer id and revision for stale-writer conflict detection.
- Add explicit user recovery states for quota risk and failed save.
- Extend future rehearsal only when new user-facing conflict resolution or storage backend behavior is added.

## Non-Goals

- This document does not approve IndexedDB or Dexie by itself.
- This document does not change the project format.
- This document does not claim cloud sync, SaaS accounts, or instructor roster support.
- This document does not change Verify, simulation, export, mapping, generated artifacts, or hardware proof semantics.

## Attribution

Connor Angiel
