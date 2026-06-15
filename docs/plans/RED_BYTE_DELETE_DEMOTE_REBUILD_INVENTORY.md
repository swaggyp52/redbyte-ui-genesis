---
doc_status: current
last_validated: 2026-06-14
owner: Connor Angiel
used_by_claude: true
role: RedByte V1 UI/system delete demote rebuild inventory
---

# RedByte Delete / Demote / Rebuild Inventory

This inventory turns the V1 contract reset into concrete surface decisions. It is not a code change list; it is the control layer for future hardening tickets.

Evidence inputs:

- `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`
- `docs/research/RED_BYTE_COMPETITIVE_AND_WORKFLOW_RESEARCH.md`
- `docs/audits/2026-06-13-redbyte-v1-contract-reset-visual-audit.md`
- `.redbyte/product-immersion/v1-contract-reset/screenshots/`

Closeout note: Project launch/cards/no-circuit copy/starter-label demotion rows were addressed locally on 2026-06-13 by the Project Command Center slice. Export handoff summary/evidence ladder/primary action rows were addressed locally on 2026-06-14 by the Export Handoff Station slice. Hardware ready language and Basys3 binding-chain rows were addressed locally on 2026-06-14 by the Hardware / Basys3 Workbench slice. Import utility/recovery rows were addressed locally on 2026-06-14 by the Import / Recovery slice. The first lab profile/course-pack seam was addressed locally on 2026-06-14 by `lab:profile-contract`. Current student/instructor/TA quickstarts were addressed locally on 2026-06-14 under `docs/course/`. Workbench rail pressure and phantom dock-space rows were addressed locally on 2026-06-14 by `ide:gate:workbench-space-utilization`. Future Project work should start from `ide:gate:project-command-center`, future Export work should start from `ide:gate:export-handoff-station` plus `ide:gate:export-trust-integrity`, future Hardware work should start from `ide:gate:hardware-basys3-workbench`, future Import work should start from `ide:gate:import-recovery-contract`, future profile/course-pack work should start from `lab:profile-contract`, future course-doc work should start from `docs/course/STUDENT_QUICKSTART.md`, `docs/course/INSTRUCTOR_QUICKSTART.md`, and `docs/course/TA_TROUBLESHOOTING_GUIDE.md`, and future rail/layout work should start from `ide:gate:workbench-space-utilization`.

## Decision Terms

| Decision | Meaning |
|---|---|
| Keep | Current element is directionally right; only local polish may be needed. |
| Rebuild | Preserve purpose, but redesign structure, priority, language, or state ownership. |
| Demote | Keep available, but move out of the default first-order student path. |
| Delete | Remove from the V1 default path unless a later ticket proves need. |
| Defer | Good later idea, but not part of near-term V1 execution. |

## Inventory

| Element | Current problem | Student value | Professor value | Decision | Likely files | Proof needed |
|---|---|---|---|---|---|---|
| Top product shell | Repeats mode, board, build, save, help, stage, and evidence state across too many regions. | Orientation and confidence. | Consistent class workflow. | Rebuild | `IdeApp.tsx`, `IdeWorkbenchShell.tsx`, `IdeLeftRail.tsx`, `workflowStages.ts`, `ide-root.css` | Cross-surface screenshots, no overflow, existing workflow gates. |
| Top lab-flow ribbon | Takes first-viewport height and can conflict with surface-local trust copy. | Shows progress. | Explains assignment status. | Rebuild | `workflowStages.ts`, shell components, `projectWorkflowAuthority.ts` | One state language across Project/Verify/Hardware/Export. |
| Left rail | Useful navigation, but support/tool rails can still narrow the real workbench when left open by default. | Fast navigation. | Stable workflow labels. | Rebuild / partially closed | `IdeLeftRail.tsx`, shell CSS, surface configs | `ide:gate:workbench-space-utilization` now proves support rails do not squeeze Design/Verify focal objects below useful size. |
| Right inspector rail | Closed 2026-06-14 for default rail pressure: hidden/collapsed right docks no longer reserve phantom workbench columns, and Design Inspector starts collapsed/restorable. | Detailed inspection. | Debug/review support. | Demote / closed locally | `IdeWorkbenchShell.tsx`, surface right docks | `ide:gate:workbench-space-utilization`; default first viewport works without inspector dominance while restore affordance remains. |
| Evidence box | E0/E1-E3 boundary is essential, but it consumes prominent shell space. | Prevents overclaiming. | Safe assignment language. | Rebuild | shell/status components | E0 boundary visible without displacing workbench object. |
| Build hash / dev chrome | Useful for maintainers, not central to student workflow. | Low. | Useful in support screenshots. | Demote | top shell/status bar | Support/debug path still exposes hash; student path calmer. |
| Bottom status pill | Repeats workflow status and can create a third status authority. | Low/medium. | Support clue. | Demote | `IdeStatusBar.tsx`, shell CSS | No contradiction with surface status. |
| Project launch hero | Better than previous audits, but still starter-first and course-specific. | Start the right lab. | Instructor path later. | Rebuild | `ProjectSurface.tsx`, project panels, CSS | Blank/starter/saved/import/lab profile paths visible and ordered. |
| Project cards | Cards are visible, but hierarchy reads like a dashboard, not a command center. | Pick route quickly. | Configure course path later. | Rebuild | `ProjectSurface.tsx` | First action chosen in under 10 seconds in screenshot review. |
| Project no-circuit mapping copy | `Mapping 0 missing` before a circuit exists reads like a false failure. | Avoids confusion. | Fewer support questions. | Rebuild | `projectWorkflowAuthority.ts`, `workflowStages.ts` | No-circuit state is neutral in tests/screenshots. |
| Starter/course labels | ECE141 and starter-specific copy remains product-dominant. | Useful for the current course. | Useful only if course-specific. | Demote | `labStarters.ts`, `examplesCatalog.ts`, Project copy | Product-general path remains primary. |
| Design palette | Closed 2026-06-14 for default pressure: valuable palette remains restorable, but it no longer opens by default and squeezes the circuit graph. | Build circuits. | Shows supported primitive scope. | Rebuild / closed locally | `DesignSurface.tsx`, design CSS | `ide:gate:workbench-space-utilization`; graph remains visible and palette can reopen. |
| Design toolbar | Necessary, but too much first-order chrome. | Tool selection. | Demonstrates editor seriousness. | Rebuild | `DesignSurface.tsx`, `DesignWorkspaceFrame.tsx` | Tool controls stable; graph first. |
| Design starter banner | Context helps, but it displaces the circuit in first viewport. | Know what loaded. | Assignment context. | Demote | `DesignSurface.tsx` | Circuit graph visible after starter load. |
| Design inspector | Closed 2026-06-14 for default pressure: useful inspector remains restorable and opens on demand, but idle Canvas mode no longer gives it first-order width. | Contextual detail. | Debug/review. | Demote / closed locally | `DesignSurface.tsx`, right dock | `ide:gate:workbench-space-utilization`; default idle inspector not first-order. |
| Circuit graph/canvas | Closed 2026-06-14: Design Canvas mode makes the graph/canvas first-order at `1366x768` and `1440x900`, with palette/inspector supporting rather than displacing authoring. | Inspect and edit actual circuit. | Trust loaded lab state. | Keep/Rebuild locally | `DesignSurface.tsx`, `LogicCanvas`, layout CSS | `ide:gate:design-workbench-v1`; before/after screenshots under `.redbyte/product-immersion/design-workbench-v1/`. |
| Verify command strip | Behavior is correct, but controls dominate evidence. | Run/compare/repair. | Proof clarity. | Rebuild | `VerifySurface.tsx`, `VerifyCommandBar.tsx` | Evidence hierarchy visible at `1366x768`. |
| Verify stimulus grid | Real and editable, but dense and partially clipped in first viewport. | Author checks. | Assignment vectors. | Rebuild | `VerifySurface.tsx`, scenario builder CSS | Inputs/expected/observed layout readable. |
| Verify failure explainer | Strongest current learning affordance. | Debug wrong circuit/check. | Better student self-repair. | Keep/Rebuild locally | `VerifySurface.tsx` | First mismatch remains primary after layout reset. |
| Waveform / oscilloscope | Closed 2026-06-14 for rail pressure: Verify Signals now starts collapsed/restorable, giving waveform/evidence a larger readable area by default. | Understand time/ticks. | Sequential proof teaching. | Rebuild / partially closed | `WaveformInstrument.tsx`, Verify CSS, shell support rails | `ide:gate:workbench-space-utilization`; tick/case lock-step visible and support rail does not steal evidence space. |
| Hardware guide | Now readable, but still takes first-order rail space. | Understand mapping task. | Board handoff clarity. | Demote | `HardwareSurface.tsx` | Board/table remain first-order. |
| Hardware table | Valuable and visible. | Map signals. | Trace assignment IO. | Keep/Rebuild locally | `HardwareSurface.tsx` | Signal rows visible with board at `1366x768`. |
| Basys3 board visual | Valuable and differentiating. | See physical target. | Confirms board-specific workflow. | Keep/Rebuild locally | `Basys3BoardView.tsx`, `HardwareSurface.tsx` | Highlight and mapped state remain synchronized. |
| Hardware ready language | Closed 2026-06-14: ready copy is E0-only, selected rows expose signal -> board resource -> package pin -> XDC, and Vivado build/programming/observation proof stays external. | Next action. | Proof safety. | Keep/Rebuild locally | `HardwareSurface.tsx`, workflow authority | `ide:gate:hardware-basys3-workbench`; Hardware visual credibility; Map Pins recovery. |
| Export handoff summary | Closed 2026-06-14: readiness, mapping/provenance, package handoff, and Vivado next steps now read as one visible station. | Trust package. | Grade/support evidence. | Keep/Rebuild locally | `ExportSurface.tsx`, export primitives, workflow authority | `ide:gate:export-handoff-station`; no regression of mapped summary; Export trust gate and screenshots pass. |
| Export evidence ladder | Closed 2026-06-14 for Export: README preview and evidence boundary keep E0/E1/E2/E3 visible and external/manual beyond E0. | Know what package proves. | Safe classroom language. | Keep | `ExportSurface.tsx` | `ide:gate:export-handoff-station`; no E1/E2/E3 browser overclaim. |
| Export primary action | Closed 2026-06-14: Draft routes to repair/review, Ready builds, Trusted remains download-oriented instead of jumping to hardware proof. | Download/build package. | Handoff to Vivado. | Keep | `ExportSurface.tsx` | One trust state, one primary repair/build/download action. |
| Import wizard | Closed 2026-06-14: Import is a Project utility path. First look leads with RedByte manifest restore as highest fidelity, labels Vivado/VHDL as reconstruction-limited, and keeps failure/replacement safe. | Recover/import work. | Instructor migration path. | Keep/Demote locally | `ImportSurface.tsx`, `ProjectSurface.tsx` | `ide:gate:import-recovery-contract`; no parser/export/Verify/pin semantics changed. |
| Debug/dev details | Some internal proof/data details appear in student path. | Low. | Support only. | Demote | Multiple surfaces | Advanced/details disclosures hold support content. |
| Chips/status pills | Useful language, but too many styles and authorities. | Quick scan. | Review readiness. | Rebuild | shared primitives/CSS | Shared state grammar across surfaces. |
| Accounts/SaaS/classroom groups | Not present and not currently needed for V1 trust. | Later convenience. | Later management layer. | Defer | Future hosted layer | Concrete hosted-data requirement before work starts. |
| Lab profile/course-pack seam | First data-only seam is now present; deeper authoring and course-pack distribution remain future work. | Instructor-authored labs later. | Core future value. | Keep / extend later | `RED_BYTE_LAB_PROFILE_MODEL.md`, `packages/rb-apps/src/apps/ide/labProfiles/`, starter data | `lab:profile-contract`; future profile-backed UI only after a specific ticket. |

## Near-Term Deletion / Demotion Rules

- Delete duplicate status presentation only when a replacement owner is already proven.
- Demote debug/support details behind existing disclosures before removing them.
- Do not delete E0/E1/E2/E3 language.
- Do not delete import; keep it utility-scoped.
- Do not delete starter paths; demote course specificity and make blank/instructor paths first-class.
- Do not delete hardware proof boundaries in pursuit of a cleaner UI.

## Next Ticket To Code

Use this structured ticket before the next proof slice:

- Title: Restore fresh RedByte Vivado/Basys3 proof.
- Surface: Release proof, certification matrix, and hardware evidence docs.
- Journey segment: RedByte export package moves through Vivado build, Basys3 programming, and physical observation when evidence exists.
- Observed behavior: browser/package proof and quickstarts are current, but fresh Vivado 2024.2 and Basys3 E1/E2/E3 proof was not run in this reset.
- Expected behavior: named project rows gain only the proof tiers actually produced by Vivado and board runs; no screenshot-only or browser-only hardware claims.
- Acceptance proof: Vivado 2024.2 environment check; E1 logs; E2 programming logs when board access exists; E3 observation notes only when behavior is actually observed; release docs updated; docs validation and encoding check pass.

## Attribution

Connor Angiel
