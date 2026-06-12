---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: browser-backed visual product direction audit
---

# RedByte Visual Product Direction Audit - 2026-06-12

## Scope

This audit reviews the visible product direction after the first-viewport repair. It used the running browser app and screenshots at `1366x768`, `1440x900`, and `1920x1080`.

This is not a source implementation pass. It did not change circuit semantics, Verify behavior, export generation, VHDL, XDC, TCL, classroom goldens, Vivado proof, or Basys3 proof.

## Method

- Repo: `C:\Users\conno\OneDrive\Documents\RedByte FPGA`
- Branch: `main`
- Runtime observed: Node `v24.15.0`, `corepack pnpm` `10.24.0`
- Dev command: `corepack pnpm run dev`
- Served URL: `http://localhost:5173/`
- Capture command: repo-local Playwright script under ignored `.redbyte/product-immersion/visual-direction-audit/2026-06-12/`
- Viewports: `1366x768`, `1440x900`, `1920x1080`
- Browser console: no console messages recorded during capture
- Capture count: 22 screenshots and 22 DOM summaries

Ignored artifact paths:

- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-public-start-path.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-project-empty.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-design-logic-gates.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-verify-pass.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-hardware-map-pins.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-export-ready.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1366x768-import-entry.png`
- matching `1440x900-*` and `1920x1080-*` screenshots
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/1440x900-project-dirty-storage-resume.png`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/visual-audit-dom-summary.json`
- `.redbyte/product-immersion/visual-direction-audit/2026-06-12/visual-audit-screenshots.json`

## Overall Verdict

RedByte is now directionally credible, but not visually finished. The public start path communicates the right product: a serious FPGA learning workbench with proof-backed Vivado handoff. The IDE surfaces still feel like several generations of UI layered together: dense engineering controls, repeated chips, large dark panels, surface-specific cards, and inconsistent focal hierarchy.

The right direction is Course Lab Workbench:

- serious engineering tool
- visible circuit/proof/board/export artifacts
- calm but dense layout
- proof and trust states visible without marketing language
- fewer decorative cards and badges
- one dominant object per surface

The current app is strongest when it shows an actual circuit, waveform, Basys3 board, or export package. It is weakest when it explains itself through many panels, pills, and small status labels.

## Cross-Surface Observations

### What Looks Real

- The public start path has a clear FPGA workflow and honest Vivado boundary.
- The 1920 Design view is the best in-app direction: the circuit graph can become the main visual object.
- Verify has credible proof density because waveforms, compare rows, and pass state are visible.
- Export copy is mostly honest about handoff and trust state.
- The Basys3 board SVG gives Hardware the right domain-specific object.

### What Looks Vibe-Coded

- Multiple surfaces use card-on-card and panel-on-panel framing instead of a single task workbench.
- Status chips and small badges repeat across rails, headers, panels, and tables until they lose meaning.
- Typography is too flat inside dense surfaces; many important labels look the same size and weight.
- The left rail, surface header, workflow rail, and local panels sometimes all explain the same state.
- Large dark empty regions read as unfinished space rather than deliberate workspace.
- Surface-specific styling appears to have accumulated faster than shared primitives.

## Surface Findings

### Public Start Path

Verdict: strongest product direction.

At all viewports, the public entry makes RedByte feel like a proof-backed FPGA workflow rather than a toy. The headline and route sequence are clear. It is still more landing-page-like than the app itself, which creates a tone gap when moving into Project.

Keep:

- proof-backed workflow language
- Vivado boundary language
- direct Open IDE action

Change later:

- replace bare `pnpm` snippets with `corepack pnpm` or clearly label when a global shim is required
- visually tie the public entry more directly to the actual IDE workbench

### Project

Verdict: improved first viewport, still too dashboard/landing heavy.

The first-viewport repair makes starter actions visible. The empty Project state still has large dark bands and repeated card groupings. It should feel like course mission control: current lab, project health, recommended next step, and proof status.

Likely files:

- `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/project/ProjectSurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- `packages/rb-apps/src/apps/ide/ide-polish-pass.css`

Actions:

- emphasize current lab/project identity over generic welcome framing
- demote repeated status chips
- standardize starter cards as compact course objects
- make dirty/resume state a first-class Project mode

### Design

Verdict: promising at 1920, cramped at 1366.

The circuit canvas is the product. At 1366, the palette, lower inspector, and surrounding chrome compete with the graph. At 1920, the circuit finally reads as the focal object. The zoom popover and dense rails can obscure the workbench.

Likely files:

- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/components/DesignWorkspaceFrame.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- `packages/rb-apps/src/apps/ide/ide-polish-pass.css`

Actions:

- make the canvas the dominant first-viewport object at 1366
- keep palette and inspector as tools, not equal visual competitors
- reduce duplicate canvas status labels
- normalize toolbar, zoom, and inspector states through shared primitives

### Verify

Verdict: behaviorally credible, visually heavy.

Verify has the strongest proof content but the weakest cognitive hierarchy. PASS, Compare evidence, waveforms, scenario controls, and repair affordances are all important, but their visual priority is too uniform.

Likely files:

- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/VerifyCommandBar.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/WaveformInstrument.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/VerifySurfacePrimitives.tsx`

Actions:

- make current proof state the primary visual object
- make repair path visually distinct from normal authoring controls
- reduce repeated mode/status badges
- use waveform rows as evidence, not just dense data

### Hardware / Map Pins

Verdict: visually weakest surface.

The Basys3 board should be the focal object, but at 1366 it is dim, partly clipped, and visually secondary to rails, side notes, and the binding table. The side copy reads like internal notes instead of product control.

Likely files:

- `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/hardware/HardwareSurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/components/Basys3BoardView.tsx`
- `packages/rb-apps/src/apps/ide/components/HardwareBoard2D.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`

Actions:

- make the Basys3 board and binding table the primary two-column object
- demote instructional side copy
- increase board contrast and reduce clipping at 1366
- standardize resource chips and table status states

### Export

Verdict: trustworthy but too sparse.

Export has good trust language, but the Handoff Summary area contains a large dark blank region. The primary build/download action is not visually dominant enough for a surface whose whole purpose is package handoff.

Likely files:

- `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/export/ExportSurfacePrimitives.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`

Actions:

- make the Vivado package object visible and concrete
- make the primary build/download action dominant
- collapse blank summary space into specific artifact rows
- keep trust/draft/stale language tied to current Verify and mapping evidence

### Import

Verdict: coherent utility, over-framed.

Import has a workable entry path and recovery framing, but it inherits the same card-on-card visual language. It should stay a utility route, not compete with Project as a main workflow step.

Likely files:

- `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`

Actions:

- keep the route narrow and utility-like
- emphasize project identity, validation, and recovery
- remove generic explanatory framing when import state is self-evident

## Top Issues

| Severity | Issue | Evidence | Likely files |
|---|---|---|---|
| P1 | Hardware board is not the first focal object at 1366 | `1366x768-hardware-map-pins.png` | `HardwareSurface.tsx`, `Basys3BoardView.tsx`, `ide-root.css` |
| P1 | Design canvas still loses priority at 1366 | `1366x768-design-logic-gates.png` | `DesignSurface.tsx`, `DesignWorkspaceFrame.tsx`, `ide-root.css` |
| P1 | Verify proof hierarchy is too flat | `1366x768-verify-pass.png` | `VerifySurface.tsx`, `VerifyCommandBar.tsx`, `WaveformInstrument.tsx` |
| P1 | Export primary handoff action is visually weak | `1366x768-export-ready.png` | `ExportSurface.tsx`, `ExportSurfacePrimitives.tsx` |
| P2 | Project feels like generic dashboard/start page | `1366x768-project-empty.png`, dirty resume screenshot | `ProjectSurface.tsx`, project primitives |
| P2 | Repeated chips and badges reduce trust-state clarity | all IDE surfaces | shared primitives and surface CSS |
| P2 | Large dark empty panels read as unfinished | Project, Export, Import | `ide-root.css`, surface layouts |
| P2 | Typography hierarchy is too uniform in dense panels | Design, Verify, Hardware | shared tokens and surface CSS |
| P2 | Surface-specific styles appear to outpace shared primitives | source inventory | `ide-root.css`, `ide-polish-pass.css`, surface files |
| P3 | Public start path and IDE app have a tone gap | public start vs Project | public start CSS, Project surface |

## What Should Stay

- proof-backed workflow spine
- honest Vivado and hardware boundary language
- browser-based local-first workflow
- visible circuit, waveform, board, and export artifacts
- current first-viewport regression coverage

## What Should Be Standardized

- panel and card primitives
- primary and secondary action treatment
- trust-state badges
- stage/workflow rail language
- spacing scale and title hierarchy
- table and evidence-row patterns
- empty, draft, stale, pass, fail, and ready states

## Next Recommended Implementation Slice

Implement a design-system cleanup slice before another broad surface polish pass:

1. inventory and normalize shared panel/card/chip/action primitives
2. align `--rb-*` and `--rbp-*` token usage
3. reduce card-on-card surface framing
4. add focused browser geometry gates for the affected first-viewport contracts
5. then proceed surface by surface, starting with Hardware/Map Pins and Design

Verify fail-edit-repair remains the next behavior/proof slice, but the visual stewardship track should not pretend the current UI is visually finished just because workflow tests pass.
