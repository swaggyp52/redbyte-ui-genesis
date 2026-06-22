---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: PR78 Product Trust Reset v2 merge-readiness review
---

# RedByte PR78 Merge Readiness

Date: 2026-06-22
Branch: `product/redbyte-trust-reset-v2`
PR: #78, draft
Base reviewed: `origin/main` at `0abe87af980ee673e1ab90720ea64d32469e4c87`
Starting Phase 3I head: `24db2554c25b218f10267df22a669ca53167ca04`

## Executive Decision

**C. READY FOR REVIEW, KEEP DRAFT**

PR #78 is coherent enough to continue into Phase 4 Design and Map Pins reconstruction after the Phase 3I commit is pushed and GitHub checks are green. It must remain draft and unmerged. This decision does not mark the PR non-draft, does not merge it, and does not claim Vivado/Basys3 E1-E3 proof.

## Full Scope

PR #78 now includes:

- V2 student chrome and diagnostics separation
- V2 workspace and visual contracts
- Verify truth state, runtime adapter, rendered authority, Course/My check authority, stale/repair authority, and sequential timing authority
- manifest-backed classroom gate ownership and retired V1 diagnostic mapping
- browser-local project storage facade with journal, last-known-good, recovery points, quota recovery, dirty-update guard, multi-tab warnings, and Diagnostics storage fields
- 30-context browser rehearsal evidence and Phase 3I rehearsal fault-injection proof

## Architecture Review

The branch has one coherent architecture direction:

- normal student surfaces hide raw build/proof chrome
- Help / Diagnostics owns build/runtime/storage support detail
- Verify trust is owned by `verifyTruthState.ts` and `verifyTruthAdapter.ts`
- Project and Export consume V2 Verify selectors where available
- active project storage writes are routed through `projectStorageFacade.ts`
- required classroom gates come from `scripts/gates/gate-manifest.mjs`

The main architectural risk is size and compatibility debt, not a found P0/P1 split-brain authority defect.

## Verify Authority Review

Current Verify authority is acceptable for continued review:

- Course checks render locked and can be duplicated to My checks.
- Expected-output editability follows check provenance.
- PASS/FAIL/STALE, stale reason, selected failure, repair actions, timing authority, Project status, and Export readiness are adapter/model-owned.
- Runtime failures are blocked from rendering trusted PASS.

Remaining P2 work: continue simplifying the rendered Verify surface and remove legacy assumptions when Phase 4/next product reconstruction reaches that area again.

## Storage / Durability Review

Current storage durability is acceptable for continued review:

- active runtime persistence uses `createProjectRuntimeStorage()`
- saved snapshots/index, session metadata, and legacy autosave helpers route through facade helpers in current `IdeApp`
- quota/failure paths surface a Project recovery banner instead of false Saved
- last-known-good and recovery sidecars are visible through Diagnostics
- stale writers and multi-tab conditions have gates
- `gate:project-storage-authority` now blocks new direct project persistence outside the facade or documented compatibility allowlist

Known compatibility writers retained as P2 cleanup:

- `packages/rb-apps/src/services/projectPersistence.ts`
- `packages/rb-apps/src/utils/ceAutosave.ts`
- `packages/rb-apps/src/utils/rbprojAutosave.ts`
- `packages/rb-apps/src/utils/snapshotSystem.ts`
- explicit user Reset Workspace in `packages/rb-apps/src/components/ErrorBoundary.tsx`

These are documented and guarded. Do not classify them as removed until consumer audit/deletion is complete.

## Rehearsal Validity Review

The 30-context browser rehearsal is credible browser E0 evidence:

- one isolated browser context per profile
- storage cleared per profile
- Logic Gates starter load, project rename, Verify PASS, reload restore, and corrupt-storage recovery
- storage waves G-K for journal, last-known-good, recovery point, snapshot/index, and runtime reload
- current rendered build SHA assertion against Git HEAD

Phase 3I adds `rehearsal:classroom-fault-injection`, which rebuilds and confirms the harness fails for wrong build, visible error boundary, mutated Course-check editability, stale trusted PASS, cross-context state leak, and post-reload page error.

## Accessibility Evidence

Automated/browser evidence exists for Verify accessible names, keyboard My-check expected-output editing, 125 percent zoom/contrast, diagnostics modal semantics, and recovery alert/action naming.

No NVDA, Narrator, VoiceOver, JAWS, or other screen-reader session has been run. `docs/release/RED_BYTE_ASSISTIVE_TECH_REVIEW.md` contains the required 15-20 minute human AT script. PR #78 is not accessibility-certified.

## UI / UX Review

Current branch UI is substantially stronger than pre-reset, but not finished:

| Area | Finding | Severity |
|---|---|---|
| Project | V2 command/identity work is usable; remaining product polish is Phase 4+ depth, not a Phase 3I blocker. | P2 |
| Design | Still needs Phase 4 reconstruction depth and CSS retirement; do not rebuild in Phase 3I. | P2 |
| Verify | Authority is much stronger; visual complexity and testbench/evidence clarity can still improve. | P2 |
| Map Pins / Hardware | Browser E0 mapping workbench is guarded; Phase 4 should continue surface reconstruction without changing pin truth. | P2 |
| Export | Handoff and previews are stronger; generated preview escaping deserves focused review before non-draft. | P2 |
| Import | Utility path remains acceptable; broader recovery polish is deferred. | P2 |
| Help / Diagnostics | Properly owns build/storage details; human support process still needs rehearsal. | P2 |

No Phase 3I P0/P1 UI blocker was found that justified changing product surfaces during this review phase.

## Dead-Code Review

No production code was deleted in Phase 3I because no candidate was proven dead without risk. Retained debt:

- retired V1 gate scripts remain diagnostic-only
- V1 selectors/comments remain in CSS/source
- package-root storage compatibility paths remain
- Export syntax-highlight preview uses HTML injection through a highlighter path that should receive focused escaping review before non-draft

## Performance Review

See `docs/release/RED_BYTE_PR78_PERFORMANCE_REVIEW.md`.

Phase 3I found no P0/P1 performance blocker. Current risks are P2: large accumulated CSS, exact clean origin/main performance delta not generated in this worktree, and need for a non-draft bundle-size review after Phase 4 reduces/removes legacy selectors.

## Security / Privacy Review

See `docs/release/RED_BYTE_PR78_SECURITY_PRIVACY_REVIEW.md`.

Phase 3I found no P0/P1 security/privacy blocker. The app remains local-first and does not add accounts, tokens, backend sync, or automatic uploads. P2 follow-up is generated-preview escaping/highlighter review and a clean non-draft dependency/header pass.

## Test / Gate Matrix

Phase 3I added:

- `gate:project-storage-authority`
- `rehearsal:classroom-fault-injection`

Phase 3I local closeout matrix passed under portable Node `v20.19.0` / pnpm `10.24.0`:

- `node --check` for changed gate/rehearsal/harness scripts
- `gate:project-storage-authority`
- `gate:manifest:validate`
- current Verify truth and storage gates
- `classroom:gate` (`86/86`)
- `verify:gates:classroom` (`105/105`)
- `rehearsal:classroom-fault-injection` (`6/6` deliberate faults detected)
- `build:unified`
- `rb:doc:validate`
- `rb:encoding:check`
- `git diff --check` with only normal CRLF working-copy warnings

Still required after the Phase 3I commit is created:

- final current-build smoke after the commit is clean
- GitHub Classroom Truth Gates and deploy checks green after push

## Known Issues

### P0

None currently known.

### P1

None currently known after Phase 3I source/rehearsal gate additions and local validation. Final clean-tree current-build smoke and GitHub checks remain required closeout proof.

### P2

- Retire package-root storage compatibility writers after consumer audit.
- Reduce large accumulated IDE CSS and delete stale V1 selectors only when replacement proof is clear.
- Run real Narrator/NVDA/VoiceOver/JAWS review before accessibility certification.
- Run focused generated-preview escaping review before non-draft.
- Generate exact clean origin/main performance deltas before non-draft.
- Continue Phase 4 Design and Map Pins reconstruction without changing simulation, Verify, mapping, export bytes, project format, or goldens.

## Merge Blockers

Blocking before merge/non-draft:

- PR #78 is draft by design.
- Human review has not approved marking non-draft.
- Actual screen-reader certification is not complete.
- Vivado/Basys3 E1-E3 proof has not been run.
- Final Phase 3I commit, clean-tree current-build smoke, push, and GitHub green proof must be recorded.

Not blockers for continuing Phase 4:

- P2 CSS/source cleanup debt
- compatibility storage writers documented by the source gate
- lack of hardware proof, as long as no E1-E3 claims are made

## Rollback Strategy

If Phase 3I gate additions cause CI issues, revert the Phase 3I commit only. If Phase 3H storage facade causes a runtime problem, revert the Phase 3H storage-facade commit range rather than reverting Verify truth/model work. Do not re-bless goldens or change generated artifacts as part of a Phase 3I rollback.

## Post-Merge Proof Plan

Before any eventual merge or non-draft transition:

1. Re-run the full local validation matrix on a clean final head.
2. Run final current-build smoke and deployed preview smoke.
3. Confirm PR body and readiness docs name the final head.
4. Run the human AT script or keep accessibility certification open.
5. Run clean performance/security follow-up checks.
6. Keep E1/E2/E3 hardware proof out of release claims unless Vivado/Basys3 proof is actually run.

## Phase 4 Readiness

Phase 4 can begin after this Phase 3I commit is pushed and GitHub checks are green. The recommended Phase 4 entry point is Design and Map Pins V2 reconstruction, with the current truth model, storage facade, gate manifest, and no-overclaim boundaries treated as fixed constraints.

## Attribution

Connor Angiel
