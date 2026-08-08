# Milestone B2 visual evidence

Capture date: 2026-08-08  
Branch: `product/redbyte-workbench-v3`  
Implementation base: `1d70ea296c2fc565055d5bd55230038d0346ec28`  
UI commit before final evidence amendment: `ed9b28c8a`  
Project: Full Adder  
Browser zoom: 100% (`visualViewport.scale = 1`)  
Capture output: 1440 x 900 PNG  
Connected Windows browser CSS viewport: 1600 x 1000 at device pixel ratio 0.9

The final commit SHA is the enclosing evidence commit reported on draft PR #80.
These captures prove visible Browser-E0 composition only; they do not prove
Vivado, bitstream, Basys3, deployment, classroom, or production behavior.

## Final captures

| File | Theme | Canvas / instrument | State |
| --- | --- | --- | --- |
| `project-center-studio-light-1440x900.png` | Studio Light | Dark circuit preview header | Full Adder project, stale simulation, 5/5 mapping |
| `design-hierarchy-studio-light-1440x900.png` | Studio Light | Dark canvas | `full_adder` hierarchy with `HalfAdder` source |
| `design-canvas-studio-dark-1440x900.png` | Studio Dark | Dark canvas | `full_adder`, Components explorer, right dock collapsed |
| `simulate-workstation-studio-light-1440x900.png` | Studio Light | Dark waveform | New Scenario stale replay, LD0 selected |
| `board-constraints-studio-light-1440x900.png` | Studio Light | Neutral board workplane | CARRY -> LD0 / U16 selected |
| `build-export-studio-light-1440x900.png` | Studio Light | Dark code viewer | Draft package, `top.vhd` selected |

## Comparisons

`before-after-project.png`, `before-after-design.png`,
`before-after-simulate.png`, `before-after-board.png`, and
`before-after-export.png` pair the closest checked-in pre-reconstruction B1
capture with the final B2 surface. The temporary upload paths for the original
request images had expired by closeout, so the canonical B1 evidence for the
same candidate lineage is used as the reproducible before source.

## Bounded review record

- One normal browser walkthrough completed Project -> Design top -> HalfAdder ->
  top -> Simulate -> Board & Constraints -> Build & Export.
- The 1366 x 768 control reported no root horizontal overflow and retained a
  single-row 44px Design command bar; the right inspector remained reachable.
- The 1920 x 1080 control used the full workplane rather than the legacy 1360px
  report column.
