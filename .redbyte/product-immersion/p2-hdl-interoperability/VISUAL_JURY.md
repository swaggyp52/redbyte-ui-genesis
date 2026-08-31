# P2 Visual Jury

Visual/UX + accessibility record for the P2 UI-integration surfaces. Studio Light
owns application surfaces; dark instrument surfaces are limited to the circuit
canvas, waveform, and code viewer.

**Honesty rule:** a cell is only ✅ when a committed real-UI Playwright journey (or
a directly-read screenshot) actually asserts it. Everything else is **UNPROVEN** —
not inferred from "it uses tokens" or "it looked fine".

## What the journeys actually assert

Each journey drives the real UI at the stated viewports and fails on
`document.documentElement.scrollWidth - clientWidth > 1` (root-axis overflow).

| Surface | Journey | 1440×900 | 1366×768 | no root overflow | effective 200% | one `<main>` | reduced-motion | honest evidence label |
|---|---|---|---|---|---|---|---|---|
| VCD Analyzer (Simulate) | `vcd-analyzer-journey.mjs` + `a11y-scale-journey.mjs` | ✅ | ✅ | ✅ | ✅ (a11y journey) | ✅ (a11y journey) | ✅ (a11y journey) | ✅ ("generated outside RedByte") |
| Source↔visual cross-probe (Project) | `crossprobe-journey.mjs` | ✅ | ✅ | ✅ | UNPROVEN | ✅ (parity) | UNPROVEN | ✅ (5-tier quality) |
| Constraint sets (Board) | `constraint-sets-journey.mjs` | ✅ | ✅ | ✅ | UNPROVEN | ✅ (parity) | UNPROVEN | ✅ ("never runs Vivado") |
| Provider bar (Simulate) | `sim-provider-journey.mjs` | ✅ | ✅ | ✅ | ✅ (a11y journey) | ✅ (a11y journey) | ✅ (a11y journey) | ✅ (Browser-E0 / imported-external) |
| Migration dialog | `migration-journey.mjs` | ✅ | ✅ | ✅ | UNPROVEN | n/a (modal) | UNPROVEN | n/a |
| Whole-spine parity | `parity-journey.mjs` + `complex-import-journey.mjs` | ✅ | ✅ (parity) | ✅ | UNPROVEN | ✅ (single `<main>`, single shell) | UNPROVEN | ✅ (imported artifacts honest) |

Screenshots (local, gitignored) under `evidence/chapter-{a,b,c,d,g}/` at 1440×900
(and 1366×768 where captured) show the rendered panels. **A screenshot proves
appearance at a moment, not a workflow.**

## UNPROVEN — not directly inspected in P2 (carry into P2.5 Visual Jury)

- **Effective 200% zoom per surface** — proven only for the Simulate surface (VCD
  Analyzer + provider bar, via the halved-viewport check). Cross-probe, constraint
  sets, and the migration dialog were **not** individually checked at 200%.
- **Reduced-motion per surface** — emulated only on the Simulate surface. Not
  verified on Project (cross-probe), Board (constraint sets), or the dialog.
- **Full keyboard operability** — only single-control focusability was asserted
  (the Analyzer Load button). **Focus order, visible-focus styling, and
  no-focus-trap are UNPROVEN** for every new panel.
- **Contrast within the Studio token system** — **UNPROVEN.** No contrast-ratio
  measurement was performed; panels use `--rb-*` tokens by construction only.
- **Headed 125% (Gannon pilot) scaling** — **UNPROVEN.** Not inspected.
- **Design, Board, and Export surfaces as whole compositions** — the P2 journeys
  assert the *new* panels and root overflow, not the overall visual quality,
  density, or first-viewport layout of those surfaces. That is exactly the P2.5
  program's subject and is **UNPROVEN** here.

## Not a design-quality certificate

These journeys prove the assertions they contain (mount, interaction, root
overflow, one landmark). They do **not** prove the interface is well-designed,
uncluttered, coherent across surfaces, or free of clipping/overlap outside the
asserted checks. Those are P2.5 outcomes and remain open.
