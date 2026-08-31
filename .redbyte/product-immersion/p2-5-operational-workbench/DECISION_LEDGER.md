# P2.5 Decision Ledger

Decisions and their evidence. Newest first.

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
