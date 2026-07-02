---
doc_status: current
last_validated: 2026-07-02
owner: Connor Angiel
used_by_claude: true
role: summer rescue sprint friction audit and chosen usability fix package
---

# RedByte Summer Rescue Audit

## Scope

This audit translates the "make RedByte actually usable" complaint into product friction, not just gate status. It uses current source, current docs, and browser-E0 proof from `ide:gate:testbench-editor-and-export-confidence-flow`. The focused proof ran at `1366x768`; prior adjacent gates still cover many Project, Design, Verify, Hardware, and Export paths at `1366x768` and `1440x900`.

This audit does not prove true 60-minute / 3-hour classroom stability, Vivado E1, bitstream E2, board observation E3, hosted grading, LMS submission, or professor review tooling.

## Hard Product Truth

RedByte is no longer blocked on basic browser-E0 mechanics. Students can create/load a project, build supported circuits, author checks, run Verify, map pins, and inspect/export Vivado files.

The remaining problem is friction under normal student mistakes:

- A wrong expected output still used to feel like a trap because repair scope was unclear.
- A wrong design is more diagnosable than before, but only for bounded/direct traces.
- Export had accurate proof-tier language, but students still needed one compact station answering "is this safe to submit?"
- The UI remains dense for a first-year student who just wants to build logic, test it, and hand a ZIP to a professor.

## Evidence

- New focused gate: `ide:gate:testbench-editor-and-export-confidence-flow`
- Browser proof pack: `.redbyte/product-immersion/testbench-editor-and-export-confidence-flow/`
- Screenshots:
  - `01-verify-authored-multiple-cases.png`
  - `02-observe-expected-and-observed-evidence.png`
  - `03-two-failed-outputs-repair-actions.png`
  - `04-row-repair-pass.png`
  - `05-all-failed-repair-pass.png`
  - `06-testbench-edit-stale.png`
  - `07-export-confidence-stale-draft.png`
  - `08-export-confidence-ready-e0.png`

## Ranked Friction

| Rank | Severity | Surface | Student pain | Instructor pain | Evidence | Likely files | Smallest fix | Blocks Gannon pilot? | Blocks Vivado-grade supplement? |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Blocker | Verify testbench repair | A student can make multiple expected outputs wrong and not know whether `Use observed` changes one cell, a row, or everything. | Failed submissions are hard to diagnose: wrong testbench vs wrong circuit is ambiguous. | New gate first required scoped repair actions; before this sprint only single-cell repair was exposed. | `VerifySurface.tsx`, `ide-root.css` | Add explicit cell, failed-row, and all-failed repair scopes with visible counts. | Yes, for unsupervised Verify repair. | Yes, because stale/wrong proof can flow into Export. |
| 2 | High | Verify testbench authoring | Inputs, expected outputs, observed outputs, and PASS/FAIL status are real concepts but were not presented as one simple mental model. | Professors cannot assume students understand Observe vs Compare from a dense grid alone. | New gate requires first-run sections for Inputs to try, Expected outputs, Observed outputs, and Status. | `ScenarioBuilderPanel.tsx`, `StimulusCanvas.tsx`, `ide-root.css` | Add a compact first-run concept strip, then keep post-run editor uncluttered. | Yes, if students are expected to self-repair. | Medium; affects confidence in generated testbenches. |
| 3 | High | Export | Students need a plain answer: current/stale/failed, mapped/missing, ready/trusted E0 vs draft, Vivado not run, board not observed. | ZIP review needs proof-tier language that is impossible to confuse with Vivado or board proof. | New gate checks `ide-export-confidence-station` in stale/draft and current E0-ready states. | `ExportSurface.tsx`, `ide-root.css` | Add Export confidence station above file inspector. | Yes, for submission clarity. | Yes, because E0/E1/E2/E3 boundaries must be visible. |
| 4 | High | Wrong design debugging | Direct driver and bounded upstream traces help, but disconnected outputs, swapped wires, and larger graphs still require student intuition. | Instructor support still needs manual reasoning for many wrong builds. | `ide:gate:wrong-build-diagnosis-repair-flow` and `ide:gate:complex-build-signal-trace-debugging` prove useful slices only. | `DesignSurface.tsx`, `pathTrace.ts`, Verify debug context | Add miswire/disconnected-output diagnosis and stronger trace grouping in a later slice. | Medium; supervised pilot can recover with help. | High for broader Vivado supplement. |
| 5 | High | Design complex builds | 10+ nodes are possible, but visual comprehension, labeling, and wire tracing still require too much work. | Grading a complex build screenshot or ZIP remains harder than it should be. | Blank adder and complex trace gates prove representative paths, not broad graph readability. | `DesignSurface.tsx`, canvas components, CSS | Add circuit outline/search/grouping and clearer wire-driver affordances. | Medium. | High. |
| 6 | Medium | Stale evidence | Stale states are now clearer, but students still need repeated reinforcement that Design/Testbench/Mapping changes invalidate proof. | A professor needs submissions to say whether Verify was current at export time. | New gate asserts stale testbench copy and stale Export confidence. | `VerifySurface.tsx`, `projectWorkflowAuthority.ts`, `ExportSurface.tsx` | Keep drift source in top-level copy and station rows. | Medium. | High. |
| 7 | Medium | Professor ZIP review | Export previews the files, but professor-facing review still lacks a dedicated rubric/report mode. | Instructors need a fast way to check README, top.vhd, top.xdc, testbench, and provenance. | Export package inspector gates cover files, not a professor review workflow. | `ExportSurface.tsx`, generated README/provenance | Add professor-facing ZIP checklist/report after student flow is calmer. | Medium. | Medium. |
| 8 | Medium | Long-session reliability | Browser gates are deterministic but not the same as a real hour-long lab session with exploration and mistakes. | Pilot risk remains unknown under real student pacing. | Prior Round 7/R7R2 evidence is not true 60-minute/3-hour proof. | Gates, runtime persistence, local storage | Rerun true 60-minute production session after sync. | Yes before broad rollout. | Medium. |
| 9 | Low | Start / Project orientation | Current start paths are much better, but the product still reads more like a workbench than a course assignment. | Instructors may need extra onboarding copy outside the app. | Project command and Gannon pilot gates cover the path, not polish. | `ProjectSurface.tsx`, quickstarts | Course-lab wording pass after core repair loops. | Low. | Low. |

## Chosen Fix Package

The sprint chose **Testbench Editor Simplification + Export Confidence** because it attacks the highest-friction normal mistake: a student builds something, edits the testbench, gets it wrong, and cannot confidently recover.

Implemented fixes:

1. Verify first-run testbench concept strip:
   - Inputs to try
   - Expected outputs
   - Observed outputs
   - Status
2. Scoped `Use observed` repair:
   - one failed cell
   - all failed outputs in the selected row
   - all failed outputs in the run
3. Explicit repair scope summary with failed-row and total failed-output counts.
4. Export confidence station:
   - Verify evidence
   - Pin mapping
   - Package trust / ready-to-build E0 state
   - Vivado build not run in RedByte
   - Board behavior not observed
5. New release-blocking browser gate:
   - `ide:gate:testbench-editor-and-export-confidence-flow`

## What Still Needs Product Work

- Wrong-wire and disconnected-output diagnosis.
- Graph readability for larger student builds.
- A real professor ZIP review/report surface.
- A true 60-minute / 3-hour student-session proof.
- Vivado E1, bitstream E2, and board-observed E3 proof for representative scratch and sequential exports.
- Headed 125 percent accessibility proof.

## Attribution

Connor Angiel
