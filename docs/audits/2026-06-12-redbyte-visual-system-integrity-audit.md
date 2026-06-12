---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: visual-system integrity audit for RedByte IDE
---

# RedByte Visual System Integrity Audit - 2026-06-12

## Scope

This audit records the Visual System Integrity Sprint evidence for the current canonical clone. The pre-sprint baseline was `c0ab0cd8`; the implementation commit is the follow-up `fix: improve RedByte visual system integrity` slice. It focuses on layout integrity, scroll containment, text clipping, density, and cross-surface visual grammar.

This is E0 browser/layout evidence only. It does not change or prove simulation semantics, Verify result semantics, pin mapping semantics, export generation, project format, Vivado build, Basys3 programming, or E1/E2/E3 hardware behavior.

## Before Evidence

Capture command:

```powershell
node .redbyte\product-immersion\visual-system-integrity\capture-visual-system-integrity.mjs before http://localhost:5174
```

Artifacts:

- `.redbyte/product-immersion/visual-system-integrity/before/*.png`
- `.redbyte/product-immersion/visual-system-integrity/before/geometry-summary.json`

The sprint-owned `pnpm run dev` process used `http://localhost:5174/` because an older Node/Vite process already occupied port `5173`.

## After Evidence

Capture command:

```powershell
node .redbyte\product-immersion\visual-system-integrity\capture-visual-system-integrity.mjs after http://localhost:5174
```

Artifacts:

- `.redbyte/product-immersion/visual-system-integrity/after/*.png`
- `.redbyte/product-immersion/visual-system-integrity/after/geometry-summary.json`

The after pass captured the same `1366x768`, `1440x900`, and `1920x1080` Project, Design, Verify, Hardware, Export, and Import states as the before pass.

## Implemented Changes

- Added `ide:gate:ece141-visual-system-integrity`, a focused Playwright gate for bounded first-viewport layout integrity across Project, Design, Verify, Hardware, and Export.
- Tightened Verify command/result density so the command bar and header no longer horizontally overflow at `1366x768`; the waveform region remains visible and the preview width clears the current Verify workbench contract floor.
- Kept Verify post-run expected-output cells directly editable after the compact layout by restoring real canvas height and hit-target stacking inside the stimulus workbench.
- Promoted the Export handoff summary into the first hero area, compacted the Export command/action/evidence layout, and corrected the draft rail so Draft Export does not claim ready-to-build.
- Kept opened Verify signal dock content visible when the shell dock is restored, so the filter count and relevant signal list are usable after the collapsed rail is opened.
- Did not change simulation, Verify result semantics, pin mapping semantics, export package generation, project data format, goldens, Vivado proof, or Basys3 proof.

## Defect Matrix

| Surface | Severity | Visible problem | Likely cause | Debt type | Likely files | Proof needed |
|---|---|---|---|---|---|---|
| Export | P1 | At `1366x768`, Export shows a large blank handoff slab while the real evidence diagnostics, artifact preview, and Vivado handoff begin below the first viewport. In draft state, rail copy can read `Ready to build` while the surface says `Needs Review`. | Readiness hero fixed height, lower handoff sections too far down, right action card cramped, trust-state labels split across rail/hero/action. | Global shell plus surface-local layout and copy/status debt. | `ExportSurface.tsx`, `surfaces/export/ExportSurfacePrimitives.tsx`, `ide-root.css` | New visual integrity gate requiring Export evidence/handoff region and primary action to be visible at `1366x768`, with no clipped handoff text. |
| Verify | P1 | Command/result region is crowded; mode buttons, evidence chip, context copy, stimulus toolbar, and waveform controls clip or overlap. Screenshot shows waveform controls fighting text around the tool strip. | Header row is wider than available region; stimulus toolbar and waveform stage use dense single-row controls with insufficient wrap/containment rules. | Surface-local layout plus shared chip/control density debt. | `VerifySurface.tsx`, `VerifyCommandBar.tsx`, `WaveformInstrument.tsx`, `ide-root.css` | Gate checks no command-region horizontal overflow, readable run-mode/evidence text, visible waveform, and no clipped waveform control text. |
| Project | P2 | Loaded Project state still feels like cards floating in a large dark field rather than a course lab command center. | Max-width/centering and card rhythm leave too much unused page area around current lab status. | Surface-local composition debt. | `ProjectSurface.tsx`, `ide-root.css` | Before/after screenshots at `1366x768`; command strip and next action remain visible. |
| Design | P2 | Design is the strongest surface, but palette, toolbar, inspector, chips, zoom controls, and canvas controls feel assembled from different systems; the circuit graph is only partially visible at `1366x768`. | Canvas workbench shares priority with too much chrome, and local control styles outpace shared primitives. | Shared primitive debt plus surface-local layout debt. | `DesignSurface.tsx`, `DesignWorkspaceFrame.tsx`, `ide-root.css`, `ide-polish-pass.css` | Canvas remains visible and dominant; no toolbar/rail covers it. |
| Hardware / Map Pins | P2 | Hardware guide no longer word-wraps badly, but the board/table/guide rhythm still feels squeezed and the board is dim under a large summary band. | Summary and side guide compete with board/table workbench; board contrast and first-viewport weighting remain conservative. | Surface-local layout debt. | `HardwareSurface.tsx`, `HardwareSurfacePrimitives.tsx`, `Basys3BoardView.tsx`, `ide-root.css` | Existing Hardware visual credibility gate stays green; board/table remain visible. |
| Import | P3 | Import is coherent as a utility but inherits heavy nested panels and clipped child content from the shared visual language. | Card-on-card composition and workflow rail density. | Shared primitive plus surface-local debt. | `ImportSurface.tsx`, `ide-root.css` | Import entry still visible; no root overflow. |
| Global shell | P1 | No root horizontal overflow was captured, but there are too many nested scroll regions and inconsistent panel/chip/action density. The same workbench/evidence/action concepts use different rhythms per surface. | Surface-specific CSS accumulated faster than shared visual primitives. | Global shell and shared visual-system debt. | `IdeWorkbenchShell.tsx`, `IdeSurfaceLayout.tsx`, `ide-root.css`, `ide-polish-pass.css` | Gate checks bounded scroll regions, no accidental horizontal overflow, and readable first-viewport focal regions across surfaces. |

## Geometry Highlights

### Before

- `1366x768` Export ready: `ide-export-vivado-evidence-diagnostics` is only about `12%` visible in the first viewport; `ide-export-handoff-summary` and artifact preview have `0%` first-viewport visibility.
- `1366x768` Export draft: evidence diagnostics are only about `17%` visible; the action card is visible but cramped beside an empty handoff slab.
- `1366x768` Verify PASS: `ide-verify-region-header` has horizontal overflow; command children report clipping for `Update run`, run-mode toggle, and `12/12 match / 100% coverage`.
- `1366x768` Verify PASS: waveform SVG is only about `64%` visible and waveform/control text reports clipping inside the waveform region.
- `1366x768` Design starter: canvas region is visible (`1025x322`) but the visible graph area sits low after toolbar and starter chrome.
- No root-level horizontal overflow was captured across the before pass.

### After

- `1366x768` Export draft: `ide-export-command-strip` height dropped from about `209px` to `128px`; evidence diagnostics first-viewport visibility increased from about `17%` to `58%`; `ide-export-handoff-summary` moved from `0%` first-viewport visibility to fully visible.
- `1366x768` Export ready: evidence diagnostics first-viewport visibility increased from about `12%` to `52%`; `ide-export-handoff-summary` moved from offscreen to fully visible in the handoff hero.
- `1366x768` Verify PASS: `ide-verify-region-header` no longer has horizontal overflow, and command-bar child clipping dropped from multiple clipped controls to none in the new visual gate.
- `1366x768` Verify PASS: waveform region width increased from about `461px` to `491px`, while the stimulus workbench kept its real share of the desktop layout.
- No root-level horizontal overflow was captured across the after pass.

## Validation

Passing checks:

- `pnpm -s ide:gate:ece141-visual-system-integrity` (`4` passed)
- `pnpm -s ide:gate:ece141-ui-hierarchy` (`2` passed)
- `pnpm -s ide:gate:ece141-first-viewport` (`4` passed)
- `pnpm -s ide:gate:ece141-product-immersion` (`4` passed)
- `pnpm -s ide:gate:ece141-hardware-visual-credibility` (`2` passed)
- `pnpm -s ide:gate:ece141-map-pins-recovery` (`1` passed)
- `pnpm -s ide:gate:verify-workbench-contract`
- `pnpm -s ide:gate:export-download-contract`
- `pnpm -s ide:gate:export-artifact-explorer-contract`
- `pnpm -s ide:gate:viewport-overflow-contract`
- `pnpm -s build:unified`

Known/residual validation caveats:

- `pnpm -s ide:gate:export-ready-contract` still fails before Export in the Verify setup path with `verify had neither a visible generate-basics action nor an existing ready-vector state`; this was already tracked as a separate caveat and was not caused by the visual layout slice.
- `pnpm -s ide:gate:verify-contract` still fails on the older blank-Verify contract waiting for `ide-verify-banner`; the current ECE141 starter Verify workflow is covered by `ide:gate:verify-workbench-contract` and the ECE141 visual/product gates above.
- The focused Vitest batch for Verify/Export surfaces reported two stale expectation failures that already disagree with HEAD source posture: Export workstation expects a mounted `ide-inspector` even though HEAD renders `rightDockMode="collapsed"`, and a Verify workstation test expects no collapsed first-run sequential helper even though HEAD renders the helper inside `ide-verify-first-run-clock-policy`. The unrelated files in the batch passed (`114` passed, `2` failed).

## Sprint Priorities

1. Fix Export first-viewport handoff integrity and draft/ready rail mismatch.
2. Reduce Verify command/result clipping enough to make run/evidence/waveform hierarchy readable.
3. Preserve existing global overflow containment and codify it in a focused browser gate.
4. Make only low-risk Project/HW/Design rhythm fixes if they fall out of the same shell rules.

## Guardrails

- Do not change circuit simulation behavior.
- Do not change Verify result semantics.
- Do not change pin mapping behavior.
- Do not change VHDL, XDC, testbench, Tcl, ZIP, or project data generation.
- Do not update golden artifacts.
- Do not make Vivado, bitstream, board-programming, or E3 observation claims from screenshots.

## Attribution

Connor Angiel
