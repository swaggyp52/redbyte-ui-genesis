## P2.6B review checkpoint - 2026-09-12

This supersedes the first implementation checkpoint below. The first checkpoint is pushed
as 57f4df2bdbc0b95881c7043d112b09239f634f70. The reviewed follow-up fixes measured Split
camera double-translation, wraps the source header so Import remains reachable, gives Time
keyboard lane selection and authored-input editing, restores direct combinational input
editing, and aligns Reproduce with the command row. Failure context has readable contrast;
one recording in Project Runs now says no repeat yet.

The actual Full Adder repair/map/download/reload browser journey exposed eight authored
event ids being discarded on reload. Scenario cloning and persisted-vector normalization
now preserve valid ids. This keeps exported project bytes and exact package receipts stable;
execution content hashes still exclude authoring identity. A regression test fails with the
loss restored and passes with the fix. No receipt/trust checks were weakened.

Construction proof on Node 20.19.0: the Full Adder UI-only core passes at 1440x900, 1366x768,
1280x650, including actual ZIP SHA-256 and receipt persistence. The persistence/scenario/
export batch passes 91/91; the keyboard/current-surface batch passes 92/92. The accessibility
journey passes four viewport/text configurations with measured minimum text contrast 5.17:1,
visible keyboard focus, usable mapping controls and explicit Package report access. Nested
adder authoring retains four distinct instances and exact SUM=0111, carry=1 on reload;
its execution and automatic mapping stages use runtime calls and are not UI-only proof.

Typecheck is 768 diagnostics / b9e8e0eb29ca1d2a, TS 5.9.3. The decrease from 770 removes two
obsolete control assertions from test consumers; it is not broad production type repair or
an upward rebaseline. The 460-test Design/Verify census is 374 pass / 86 fail. Against the
same baseline suite at 2d3160131 (386 pass / 74 fail), 23 failure identities are new, 11 are
closed, and 63 remain. These are named validation debt, not all pre-existing failures.
See docs/validation/test-debt.md. No skipped tests, suppressions or golden changes were added.

Final quiet-head build, classroom/product gates, built-bundle journeys and matched visual
review remain the next closure steps. Browser E0 only. PR #86 remains draft on the existing
branch and base; no merge, retarget, production deployment, format change or hardware claim.


# RedByte P2.6 — Studio Completion → P2.6B Studio Coherence — RESUME

## P2.6B implementation checkpoint - 2026-09-12

The recorded experiment now displays design + authored stimulus + browser engine identity,
an output digest, and Reproduce. Execution belongs to projectRuntime and reuses retained
inputs and topology; ordinals distinguish recordings without timestamps entering identity.
Output digests use native engine samples, excluding check-driven display aliases. Exact
sample comparison also detects divergence even if compact digests collide.

Design offers explicitly unrecorded Explore and Test this design without auto-execution.
Sequential Simulate uses one Time instrument with stimulus and recorded values; Run uses
the saved optional checks. Zero checks yields a recording, never a passing check verdict.
An explicit circuit investigation walks recorded driver, capturing edge and authored event.
One endpoint resolver feeds time, wire and saved Board projections; missing stays unrecorded.
Project's explorer owns its five documents; an unrelated selected signal does not open its
inspector. Board Check places real step reference and recorded values below the board.
Package keeps generation/files first and displays the downloaded ZIP's SHA-256.

The connected counter repair/package/reload journey passed at 1440x900 and 1280x650.
D1-D3, three-drawing D4 and clickable D5 passed in construction browser runs; VCD import,
measurement/radix and reload passed at 1440x900 and 1366x768. Three negative controls fail
semantically with protections removed and pass after restoration. Typecheck remains 770 /
1165a0a5faf044e6 under Node 20.19.0 and TypeScript 5.9.3. These are construction proofs;
the final quiet-HEAD build, gate outcomes and full visual verdict belong to the P2.6B ticket.


The 512-case hierarchical 4-bit adder import now records 39 native signals and evaluates
2560 authored checks. Reproduce retains digest 140ba365; explicit save and reload preserve
both recordings. The browser journey measured 4.049 s to run and 1.017 s to open/select linked
inspection on this machine. A real quota failure led to lossless packing of waveform columns,
check rows and repeated normalization metadata at existing runtime/repository storage boundaries.
The two-run fixture uses about 5.00 million stored characters; larger retained sets still face
the browser quota and must report save failure. No evidence is silently discarded. Older plain
JSON saves remain readable; portable format 1 and existing storage keys are unchanged.
The storage/repository owner batch passes 23/23, including exact mixed X/Z/missing samples and
both long recordings after rehydration. The latest focused UI/owner batch passes 72/72.

Branch stays claude/redbyte-studio-completion-p2-6-q7m3v8, draft PR #86 with its existing base.
Format 1, protected goldens and upstream PRs are unchanged. Browser E0 only; no merge,
retarget, production deployment or hardware proof. Continue through validation convergence.


> Single continuation point for P2.6 / P2.6B. Newest entry at the top. Canonical repo docs still win:
> `docs/ACTIVE_WORK.md` = project truth · this file = session continuation · PR #86 = review truth.

## 2026-09-12 — P2.6B opened: studio coherence / Design–Simulate partnership (Fable 5.1, desktop) — IN FLIGHT

**Label: P2.6 PHASE 0 CLOSED / PRE-FLIGHT RETIRED / CLASSROOM PASS 2 CLASSIFIED / P2.6B STUDIO
COHERENCE IN FLIGHT / PR #86 DRAFT / NO MERGE / NO PRODUCTION.**

### Exact source truth

| Fact | Value |
|---|---|
| Branch | `claude/redbyte-studio-completion-p2-6-q7m3v8`, branched from PR #85 head `2d3160131` |
| PR | [#86](https://github.com/swaggyp52/redbyte-ui-genesis/pull/86) draft, base `claude/redbyte-operational-workbench-convergence-w9k2r4` |
| Commits since the last pushed head `2909cecd9` | `4a0abec0a` harness recognises the current Simulate stimulus · `a26378370` Pre-flight retired, Board Check the one after-mapping check · (this session) gate fix + docs |
| Typecheck | 770, fingerprint `1165a0a5faf044e6` at every commit (unchanged from PR #85 head) |
| Format version | 1, untouched. Goldens untouched. PR #85 and #84 untouched. `main` untouched. |
| Dev server | `http://[::1]:5173/` — playground Vite; restart with `corepack pnpm --filter @redbyte/playground dev` (background) |
| Built dist | `apps/playground/dist` built at `a26378370` (rebuild before any gate run after a commit) |
| Vivado | not installed on this machine (`C:\Xilinx` absent) — E1 blocked |
| Baseline worktree | `.redbyte/worktrees/base-f35c` at `2d3160131`, sharing this clone's `node_modules`; never recursively delete it, nor `.redbyte/worktrees/before-d688` |

### Phase 0 (closed this session)

1. Pre-flight retired at `a26378370`; every hardwareSurface suite + trust-clarity + history-authority
   green (89/89 + 43/43); CSS audit 0/0; `git diff --check` clean (the mixed-EOL history-authority
   test was patched byte-wise, 3-line diff).
2. Classroom pass 2 at `2909cecd9` (one head, fresh build, harness fix): 21/71. Classification in
   the P2.6 ticket. Not a lost capability among the 50; one real defect (Design left dock "Board I/O"
   tab laid out past a 218px strip); 45 Category B against P2.5 decisions that P2.6B replaces again.
3. Migrated gates at `a26378370`: `examples-contract` PASS, `student-loop-contract` PASS,
   `hardware-checklist-contract` PASS (it now opens a starter first and reveals the collapsed dock).
4. `repo:status --skip-build` at `a26378370`: passes 7 checks, stops at check 8 `IDE Bring-Up
   Contract` = `ide-bringup-contract.test.ts` "expected 'project-vectors' to be 'verify-run'" — the
   P2.5L test-debt entry (`docs/validation/test-debt.md:78`, value-or-copy), unchanged by P2.6.
   The remaining ~28 repo:status checks are therefore unmeasured by that runner.

### P2.6B plan (the owner's 2026-09-12 direction; the unit of work is the Design–Simulate loop)

Phase 1 contract amendment → Phase 2 shell/panel foundation → Phase 3 Design (Explore, dominant
circuit, Split, contextual inspector, Test this design) → Phase 4 Simulate (one Run, one instrument,
one inspector, recording history, provenance, failure flow) → Phase 5 linked investigation →
Phase 6 Project navigation owner → Phase 7 Board/Package polish (Board Check recomposition:
status line, rail with its way back, light frame, steps table) → Phase 8 Start/import → Phase 9
scale/a11y → Phase 10 validation convergence. Acceptance = the twelve journeys in the brief;
the next checkpoint must show Design + Simulate as a coherent pair at 1280x650.

### Measured facts for the next owners (do not re-measure, act)

- Board Check at 1440x900 (fresh profile): command hero 111px (title + description restating the
  hidden readiness callout, five 12px chips at rgba(188,206,224,.76) on white), rail 30px,
  provenance summary 11px uppercase at rgba(130,170,210,.52), dark chrome banner 66px, board
  workspace forced to `clamp(430px, 100vh - 210px, 740px) !important` (ide-polish-pass.css:3309)
  around a 798x334 SVG, exit banner at y=962 under an `overflow-y: hidden` 788px panel body
  (`order: 5`, ide-root.css:22660), checklist in a dock that opens collapsed (`leftDockMode`
  collapsed at HardwareSurface.tsx:3001; the strip's control is `ide-show-left-dock`).
- Design left dock: tabs Components / Hierarchy / Sources / Board I/O in a 218px `wb-toolwindow-tabs`
  strip (`overflow-x: auto; scrollbar-width: none`, design-instrument.css:543) — scrollWidth 314,
  "Board I/O" at x 315–392 outside a dock ending at 320.
- Retired shell selectors still asserted by gates: `ide-topbar-help-btn` (Help is `ide-menu-help`),
  `ide-board-chip` (deliberately absent per `workflowStages.authority.test.tsx:84`).

### Must not be reset

The branch is pushed through `2909cecd9`; the two Phase 0 commits are local until pushed this
session. Do not reset to the remote checkpoint.
