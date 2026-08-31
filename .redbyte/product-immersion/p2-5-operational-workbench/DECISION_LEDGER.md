# P2.5 Decision Ledger

Decisions and their evidence. Newest first.

## D-5 — Slice 3: the Compare repair loop now shows a real verdict (the #1 usability defect)

**Discovered (probe):** Running the Full Adder's 16 saved checks rendered
"Simulation complete" / `data-kind='observe-done'` with **no pass/fail verdict and
no pass-hero — for BOTH a correct AND a deliberately broken circuit.** The central
classroom activity (Compare, inspect the mismatch, repair, re-run) gave the
student no verdict. This is the concrete core of Connor's "technically broad but
not practically useful."

**Root cause:** `VerifySurface.tsx` (~L5932) hardcoded the `VerifyResultsSummary`
`kind` to `'observe-done'` (unless stale) and the headline to "Simulation
complete" — never reading the compare verdict, even though the run *did* evaluate
the checks (store state was `pass`) and the `VerifyResultsSummary` component
already fully supports `kind: 'pass' | 'fail' | 'stale' | 'observe-done'` and
renders `ide-verify-pass-hero` for `'pass'`.

**Fix (landed):** feed the already-computed session verdict into the call site —
`sessionShowsAssertionMatch → 'pass'` ("Compare passed — outputs match
expectations"), `sessionSignalsAssertionFailure → 'fail'` ("Compare failed —
outputs differ"), else `'observe-done'`, with `stale` still taking precedence.
One localized call-site change; no run-engine, format, store, or golden change.

**Proof:** `compare-verdict-journey.mjs` drives the real UI through
PASS → (break a gate in Design) → FAIL → (undo) → PASS and asserts the verdict +
pass-hero each time, at 1440×900 and 1366×768, 0px overflow. Vitest: the verify
suites go **30 → 26 failed (+4 fixed, 0 regressions)** — it fixes the recorded
`ide-verify-pass-hero` baseline-red ("pass run evidence as the primary proof
block") plus three "marks PASS stale" board-clock tests. Two `workstation` tests
that asserted the *old* masking behavior (a passing compare reading "Simulation
complete"; a failing compare rendering `observe-done`) were demonstrably obsolete
and updated to the correct verdicts. Both classroom golden Basys3 export gates
byte-identical (2/2 green).

**This is the core of Journey A** (failure → repair → PASS) proven end-to-end.
Remaining Journey-A tail (map → trusted export → inspect HDL/XDC/testbench →
download → reload) is now unblocked and is the next increment. Secondary Simulate
gaps still open: the row-level `ide-verify-mismatch-list` did not populate for the
gate-deletion break in the probe (verdict is correct; the detailed mismatch table
needs its own pass) — recorded for the Slice-3 follow-on.

## D-4 — Baseline reds are redder than Slice 0 recorded (18 pre-existing failures found)

While validating Slice 2 (stash-compare on 4 Project/IdeApp suites), 18 failures
reproduced **identically with my changes stashed** — so pre-existing, not mine.
Slice 0 recorded only the 4 verify suites; it missed these. Root cause of the
largest block is a test-harness gap, not a product defect:

- **`ideApp.labday-wiring` (13 tests): `useTheme must be used within ThemeProvider`.**
  Commit `77145258b` (light-first theme identity) added a `useTheme()` call at
  `IdeApp.tsx:289`; the suite renders `<IdeApp />` bare at 10+ sites and was never
  wrapped in `<ThemeProvider>`. Present at `8a5cbef74` (before all P2.5 code).
  Disposition: **fix the harness** (wrap the renders) — a clean baseline-red
  repair, not a product change or a skip.
- **`projectSurface.submission` (4) + `projectSurface.continuity` (1):** to be
  triaged (loaded-overview `ide-project-open-map-pins`, mojibake-suffix, mapping
  inline). Pre-existing (same count with Slice 2 stashed). Recorded for Slice 7.

**Landed this checkpoint (`ideApp.labday-wiring` 13 → 4):** (1) wrapped every
`<IdeApp/>` render in `<ThemeProvider>` — restored 7 tests that only crashed on
the missing provider; (2) replaced the removed-testid reads
`getByTestId('ide-topbar-mode-label')` with an `activeModeText()` helper that
reads the current authority (the active stage-nav button, `aria-current="step"`) —
restored 2 more. Both are correct baseline-red repairs (harness + stale testid),
not skips. **Remaining 4 are genuine product-triage, deferred to Slice 7, NOT
fixed:** FPGA part edit not propagating to the Vivado export script (`xc7a100…`
expected, `xc7a35…` Basys3 default emitted — real defect *or* an intentionally
Basys3-locked flow; decide with evidence), structural-blocker dominance, scenario
provenance through Verify/Export/Hardware, and starter-compare detach. These need
per-test product investigation and must not be papered over.

Rule reaffirmed: never treat a pre-existing baseline as my regression; fix the
harness where the "failure" is only a missing provider or a removed testid;
product-triage the rest, honestly, in Slice 7.

## D-3 — Slice 2 Project landing: one dominant action, subordinate alternatives, no giant hero

**Decision (landed):** The no-circuit landing (`ProjectLanding`) leads with one
dominant primary card ("Start a Lab" + a one-line rationale) and demotes the four
alternatives (Open Starter / Import Project / Open Existing / Build Fresh) into a
single subordinate cluster — instead of five peer buttons in a flat wrap row. The
hero h1 shrinks from `clamp(…, 2.7rem)` to `clamp(…, 1.9rem)` (Connor: "no giant
heroes"); the `.ide-project-v3-welcome` reserved-and-centered 220px band becomes a
top-aligned, tighter block (reclaims the top empty band); and the restating
summary line ("Start a Lab is the recommended course path…") is removed — the
hierarchy is now shown, not narrated.

**Why:** Connor's first-impression complaint ("hero + 5 peer buttons; one dominant
action wanted; secondary paths visually secondary") plus his explicit dislikes
(giant heroes, flat/empty). The change executes his stated preferences directly;
it is not a speculative redesign. `project-landing-proof.mjs` proves it at
1440×900 + 1366×768 (dominant primary 68px vs subordinate 36px; no summary line;
0px overflow); `projectSurface.unifiedOverviewV3` (asserts the landing buttons) and
the `projectSurface.continuity` landing assertions stay green.

**Honest remaining gap (flagged for visual review, NOT yet fixed):** the empty
region *below* the RECENT card at 1440×900 persists — the fresh-project landing
lacks content to fill 900px. Filling it well (e.g., an inline compact lab-pack
preview) is a design-judgment call better made with Connor's eyes on it than
guessed while he is away. Recorded as the remaining Slice-2 item.

**Boundary honored:** landing testids/labels preserved (tests unbroken); no
format/golden/store change; no new tabs; surface not emptied.

## D-2 — Slice 1 shell: one per-stage status authority; several audit items rejected on verification

**Decision (landed):** The footer status bar (`IdeStatusBar`) no longer renders
the Simulate / Board / Package workflow-status pills. Those facts are owned once,
by the top-center stage-nav (`IdeStageNav`, fed by `stageStatus` in `IdeApp`).
The footer keeps genuine support context only: checks health, storage location,
problems count — matching its own contract test ("support context, not a workflow
authority"). `shell-status-authority-journey.mjs` proves it at 1440×900 + 1366×768
(footer carries no `ide-status-{simulation,board,package}`; stage-nav hints do;
0px overflow). `IdeStatusBar` + `workflowStages.authority` suites green (7/7).

**Why:** Connor's "duplicate status" complaint, made concrete by the Slice-0
audit: the same verify/hardware/export state appeared in the stage-nav AND the
footer. The stage-nav is the better home (inline, beside each stage button), so
the footer duplication is what goes.

**Audit items VERIFIED-AND-REJECTED (don't blindly trust the audit, either):**
- *"Render LocationBar only in Design."* REJECTED. `engineering-location-journey`
  proves the LocationBar is a cross-mode Back/Forward/Up authority (navigates and
  asserts in hardware mode). Restricting it to Design would break real, tested
  navigation and delete a feature. The band stays on all stages.
- *"Remove the `<1400px` display:none on the top-bar save label."* REJECTED. That
  rule is intentional and paired with the footer Storage pill (comment at
  product-system-v3.css:736 — the dot stays aria-labelled, the status bar keeps
  the full save text). Removing it pushes the top bar past the 1366px classroom
  width. Kept as-is; the footer Storage pill kept for the same reason (it is the
  only save *text* at 1366px, not naive duplication).
- *"Delete the Board: Basys3 top-bar chip."* DEFERRED/low value — it is product
  identity (target board), asserted by `workflowStages.authority`, and is not
  status duplication. Left in place.

**Audit item DEFERRED (real, but not a safe autonomous push):**
- *Merge `product-system-v3.css` + `unified-workbench-v3.css` shell rules into one
  authority.* This is the audit's root-cause "two stylesheets fighting via
  `!important`" item. It is a large, visual-regression-prone change that needs
  headed before/after review at both viewports — not a change to land blind while
  Connor is away. Recorded for a reviewed slice.

**Boundary honored:** no format/golden change; no new store; stage-nav remains the
single workflow-status authority; footer remains a single support-context strip.

## D-1 — Imported-VCD Analyzer collapses on native projects (Slice 3, landed)

**Decision:** With no VCD loaded (and no parse error), `VcdAnalyzerPanel` renders a
single compact affordance (provider chip + "Optional external waveform evidence —
replayed, never executed" + Load button), not the full header + honesty paragraph
+ giant dashed empty box.

**Why:** On the native Full Adder lab, `baseline/simulate-1440x900.png` shows the
empty imported-VCD Analyzer consuming ~180px of prime real estate and pushing the
native scenario timeline + Drive inputs + Inspector below the fold. The directive
mandates "Imported VCD should not dominate a native project before a VCD is
loaded." `baseline/simulate-after-fix-1440x900.png` shows Drive inputs (SW0/SW1/
SW2) and the event controls now in the first viewport.

**Boundary honored:** still honest (imported = external, replayed, never executed);
reuses the `importedWaveform` store authority; no new store; no format change;
goldens untouched. Five analyzer journeys still pass.

## Baseline-red disposition (Slice 7 — recorded now, fixed later)

Reproduced at the branch point under pinned Node 20.20.x. Four suites / 8 tests.
**Not yet fixed** — recorded here with a provisional root cause; each will be
product-fixed or its stale assertion updated with evidence during Slice 7 (or
sooner where a slice touches the surface).

| Test | Failure | Provisional root cause |
|---|---|---|
| `verifySimulationStudio.v3` "no-check stimulus… keeps checks optional" | expects Run label to contain "Run simulation"; got "Run · observe only" | **Stale assertion** — the run label was intentionally shortened. Update the test in Slice 3. |
| `verifySurface.waveform-priority` ×4 ("mapped input stimulus lanes by default / on FAIL / stable / ordering") | waveform lanes exclude `sw0`/`carry`; got `[]` | **Candidate real defect** — mapped input stimulus lanes are the repair-context signal; if they no longer default-show, the failure→repair loop (Slice 3) is weakened. Investigate the lane-priority model before deciding. |
| `verifySurface.desktopComposition` "announcer changes text for distinct runs" | expects "Verification run 1. Compare passed."; got "Simulation run 1. Simulation complete…" | **Likely stale** — announcer wording changed (Simulation vs Verification/Compare). Confirm the compare-pass announcer path in Slice 3. |
| `verifySurface.desktopComposition` "pass run evidence as primary proof block" | `ide-verify-pass-hero` not found | **Candidate real defect** — a "pass hero" primary proof block was expected; Slice 3/4 want pass evidence as the primary proof. Decide: restore the block or update the contract. |
| `verifySurface.simulationStudio` "names the student task directly" | heading "Simulation Studio" not found | **Stale assertion** — the Simulate heading changed. Update in Slice 1/3. |

**Rule:** repair the product when the behavior is wrong; update the test only when
the old assertion is demonstrably obsolete; never blanket-skip/delete a test.

## Standing non-authorizations (this program)

Format v1 stays (v2 gated behind `FORMAT_V2_SIGNOFF.md`); both classroom goldens
byte-identical; no golden regeneration; no cloud/auth; no production deploy; no
`main`/product push; no force-push; do not merge PR #84 or the P2.5 PR; one
writable authority per concern; no second store/parser/app/shell.
