# Product Walkthrough Findings

Date: 2026-05-11

Perspective: beginner ECE141 student using the local browser app at `http://127.0.0.1:5198/`.

Evidence sources:

- Browser snapshots and JSON reports under `.redbyte/course-edition/browser/`.
- Runtime code and docs listed in `00-preflight-report.md`.
- Current readiness docs: `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/vivado-basys3-certification-matrix.md`, `docs/release/redbyte-bench-evidence-model.md`.

## Workflow Findings

| Workflow attempted | Expected behavior | Actual behavior | Evidence captured | Severity | Owner surface | Blocks course deployment? |
| --- | --- | --- | --- | --- | --- | --- |
| Open app/start screen | App launches into current IDE with clear next action. | App loaded. Project showed workflow orientation and `Open Design`. | `browser-audit.json`, `project.png`. | P3 | Project | No |
| Create/open project | Student can start blank or load example/starter. | Project had Build fresh, Import, Open saved project, recent project, curated examples, and Lab 1-8 starters. | Project controls in browser audit. | P2 | Project | No, but needs starter boundary labels. |
| Load basic gate circuit | Logic Gates card loaded and named project correctly. | Loaded successfully. Browser console emitted repeated engine-not-connected warnings. | `starter-workflow-audit.json`. | P1 | Project/runtime | Yes until warning is classified or fixed. |
| Load combinational circuit | Half Adder loaded and export artifacts were available. | Loaded successfully. Same warning class as above. | `starter-workflow-audit.json`. | P1 | Project/runtime | Yes until warning is classified or fixed. |
| Run verification/vector tests | Student should be able to produce trusted compare evidence. | Logic Gates passed after explicitly selecting `Compare checks` then `Run`. Default `Run` path records observe-only output. | `logic-gates-spa2-compare-export.json`. | P2 | Verify | No if docs/UI teach Observe vs Compare clearly. |
| Map pins for Basys3 | Basys3 mapping state should be visible and not imply behavior proof. | Hardware/Map Pins loaded, showed Basys3 resources including clock and switches. | `hardware.png`, browser controls. | P2 | Hardware | Needs deeper pin-edit persistence gate in later task. |
| Export Vivado package | Export should distinguish draft vs ready/trusted and Vivado boundary. | Blank project: blocked/draft. Logic Gates after Compare: `Export Ready to Build`, `Vivado package ready to build`, 9/9 artifacts. | `export.png`, `logic-gates-spa2-compare-export.json`. | P2 | Export | Needs explicit E-tier docs/copy audit. |
| Inspect generated VHDL/XDC/Tcl | Artifacts should be visible for E0 handoff inspection. | Export listed `top.vhd`, `top.xdc`, `vivado_import.tcl`, `README.txt`, `BRINGUP.md`, `EXPECTED_IO.json`, `program_and_test.tcl`, `project.rbproj.json`. | Export controls from `browser-audit.json`. | P2 | Export | No, but golden artifact tests should remain release gate. |
| Distinguish E0/E1/E2/E3 | UI/docs must not conflate export/build/program/observe. | Docs clearly separate tiers. Browser Export copy did not prominently surface E0/E1/E2/E3 in starter snippets. | Certification docs and browser snippets. | P1 | Export/docs | Yes for course package docs and audit. |
| Import project | Import should be utility mode, not primary beginner path. | Import loaded with upload, parse, map, review, apply steps; blocked states visible. | `import.png`. | P3 | Import | No |
| Reset/recovery from bad project | Student should have visible recovery/reset path. | Browser audit did not complete corrupted-project/reset testing. Existing code/docs mention saved project/recovery, but course scripts are not yet bounded. | Project controls and docs. | P1 | Launcher/Project/docs | Yes before course release. |
| Starter examples | Official starters should be ordered and honest about support level. | Lab cards and curated examples visible. Lab 8 is visible as bridge starter. | Project controls; `labStarters.ts`; readiness docs. | P1 | Project/docs | Yes until unsupported/bridge labels are course-visible. |

## Ranked Issues

| Severity | Issue | Evidence | Course action |
| --- | --- | --- | --- |
| P1 | Browser console warns that circuit mutations occur without connected engines. | Starter workflow produced repeated warnings from `circuitStore.ts`. | Classify as benign legacy warning or fix runtime initialization. Add a browser-console gate if not already covered. |
| P1 | Recovery/reset is not yet packaged as a student-safe workflow. | Current launcher exists; course `install/launch/doctor/update/clean-reset` set is not implemented in this task. | Dedicated Windows course-launcher hardening task. |
| P1 | E0/E1/E2/E3 evidence semantics are strong in docs but not yet course-packaged. | Readiness/certification docs are clear; student/professor manuals not yet narrowed. | Create evidence guide and audit UI copy. |
| P1 | Stale docs can mislead users into old OS/workflow truth. | `docs/DOC_INDEX.md` stale zone plus root legacy docs. | Quarantine/archive after approval. |
| P1 | Lab 8 and advanced sequential/bus/SSD paths are visible but not turnkey. | `docs/ACTIVE_WORK.md`, readiness docs, Lab 8 starter metadata. | Label bridge/experimental support boundary in UI and course docs. |
| P2 | Verify Observe vs Compare can be misunderstood. | Default `Run` produced observation-only results; Compare pass required explicit `Compare checks`. | Strengthen next-action copy and student Verify guide. |
| P2 | Export trust state is correct but dense. | Draft/needs-review and ready-to-build copy observed. | Preserve copy; add E-tier explanation where appropriate. |
| P2 | Browser route reload loses transient Verify evidence, while in-app navigation preserves it. | Query navigation to Export showed `Verification Not run`; stage-nav preserved `Checks match`. | Decide whether this is intended persistence model; document for students if local save is required. |
| P2 | Final package boundary is not encoded as a manifest. | Mixed repo content: source, agents, artifacts, stale docs, local ops. | Add manifest after approval. |
| P3 | Some terminal-captured text has encoding artifacts. | PowerShell extraction displayed mojibake for icons/arrows. | Keep UI screenshots as visual source; run encoding check before docs release. |

## Evidence Level Observed in This Session

| Evidence level | Observed this session? | Notes |
| --- | --- | --- |
| E0: RedByte export package exists | Partially | Export artifacts were visible and ready-to-build for Logic Gates after Compare. A downloaded zip/package was not generated in this audit. |
| E1: Vivado build/bitstream exists | No | Relies on existing certification docs; Vivado was not run in this session. |
| E2: Board programmed | No | Relies on existing bench docs; no board was used. |
| E3: Observed physical behavior | No | Current docs correctly keep E3 separate and row-specific. |

## Tests and Docs Needed

| Need | Test or doc |
| --- | --- |
| Browser console cleanliness | Playwright smoke that fails on unexpected console warnings during official starter load. |
| Verify Compare student path | E2E that loads Logic Gates, selects Compare checks, runs, and asserts Export becomes ready-to-build via in-app navigation. |
| Observe-only guardrail | E2E/unit assertion that observe-only runs do not mark Export trusted. |
| Starter support labels | Unit/browser test for supported/bridge/experimental labels on official starter cards. |
| Recovery/reset | Course `doctor` and `clean-reset` docs/scripts plus smoke tests. |
| Evidence guide | Student/professor E0/E1/E2/E3 guide with explicit "E2 is not E3" language. |
