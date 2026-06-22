---
doc_status: current
last_validated: 2026-06-21
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
| Saved IDE project snapshots | `packages/rb-apps/src/apps/ide/projectPersistence.ts` | `localStorage` project snapshot and index keys |
| Runtime project state | `packages/rb-apps/src/apps/ide/projectRuntime.ts` | `localStorage` runtime key |
| Last session metadata | `packages/rb-apps/src/apps/ide/persistence/labSession.ts` | `localStorage` session metadata key |
| Legacy autosave draft | `packages/rb-apps/src/apps/IdeApp.tsx` | `rb-autosave-circuit` fallback key |

## Current Guarantee

The app can save and restore a project from local browser storage, list valid saved snapshots, ignore invalid snapshot wrappers, restore last-session metadata when the snapshot decodes, and preserve `.rbproj` as the portable project handoff.

Phase 3F adds focused browser proof for the current guarantee:

- `ide:gate:project-durability-v2` proves saved snapshot, saved-project index, runtime state, and reload restore for a renamed loaded project.
- `ide:gate:verify-corrupt-state-recovery-v2` proves malformed runtime/session browser storage does not crash the app or resurrect trusted Verify PASS.
- `ide:gate:verify-multitab-conflict-v2` proves another tab writing the runtime project key raises a visible Reload/Dismiss warning instead of remaining silent.
- `rehearsal:classroom-30`, `rehearsal:classroom-verify`, and `rehearsal:classroom-recovery` run 30 isolated browser contexts and write local evidence under `.redbyte/rehearsal/phase-3f/`.

## Current Limits

- Snapshot and index writes are not atomic.
- No journal marker proves a save fully committed.
- No rolling per-project snapshot history is maintained by the project persistence helper.
- Multi-tab conflicts are only warned, not resolved.
- Quota failures can be silent.
- Session metadata, runtime state, and legacy autosave can disagree.
- Browser gates cover key reload/recovery paths and Phase 3F adds a many-context browser rehearsal script; human classroom rehearsal and hardware proof remain separate.

## Target Guarantee

For classroom use, RedByte should be able to say:

1. The current project can be restored after reload.
2. A corrupt current snapshot does not destroy the last good project.
3. A student can choose a recovery candidate with clear recency and project identity.
4. Multiple tabs cannot silently overwrite a project without a visible conflict.
5. Storage quota or persistence failure is surfaced as an action, not hidden as a status line.
6. Imported projects and autosaved drafts never become trusted Verify evidence without rerun freshness checks.

## Target Architecture

- Keep `.rbproj` as the portable format.
- Introduce a storage facade so UI code does not write raw `localStorage` keys directly.
- Add journaled local commits: pending snapshot, commit marker, then index promotion.
- Keep rolling snapshots per project.
- Track session owner and heartbeat for multi-tab conflict detection.
- Add explicit recovery states for current save, recovered draft, last good snapshot, corrupt snapshot ignored, and quota risk.
- Extend the Phase 3F multi-context rehearsal after the storage facade exists so it covers journal rollback, quota-risk UI, and real conflict resolution.

## Non-Goals

- This document does not approve IndexedDB or Dexie by itself.
- This document does not change the project format.
- This document does not claim cloud sync, SaaS accounts, or instructor roster support.
- This document does not change Verify, simulation, export, mapping, generated artifacts, or hardware proof semantics.

## Attribution

Connor Angiel
