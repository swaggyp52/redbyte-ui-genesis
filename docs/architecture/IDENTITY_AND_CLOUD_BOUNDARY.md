# Identity and Cloud Persistence Boundary (Forward Contract)

Status: forward-looking architecture contract, written 2026-08-28 during the
production-convergence phase. No server code exists yet and none should be
built from this document alone; it defines the seams a future account /
university backend must use so the engineering domain stays independent.

## Non-negotiable invariant

The circuit/simulation domain (`rb-logic-core`, the simulator, compilers,
export/package generation, board mapping authorities) must never know about
authentication, tenancy, courses, or network persistence. Identity and
persistence reach the workbench only through adapters at the application
boundary in `packages/rb-apps`.

## The existing seam

Browser persistence is already behind a versioned facade:

- `packages/rb-apps/src/apps/ide/projectRepository.ts` — the ProjectRepository
  facade: versioned records, fail-closed writes, recovery snapshots,
  corrupt-index reconstruction, rollback. Every project read/write in the IDE
  routes through it.
- `packages/rb-apps/src/services/projectPersistence.ts` — the lower-level
  browser storage encoding.

This facade is the cloud-persistence seam. A future backend implements the
same repository contract (list/load/save/snapshot/restore, with the same
fail-closed semantics) against a service instead of browser storage. The IDE
must not grow direct `fetch` calls for project state outside a repository
implementation.

## Future domain concepts (documented, not built)

| Concept | Owner (future) | Rule |
|---|---|---|
| User (identity, session) | Identity adapter | Injected at app boundary; never imported by engineering packages |
| University / Tenant | Backend service | Scopes storage and entitlements; invisible below the repository contract |
| Course / Assignment | Course service | Provides lab/starter catalogs and submission targets through the same catalog interfaces the local examples use today |
| Project ownership | Repository implementation | Ownership/ACL is metadata on repository records, not on circuits |
| Cloud persistence | Repository implementation | Same ProjectRepository contract; sync/conflict policy lives inside the implementation |
| Entitlement / license | Identity adapter + app shell | Gates feature visibility in the shell; never gates simulator behavior |
| Instructor / student role | Identity adapter | Roles select UI surfaces (e.g. instructor views); engineering semantics identical for all roles |

## Adapter rules

1. Identity enters through one provider at the app shell; components consume a
   narrow read-only identity context (who am I, roles, entitlements).
2. Persistence enters through the ProjectRepository contract; implementations
   are selected at boot (local browser today; remote later; both can coexist
   for offline-first sync).
3. Course content (labs, starters, requirements) enters through the same
   catalog interfaces the built-in examples use today.
4. No engineering package (`rb-logic-core`, `rb-fpga-toolchain`,
   `rb-board-profiles`, simulation, export) may import identity, network, or
   tenancy modules. Enforce by review and, once a backend exists, by an
   architecture fitness check in CI.
5. Determinism invariants (no wall-clock in hashes, no random IDs in
   verify/export paths) apply to repository implementations as well: server
   timestamps are metadata, never inputs to package bytes.

## Explicitly out of scope now

Account UI, auth flows, server APIs, sync protocols, and billing. Building any
of these requires a product contract first; this document only fixes where
they are allowed to attach.
