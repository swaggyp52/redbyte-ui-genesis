---
doc_status: current
last_validated: 2026-06-13
owner: Connor Angiel
used_by_claude: true
role: screenshot-backed visual audit for the RedByte V1 contract reset
---

# RedByte V1 Contract Reset Visual Audit - 2026-06-13

## Scope

This audit records current RedByte UI evidence before the V1 contract reset execution program begins. It is observation-only and docs-only. It did not change product source, tests, gates, goldens, Vivado artifacts, Basys3 proof, or runtime behavior.

Structured product-hardening translation for the next code slice:

- Title: Reset RedByte workbench shell layout.
- Date: 2026-06-13.
- Owner: Connor Angiel.
- Surface: Global shell plus Project, Design, Verify, Hardware / Map Pins, Export, Import.
- Journey segment: First lab start through Logic Gates Verify, Map Pins, and Export.
- Mode: IDE, E0 browser evidence only.
- Environment: Windows, Playwright Chromium, local Vite server on `http://127.0.0.1:5174`, Node `v24.15.0`, pnpm `10.24.0`.
- Observed behavior: The runtime spine is real, but shell/workbench density, stage chrome, starter-first copy, Design first-viewport hierarchy, Verify evidence density, and Export mapping summary language still conflict with the V1 product contract target.
- Expected behavior: Each first viewport should make the current job object and next action unmistakable without overclaiming readiness.
- Severity: P1 for Shell and Workbench Layout Reset; P1/P2 for downstream surface-specific slices.
- Minimum acceptance proof: Browser screenshots and geometry at `1366x768`, `1440x900`, and `1920x1080`; no root horizontal overflow; existing behavior gates still pass; no simulation/export/hardware semantics changed.

## Capture Evidence

Capture command:

```powershell
$env:RB_CAPTURE_BASE_URL='http://127.0.0.1:5174'
corepack pnpm exec node .redbyte\product-immersion\v1-contract-reset\capture-v1-contract-reset.mjs
```

Evidence root:

- `.redbyte/product-immersion/v1-contract-reset/screenshots/`
- `.redbyte/product-immersion/v1-contract-reset/visual-capture-summary.json`

Captured states at `1366x768`, `1440x900`, and `1920x1080`:

- `public-start`
- `project`
- `design`
- `verify-observe`
- `verify-compare-pass`
- `verify-failure`
- `hardware-map-pins`
- `export-draft-needs-review`
- `export-ready-trusted`
- `import`

Summary:

- Screenshots captured: 30.
- Base URL: `http://127.0.0.1:5174`.
- UI build hash shown in screenshots: `2d17655`, matching repo HEAD `2d176550`.
- Console/page errors recorded by the harness: 0.
- Root horizontal overflow recorded by the harness: 0.
- Existing `http://localhost:5173` was not used for audit evidence because it served an older UI build hash (`a4fc624`).

## Surface Findings

| Surface | What is credible now | Contract reset finding | Severity | Next slice |
|---|---|---|---|---|
| Public start | `/?launcher=1&openApp=home` reaches the IDE Project surface cleanly. | There is no distinct public start promise in current evidence; the product currently behaves as Project-first IDE, not a marketing/public landing page. | P2 | Project Command Center / Quickstarts later |
| Global shell | Build hash, save state, board target, mode rail, lab flow, and E0/E1-E3 boundary are visible and stable. | The shell consumes a large amount of first-viewport height and repeats stage state across top ribbon, left rail, surface title, right rail, and status bar. V1 needs one compact command/status spine. | P1 | Shell and Workbench Layout Reset |
| Project | Primary start options and certified course path are visible at `1366x768`. | Project still reads starter-first and course-specific. `Mapping 0 missing` appears before a circuit exists. This should become a command center for blank, starter, saved, and instructor lab work. | P1 | Project Command Center |
| Design | Design loads and exposes tools, palette, starter state, health, and Open Verify. | At `1366x768`, the actual circuit graph is not the first-viewport focal object. The canvas header, starter banner, health row, palette, and inspector displace the designed circuit. | P1 | Design Workbench after shell reset |
| Verify observe | Observe-only mode records observed rows and keeps it distinct from Compare. | The distinction is real but crowded. The testbench builder, waveform, signal rail, mode controls, and session summary compete in the first viewport. | P2 | Verify Evidence Workbench |
| Verify compare/pass | Compare PASS is unambiguous; 12/12 match and 100% coverage are visible. | The PASS evidence is truthful but visually dense. Students need a clearer evidence ladder: stimulus, expected, observed, mismatch/pass, next action. | P1 | Verify Evidence Workbench |
| Verify failure | Failure state is strong: FAIL, mismatch count, failing signal/tick, and open-failing-check action appear. | The failure state still feels like an instrument panel rather than a guided repair loop. The first mismatch card competes with waveform tools and grid controls. | P1 | Verify Evidence Workbench |
| Hardware / Map Pins | Board, table, mapped rows, board aliases, and package pins are visible at `1366x768`. | The surface is much closer to V1 target, but "READY TO BUILD HARDWARE" can be read as hardware readiness even though E1/E2/E3 remain external. | P2 | Hardware / Basys3 Workbench |
| Export draft | Draft/Needs Review distinction is visible; Open Verify and Download Draft Project ZIP are clear. | The handoff summary says no expected-output comparison yet, which is correct. The surface still repeats many trust labels and diagnostics in a dense first viewport. | P2 | Export Handoff Station |
| Export ready | Ready-to-build E0 handoff is visible with Build Current Bundle action. | The handoff summary says "No required board I/O for this export" while the same viewport shows `5/5 mapped`. That is a visible trust-language contradiction to fix in Export/Handoff. | P1 | Export Handoff Station |
| Import | Import has a clear upload, parse, map, review, apply sequence and says nothing replaces the current project before review. | Import is correctly a utility, but its first viewport is still a large framed workflow with lower options cut off. Broader import fidelity proof remains later. | P2 | Import / Recovery |

## Delete / Demote / Rebuild Signals

High-confidence signals from screenshots:

- Rebuild shell hierarchy before individual surface polish. The repeated top ribbon, left rail, status pills, evidence box, and surface-local CTAs create too many competing authorities.
- Rebuild Design around the circuit graph as the first object, not the palette/inspector/banner stack.
- Rebuild Verify around evidence and repair, not around command bars and waveform controls as equal first-order objects.
- Keep Hardware's board/table direction, but tighten proof language so E0-ready cannot be mistaken for hardware-ready.
- Keep Export's draft/ready distinction, but fix mapping summary contradictions and make one current trust state primary.
- Demote debug/build hash and redundant status chrome where students do not need it for the task.
- Demote lab-profile/course-pack implementation until the V1 workbench contract is stable.

## Acceptance Bar For Next Slice

The next code slice is `fix: reset RedByte workbench shell layout`.

Minimum acceptance proof should include:

- Before/after screenshots for Project, Design, Verify PASS, Verify FAIL, Hardware, Export draft, Export ready, and Import at `1366x768`.
- No root horizontal overflow at `1366x768`, `1440x900`, and `1920x1080`.
- Existing behavior gates for Verify, Hardware, Export, product immersion, and viewport overflow remain green.
- No changes to simulation semantics, Verify result semantics, pin mapping semantics, export generation, VHDL/XDC/testbench/Tcl/ZIP content, project data format, goldens, Vivado proof, or Basys3 proof.

## Attribution

Connor Angiel
