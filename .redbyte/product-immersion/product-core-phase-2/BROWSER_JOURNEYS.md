# Phase II — Browser Journeys (Browser E0)

Playwright at 1440×900, dev server `corepack pnpm run dev`. Authoring uses the
real projectRuntime actions (the same ones the UI buttons invoke); acceptance
facts (VHDL, hierarchy, breadcrumb, canvas) are read from the real UI. Canvas
port-level mouse-dragging is not scripted (a headless-canvas limitation);
module creation, selection, dialog, drill-in are driven through real UI clicks.

## PII-1 — Module creation through the real UI
Build Fresh → Design → build FullAdder gates → shift-click the 5 gates on the
canvas → the Inspector's "Create component from selection…" button appears →
dialog (name FullAdder, instance u_fa0) → confirm. Result: hierarchy gains a
FullAdder module; the 5 gates collapse into one `u_fa0` instance node showing
ports A/B/CIN → COUT/SUM, wired to the parent boundary. Screenshots
`70-selected.png`, `71-module-dialog.png`, `72-after-module.png`.

## PII-2 — Drill-in navigation + breadcrumb
Enter the FullAdder instance → breadcrumb reads `untitled_project / FullAdder`,
canvas shows the module's 5 internal gates; the Sources tab appears.
Screenshot `73-inside-module.png`.

## PII-3 — Hierarchical 4-bit adder → structural VHDL (model + export UI)
Blank → build FullAdder module → reset top → create A[3:0]/B[3:0] input buses,
SUM[3:0] output bus, CARRY scalar → place four FullAdder instances → wire bus
bits + carry chain → map to SW/LD → Build & Export. Generated structural top:
```
entity untitled_project is
  port ( A : IN STD_LOGIC_VECTOR(3 downto 0);
         B : IN STD_LOGIC_VECTOR(3 downto 0);
         SUM : OUT STD_LOGIC_VECTOR(3 downto 0);
         CARRY : OUT STD_LOGIC );
...
  u_fa0 : entity work.FullAdder port map ( A => A(0), B => B(0), CIN => n_c0_out, COUT => n_u_fa0_COUT, SUM => n_u_fa0_SUM );
  u_fa1 : ... CIN => n_u_fa0_COUT ...   (carry chain)
  SUM(0) <= n_u_fa0_SUM;  ...  SUM(3) <= n_u_fa3_SUM;
  CARRY <= n_u_fa3_COUT;
```
Each instance gets its own bus BIT (A(0)..A(3)); each SUM bit is driven
separately; carry chains correctly. Vector top ports + scalar component ports.

## Model-level proofs (unit tests, deterministic)
- `hierarchicalVhdl.test.ts`: bit-selected structural top (`A => A(0)`, `SUM(0) <=`).
- `projectHierarchy.test.ts`: 3-level flatten (top→Double→Inv→4 NOTs) with
  3-deep composed instance paths; cycle detection on a forged Double→Inv→Double loop.
- `hierarchicalAdderSim.test.ts`: elaborated 2-bit adder computes A+B for all
  inputs; survives save/reload and re-simulates (3+1=4).
