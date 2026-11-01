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

## PII-4 — Simulate vector word lanes (live run)
Blank → Design → create A[1:0] input bus + Y[1:0] output bus → wire A[0]→Y[0],
A[1]→Y[1] (identity) → Simulate → run a 2-bit sweep (A = 00,01,10,11 over
t0..t3). The BUS WORDS strip above the waveform shows, at the selected tick t3,
`A[1:0] STIMULUS · 2B  0x3  11₂ · 3` (cyan) and `Y[1:0] OBSERVED · 2B  0x3`
(teal), each with a per-tick strip `0 1 2 3` (t3 highlighted). Clicking a strip
cell selects that tick. Screenshot `81-bus-word-lanes.png`.

## PII-5 — Blank → hierarchical 4-bit ripple-carry adder, ALL through the real UI
`packages/rb-e2e/nested-adder-journey.mjs` (Node 20.19.0). The project runtime
store is READ only (to locate DOM targets and assert) — never mutated to author.
- **Author FullAdder**: place A/B/CIN inputs, x1/x2 XOR, a1/a2 AND, o1 OR, SUM/COUT
  outputs via the palette + click-to-place hit layer; wire all 12 connections with
  the wire tool (click source port → click dest port); rename the 5 boundary signals
  via the inspector; select the 5 gates and Create component from selection → FullAdder
  module with ports A,B,CIN,SUM,COUT.
- **Build the 4-bit top**: Ctrl+A/Delete clears the top (FullAdder definition survives);
  New-bus dialog creates A[3:0]/B[3:0] input + SUM[3:0] output buses; a CARRY output +
  a Ground are placed; the FullAdder is placed 4× via the library "Place instance" and
  the instances renamed u_fa0..u_fa3; all nodes dragged to a clean left→right grid.
- **Wire 17 connections** with the wire tool: bus bit A[i]/B[i] → u_fai.A/.B, u_fai.SUM →
  SUM[i], Ground → u_fa0.CIN, the COUT→CIN carry chain, u_fa3.COUT → CARRY. Instance
  ports are dense-clustered, so those use the endpoint picker
  (`logic-port-cluster-<id>-input/output` → `logic-port-picker-choice-<id>-<port>`).
  Result: 17/17 expected connections, 0 wrong, 0 extra; canvas "Problems: 0".
- **Simulate** the authored design (A=0xA, B=0xD): the deterministic run returns
  **SUM=0x7, CARRY=1** (pass); the Simulate surface shows it Observed (`93-simulate.png`).
- **Save + reload**: the FullAdder module, all four u_fa0..u_fa3 instances, 17 connections,
  and A/B/SUM buses survive the reload.
Screenshots `90-fulladder-created.png`, `91b-grid.png`, `92-wired.png`, `93-simulate.png`.

## Model-level proofs (unit tests, deterministic)
- `hierarchicalVhdl.test.ts`: bit-selected structural top (`A => A(0)`, `SUM(0) <=`).
- `projectHierarchy.test.ts`: 3-level flatten (top→Double→Inv→4 NOTs) with
  3-deep composed instance paths; cycle detection on a forged Double→Inv→Double loop.
- `hierarchicalAdderSim.test.ts`: elaborated 2-bit adder computes A+B for all
  inputs; survives save/reload and re-simulates (3+1=4).
- `vectorModulePorts.test.ts`: bus-member boundaries fuse into width-N module
  ports; module VHDL declares `STD_LOGIC_VECTOR`; elaborate+sim (A=11→Y=01).
- `busWordLanes.test.ts`: timeline→word projection (MSB-first, X/Z-preserving,
  missing bit = unknown, ascending & descending buses).
- `verifySurfaceBusWords.test.tsx`: VerifySurface renders real bus words from a
  run waveform (`A[1:0]=0x2=10₂=2`); unknown bit propagates to `x'?`.
- `projectRuntime.nestedPlacement.test.ts`: a module can contain another module
  instance; top→Mid→Leaf flattens to 4 NOTs; cycle rejection leaves state unchanged; undo.
- `hierarchicalVhdlNested.test.ts`: a definition containing a module instance emits
  `entity work.<Child>` (structural); leaf-first source order.
