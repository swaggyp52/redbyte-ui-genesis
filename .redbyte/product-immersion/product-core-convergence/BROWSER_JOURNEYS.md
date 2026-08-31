# Browser Journeys — Product-Core Convergence

Evidence log of end-to-end journeys executed through the real UI (Browser E0 only,
Playwright at 1440×900, dev server `corepack pnpm run dev`). Zero console errors on
every run below.

## J1 — Bus authoring (Design)
Build Fresh → Design → empty-state "Add bus" → name A, width 4, input.
Result: circuit gains declared bus `A[3:0]` with member nodes `A[3]..A[0]`;
store `circuit.buses` = `["A[3:0]"]`, 4 INPUT nodes. Screenshot `20-bus-A.png`.

## J2 — Light technical canvas
Default `data-canvas-appearance="light"`; node bodies computed fill
`rgb(255,255,255)` (schematic white cards), grid light, neon glow gone.
Screenshots `30-light-canvas.png`, `31-light-nodes.png`.

## J3 — Virtual Basys3 board (Browser E0), drive → observe
Blank → create `A[1:0]` input + `Y[1:0]` output buses → wire A→Y passthrough →
map A→SW1/SW0, Y→LD0/LD1 → Board & Constraints shows the Virtual Board.
Toggling SW0/SW1 (data-on 0→1) lights LD0/LD1 (data-on 0→1) through the
canonical sim engine; readout cross-probes "SW1 → A[0] · V16".
Screenshots `40-virtual-board.png`, `41-virtual-board-driven.png`.

## J4 — Bus → board → export → real vector VHDL (Wave 1 final authority)
Blank → create `A[3:0]` input + `SUM[3:0]` output buses through the UI →
wire A→SUM → map A→SW3..0, SUM→LD3..0 → Build & Export.
Generated top VHDL (read from the export UI):
```
entity untitled_project is
  Port (
    A : in  STD_LOGIC_VECTOR(3 downto 0);
    SUM : out STD_LOGIC_VECTOR(3 downto 0)
  );
end entity untitled_project;
architecture Behavioral of untitled_project is
begin
  SUM(0) <= A(0);
  SUM(1) <= A(1);
  SUM(2) <= A(2);
  SUM(3) <= A(3);
end architecture Behavioral;
```
First-class buses authored in the UI produce real `STD_LOGIC_VECTOR(3 downto 0)`
entity ports end to end, with the scalar substrate preserved. Screenshot `50-export.png`.

## Regression posture
The IDE `__tests__` battery shows ~131 pre-existing baseline failures (copy drift
like "Simulation evidence is stale" vs test-expected "Verify evidence is stale",
missing context-menu testids from prior UI work). Verified by running the same
failing files on `safety/pre-product-core-convergence` (9b730be): identical
4-of-5-files failing, so this program introduced no new regressions in the areas
sampled. New tests added by this program are all green.
