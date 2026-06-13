---
doc_status: current
last_validated: 2026-06-13
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
| Left rail | Useful navigation, but duplicates stage status and narrows workbench. | Fast navigation. | Stable workflow labels. | Rebuild | `IdeLeftRail.tsx`, shell CSS | First viewport keeps work object visible at `1366x768`. |
| Right inspector rail | Hidden/collapsed states are useful, but default inspector content often competes with the work object. | Detailed inspection. | Debug/review support. | Demote | `IdeWorkbenchShell.tsx`, surface right docks | Default first viewport works without inspector dominance. |
| Evidence box | E0/E1-E3 boundary is essential, but it consumes prominent shell space. | Prevents overclaiming. | Safe assignment language. | Rebuild | shell/status components | E0 boundary visible without displacing workbench object. |
| Build hash / dev chrome | Useful for maintainers, not central to student workflow. | Low. | Useful in support screenshots. | Demote | top shell/status bar | Support/debug path still exposes hash; student path calmer. |
| Bottom status pill | Repeats workflow status and can create a third status authority. | Low/medium. | Support clue. | Demote | `IdeStatusBar.tsx`, shell CSS | No contradiction with surface status. |
| Project launch hero | Better than previous audits, but still starter-first and course-specific. | Start the right lab. | Instructor path later. | Rebuild | `ProjectSurface.tsx`, project panels, CSS | Blank/starter/saved/import/lab profile paths visible and ordered. |
| Project cards | Cards are visible, but hierarchy reads like a dashboard, not a command center. | Pick route quickly. | Configure course path later. | Rebuild | `ProjectSurface.tsx` | First action chosen in under 10 seconds in screenshot review. |
| Project no-circuit mapping copy | `Mapping 0 missing` before a circuit exists reads like a false failure. | Avoids confusion. | Fewer support questions. | Rebuild | `projectWorkflowAuthority.ts`, `workflowStages.ts` | No-circuit state is neutral in tests/screenshots. |
| Starter/course labels | ECE141 and starter-specific copy remains product-dominant. | Useful for the current course. | Useful only if course-specific. | Demote | `labStarters.ts`, `examplesCatalog.ts`, Project copy | Product-general path remains primary. |
| Design palette | Valuable, but currently competes with the circuit graph. | Build circuits. | Shows supported primitive scope. | Rebuild | `DesignSurface.tsx`, design CSS | Graph remains visible with palette present. |
| Design toolbar | Necessary, but too much first-order chrome. | Tool selection. | Demonstrates editor seriousness. | Rebuild | `DesignSurface.tsx`, `DesignWorkspaceFrame.tsx` | Tool controls stable; graph first. |
| Design starter banner | Context helps, but it displaces the circuit in first viewport. | Know what loaded. | Assignment context. | Demote | `DesignSurface.tsx` | Circuit graph visible after starter load. |
| Design inspector | Useful when selection exists, but default idle inspector consumes workbench space. | Contextual detail. | Debug/review. | Demote | `DesignSurface.tsx`, right dock | Default idle inspector not first-order. |
| Circuit graph/canvas | The most important Design object is not first-viewport primary at `1366x768`. | Inspect and edit actual circuit. | Trust loaded lab state. | Rebuild | `DesignSurface.tsx`, `LogicCanvas`, layout CSS | Visible nodes/connections without scroll after starter load. |
| Verify command strip | Behavior is correct, but controls dominate evidence. | Run/compare/repair. | Proof clarity. | Rebuild | `VerifySurface.tsx`, `VerifyCommandBar.tsx` | Evidence hierarchy visible at `1366x768`. |
| Verify stimulus grid | Real and editable, but dense and partially clipped in first viewport. | Author checks. | Assignment vectors. | Rebuild | `VerifySurface.tsx`, scenario builder CSS | Inputs/expected/observed layout readable. |
| Verify failure explainer | Strongest current learning affordance. | Debug wrong circuit/check. | Better student self-repair. | Keep/Rebuild locally | `VerifySurface.tsx` | First mismatch remains primary after layout reset. |
| Waveform / oscilloscope | Credible but cramped beside controls. | Understand time/ticks. | Sequential proof teaching. | Rebuild | `WaveformInstrument.tsx`, Verify CSS | Tick/case lock-step visible; no control overlap. |
| Hardware guide | Now readable, but still takes first-order rail space. | Understand mapping task. | Board handoff clarity. | Demote | `HardwareSurface.tsx` | Board/table remain first-order. |
| Hardware table | Valuable and visible. | Map signals. | Trace assignment IO. | Keep/Rebuild locally | `HardwareSurface.tsx` | Signal rows visible with board at `1366x768`. |
| Basys3 board visual | Valuable and differentiating. | See physical target. | Confirms board-specific workflow. | Keep/Rebuild locally | `Basys3BoardView.tsx`, `HardwareSurface.tsx` | Highlight and mapped state remain synchronized. |
| Hardware ready language | "Ready to build hardware" can read beyond E0. | Next action. | Proof safety. | Rebuild | `HardwareSurface.tsx`, workflow authority | Copy says E0 handoff / Vivado next, not hardware proof. |
| Export handoff summary | Right concept, but mapping summary can contradict mapped state. | Trust package. | Grade/support evidence. | Rebuild | `ExportSurface.tsx`, export primitives, workflow authority | No contradictory mapped/unmapped text. |
| Export evidence ladder | Essential, but dense and low in viewport. | Know what package proves. | Safe classroom language. | Rebuild | `ExportSurface.tsx` | E0/E1/E2/E3 ladder readable and first-order enough. |
| Export primary action | Visible now, but surface still repeats trust state. | Download/build package. | Handoff to Vivado. | Keep/Rebuild locally | `ExportSurface.tsx` | One trust state, one primary action. |
| Import wizard | Correct as utility, but too prominent if treated as main spine. | Recover/import work. | Instructor migration path. | Demote | `ImportSurface.tsx` | Utility path clear; not primary workflow. |
| Debug/dev details | Some internal proof/data details appear in student path. | Low. | Support only. | Demote | Multiple surfaces | Advanced/details disclosures hold support content. |
| Chips/status pills | Useful language, but too many styles and authorities. | Quick scan. | Review readiness. | Rebuild | shared primitives/CSS | Shared state grammar across surfaces. |
| Accounts/SaaS/classroom groups | Not present and not currently needed for V1 trust. | Later convenience. | Later management layer. | Defer | Future hosted layer | Concrete hosted-data requirement before work starts. |
| Lab profile/course-pack seam | Important, but less urgent than trust and workbench hierarchy repair. | Instructor-authored labs later. | Core future value. | Defer to queue item 11 | `RED_BYTE_LAB_PROFILE_MODEL.md`, starter data | First profile-backed lab after Export trust, Verify, shell/Project/Export/HW/Design stability. |

## Near-Term Deletion / Demotion Rules

- Delete duplicate status presentation only when a replacement owner is already proven.
- Demote debug/support details behind existing disclosures before removing them.
- Do not delete E0/E1/E2/E3 language.
- Do not delete import; keep it utility-scoped.
- Do not delete starter paths; demote course specificity and make blank/instructor paths first-class.
- Do not delete hardware proof boundaries in pursuit of a cleaner UI.

## Next Ticket To Code

Use this structured ticket before the next code slice:

- Title: Reset RedByte workbench shell layout.
- Surface: Global shell and first-viewport frame across Project, Design, Verify, Hardware, Export, Import.
- Journey segment: first lab start through verified mapped export.
- Observed behavior: repeated shell/status authorities and surface-local chrome compete with the work object.
- Expected behavior: one compact shell/status authority; each surface first viewport focuses on the current job.
- Acceptance proof: before/after screenshots at `1366x768`, `1440x900`, `1920x1080`; no root overflow; existing behavior gates green; no semantics/export/golden/hardware changes.

## Attribution

Connor Angiel
