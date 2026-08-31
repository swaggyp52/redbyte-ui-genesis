# Product hardening ticket: Milestone B2 visual workbench reconstruction

- Date: 2026-08-08
- Owner: Connor Angiel
- Surface: Shared shell, Project, Design, Simulate, Board & Constraints, Build & Export
- Journey: Project -> Design -> Simulate -> Board & Constraints -> Build & Export
- Mode: Product System v3 candidate on `product/redbyte-workbench-v3`
- Environment: Windows, local Chromium workbench, pnpm 10.24.0. The active Node 24.15.0 differs from the repo-pinned Node 20.19.0 and must be labeled in validation evidence.

## Observed

The accepted hierarchy capability is present, but the visible product is split between a pale shell and legacy navy workspaces. Project and Export are constrained into narrow reporting columns. Design is pushed down by stacked command bands and uses cramped light-on-dark docks. Simulate is dominated by a small vector table and unused black space. Board & Constraints reads as a spreadsheet with the physical board demoted to a reference card. Routine workflow text is frequently too small and low contrast.

## Expected

One RedByte Studio visual system must own the complete five-stage workbench. Studio Light uses cool neutral application surfaces with a separately configurable instrument canvas. Studio Dark uses neutral charcoal. Project, Design, Simulate, Board & Constraints, and Build & Export must each use the full available workplane, readable 12px-or-larger metadata, clear primary work objects, and coherent three-region layouts. Existing project authority, hierarchy, simulation, mapping, and export behavior must remain unchanged.

## Reproduction evidence

- User-supplied Project, Design, Simulate, Board, and Export screenshots attached to the Milestone B2 request.
- Existing Milestone B1 browser captures in `docs/release/evidence/milestone-b1/`.
- Project branch starting SHA: `1d70ea296c2fc565055d5bd55230038d0346ec28`.

## Acceptance

- Shared shell is at most 48px + 48px for product and stage bars, with concise live stage status.
- Project uses explorer, useful circuit overview, and one contextual next-action rail without duplicate stage cards.
- Design uses light support docks and a dominant independently themed canvas with one compact command bar.
- Simulate prioritizes scenario navigation, waveform/timeline, and contextual inspection; the case grid remains a table view.
- Board & Constraints visually connects project signals, the Basys3 board, and canonical assignment details.
- Build & Export uses source tree, readable code viewer, and handoff inspector across the full workplane.
- Six 1440x900 screenshots at 100% browser zoom plus five before/after composites.
- Bounded typecheck, CSS audit, focused tests, unified build, diff check, and one normal browser walkthrough.

## Proof boundary

This ticket does not include Classroom Truth Gates, aggregate release proof, remote CI monitoring, Vivado, bitstream generation, Basys3 programming, deployment, or merge. A historical test that requires superseded UI is recorded as legacy debt instead of restoring the old product.

## Status

Implemented on `product/redbyte-workbench-v3` with the six final screenshots and
five comparisons in `docs/release/evidence/milestone-b2/`. Typecheck, the IDE CSS
audit, unified build, whitespace check, responsive geometry checks, and the
normal browser walkthrough passed. The bounded focused test selection exposed
39 legacy Verify/Export copy and retired-work-object expectations; these are
recorded as test debt under the explicit no-regression-to-old-UI rule.
