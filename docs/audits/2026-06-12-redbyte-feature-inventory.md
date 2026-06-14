---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: whole-app RedByte feature and control inventory
---

# RedByte Feature Inventory

Date: 2026-06-12
Scope: product features, surfaces, visible controls, and workflow states observed in the whole-app immersion audit.
Evidence: in-app browser walkthrough, Playwright clean-context screenshots, product-immersion gates, Vivado artifact inspection, import/export recovery gates, blank-canvas proof gate.

Status terms:

- Verified: exercised successfully in this audit.
- Works but confusing: exercised, but the UI/state presentation is likely to confuse students.
- Partial: present, but only partly exercised.
- Not exercised: visible or documented, but not directly proven in this audit.
- Blocked externally: needs Vivado, hardware, or external infrastructure.

## Global Shell and Workflow Spine

| Feature/control | Surface | Status | Evidence | Recommendation |
|---|---|---|---|---|
| Top product shell with project title, current mode chip, board chip, build hash, save status, help button | Global | Verified | All screenshots | Keep, but consider hiding build hash/debug detail in classroom presentation unless instructors need it. |
| Left vertical mode rail | Global | Verified | All screenshots | Keep; make labels and status states consistent with top lab-flow ribbon. |
| Lab-flow ribbon: Design, Verify, Mapping, Export | Global | Works but confusing | Project, Verify, Export screenshots | Keep; fix no-circuit `Mapping 0 missing` and Export `Draft` versus hero `Ready to Build` conflict. |
| Evidence tier card: E0 only, E1-E3 external | Global | Verified | All screenshots | Keep; pair with clearer next-action language. |
| Workflow status pill bottom-right | Global | Verified | Many screenshots | Keep; ensure `Workflow Blocked`, `Ready`, and `Review` reflect same state as the lab-flow ribbon. |
| Saved/saving status | Global | Verified | Screenshots | Keep; ensure failed/stale states cannot masquerade as saved trust. |

## Project Surface

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| First launch Project surface | Verified | `surface-project-launch.png`, `01-first-launch-1366x768.png` | Keep; improve first-viewport next action. |
| Onboarding overlay | Verified | `01-first-launch-1366x768.png` | Keep if it stays out of the way after dismissal. |
| Recommended starter path | Verified | Project screenshots and product-immersion gate | Move the primary load action into first viewport at common laptop dimensions. |
| Starter/lab cards | Verified | Product-immersion starter flows | Keep; ensure cards expose course intent and hardware readiness without crowding. |
| Build fresh / blank-canvas route | Verified through gate | `ide:gate:blank-canvas-product-proof` | Keep; make the from-scratch path visibly equal to starter path for advanced students. |
| Import/open entry | Verified | Import screenshot and import/export recovery gate | Keep Import as a utility, not a main spine step. |
| No-circuit project state | Works but confusing | Project screenshots | Avoid `Mapping 0 missing` until there is a circuit that requires mapping. |
| Project persistence | Verified | `ece141-import-export-recovery.spec.ts` | Keep; continue using recovery gates as release blockers. |

## Design Surface

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Blank Design empty state | Closed by Design Workbench v1 | `ide:gate:design-workbench-v1`; `.redbyte/product-immersion/design-workbench-v1/after/` | Keep; blank guidance and build/I/O actions now stay inside the primary canvas region. |
| Add IO + AND quick action | Verified | `ide:gate:blank-canvas-product-proof` | Keep; this is a good first manual-build proof path. |
| Build library / component palette | Closed by Design Workbench v1 | `ide:gate:design-workbench-v1`; Design screenshots | Keep; palette is useful but narrower than the canvas-first workbench. |
| Search in palette | Not exercised | `workflow-empty-design.png` | Exercise in a focused editor-control pass. |
| Board resource chips (SW, button, LED groups) | Partial | `workflow-empty-design.png` | Keep, but test drag/click insertion separately. |
| Select and Wire mode controls | Closed for v1 path | `ide:gate:design-workbench-v1`; wire interaction gate | Keep; future deeper manual wiring can broaden beyond start/cancel and selected-wire proof. |
| Snap, undo, redo, fit, delete | Closed for v1 path | `ide:gate:design-workbench-v1`; zoom integrity gate | Keep; v1 proves move, delete/undo, and zoom/fit/center, while redo remains covered outside the browser v1 path. |
| Canvas/Code/Split segmented control | Closed for v1 path | `ide:gate:design-workbench-v1` | Keep; split/code no longer undermines the visual authoring layout in the covered path. |
| Circuit health row | Verified | Design screenshots | Keep; make errors/warnings/drafts actionable. |
| Inspector | Closed by Design Workbench v1 | `ide:gate:design-workbench-v1`; inspector contract | Keep; it is a side context panel and no longer stacks below the canvas in Canvas mode. |
| Starter banner | Closed by Design Workbench v1 | `logic-gates-design.png`, `half-adder-design.png`; after screenshots | Keep compact; it should not push the graph below the first viewport. |
| Actual schematic/circuit graph | Closed by Design Workbench v1 | `ide:gate:design-workbench-v1`; after screenshots | Keep first-order; this is now guarded by the v1 gate at `1366x768` and `1440x900`. |
| Live simulation / signal controls | Partial | Design and Verify screenshots | Keep; deeper failure-linked debug pass still needed. |

## Verify Surface

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Verify run bar | Verified | Verify screenshots and gates | Keep; reduce truncation in the top deck. |
| Generate starter stimulus | Verified | Starter and sequential gates | Keep; make generated-versus-authored status plain. |
| Observe only mode | Verified | Manual observe run and screenshots | Keep; current boundary that Observe does not imply Compare PASS is correct. |
| Compare / saved checks mode | Verified | Manual and automated Compare PASS | Keep; ensure saved outputs are clearly provenance-labeled. |
| Test stimulus grid | Verified | Verify screenshots | Keep; improve density and horizontal scan if possible. |
| Expected output editing | Partial / risky | Manual intentional failure and repair attempt | Add focused regression for edit -> FAIL -> repair -> PASS. |
| Waveform viewer | Verified | Verify screenshots | Keep; it is credible but cramped. |
| Failure explainer | Verified | Intentional failure screenshot | Keep; this is one of the strongest learning affordances. |
| Open first failing check | Verified visually | Intentional failure screenshot | Keep; verify it carries context into Design in a focused pass. |
| Save observed outputs | Verified | Blank-canvas proof gate | Keep; make learning semantics explicit. |
| Sequential auto-clock explanation | Verified | Counter and FSM screenshots | Keep; ensure students know board clock is generated automatically for Verify. |
| Stale-state controls | Partial / risky | Manual repair screenshots | Simplify and harden; stale repair must never strand the student. |

## Map Pins / Hardware Surface

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Hardware / Map Pins mode | Verified | Map screenshots and gates | Keep; first viewport needs board/table hierarchy repair. |
| Mapping state in lab-flow ribbon | Verified | Map and Export screenshots | Keep; remove contradictory `Ready to map` text after mapping is complete. |
| Mapping table | Verified but below fold | Product-immersion screenshots and blank-canvas gate | Move into first viewport or pin a compact table summary above the fold. |
| Basys3 board interaction target | Partial | Map screenshots | Make visible in first viewport for mapped starter paths. |
| Pin assignment controls SW/LD/button | Partial | Blank-canvas proof attempted SW0/SW1 assignment; automated starter mapping passed | Add explicit UI proof for all common IO classes. |
| XDC preview / mapping-derived constraints | Verified through Vivado artifact gate | Extracted `top.xdc` files | Keep; tie preview to visible mapped state. |
| Open Export handoff | Verified | Map/Export screenshots and gates | Keep; clarify when Export is ready versus draft. |

## Export Surface

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Export panel | Verified | Export screenshots and blank-canvas gate | Keep; make primary action visible above fold. |
| E0 trust label | Verified | UI screenshots and README artifacts | Keep; do not overclaim E1-E3. |
| Ready-to-build hero | Works but confusing | Export screenshots | Keep only if lab-flow rail and action state agree. |
| Primary download/build action | Verified but below fold | Blank-canvas gate and Export screenshots | Move or duplicate the primary action into first viewport. |
| Artifact preview/counts | Partial | Export screenshots | Keep; make preview visible enough to teach what is being handed to Vivado. |
| Vivado package ZIP download | Verified | `ece141-vivado-artifacts.spec.ts` | Keep. |
| VHDL source in package | Verified | Extracted `top.vhd` | Keep; semantic parity gate should remain required. |
| XDC constraints in package | Verified | Extracted `top.xdc` | Keep; continue checking package pins and duplicate pins. |
| README evidence boundary | Verified | Extracted `README.txt` | Keep; it honestly states E0 only. |
| EXPECTED_IO.json | Verified | Extracted artifacts | Keep; this is valuable downstream evidence. |
| Actual Vivado run / bitstream / board observation | Blocked externally | Vivado path absent | Do not claim until run on hardware machine. |

## Import Surface

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Import entry mode | Verified | `surface-import-entry.png` | Keep; it reads as a utility workflow. |
| Upload ZIP step | Verified visually | Import screenshot | Keep; exercise real file upload in a broader import pass. |
| Parse HDL step | Not exercised manually | Import screenshot | Test with representative HDL, XDC, and malformed packages. |
| Map ports step | Not exercised manually | Import screenshot | Test name normalization and student label preservation. |
| Review schematic step | Not exercised manually | Import screenshot | Verify imported schematics are inspectable and reversible before apply. |
| Apply import step | Verified through smoke gate only | Import/export recovery gate | Keep behind review. Do not replace current project before review. |
| Other ways to start / HDL paste path | Not exercised | Import screenshot | Defer until ZIP path is classroom-reliable. |

## Starter and Course Content

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Logic Gates starter | Verified | Manual walkthrough, product-immersion gate, Vivado artifact gate | Keep; use as primary combinational proof case. |
| Half Adder starter | Verified | Product-immersion and Vivado artifact gates | Keep; use as secondary combinational proof case. |
| Two Bit Counter starter | Verified | Product-immersion and Vivado artifact gates | Keep; use as sequential proof case. |
| Security Lock starter | Partial / deferred | Product-immersion screenshots | Keep as advanced/deferred example until full completion path is proven. |
| Empty project workflow | Verified | Product-immersion screenshots, blank-canvas proof gate | Keep; improve visual affordance and manual editor coverage. |

## External and Commercial Features

| Feature/control | Status | Evidence | Recommendation |
|---|---|---|---|
| Hosted static app candidate | Partial | Local server proof only | Suitable for public/free classroom access after UX hardening and deploy proof. |
| Accounts/user data | Not present / not needed now | Product docs and current app behavior | Do not add until there is a concrete instructor requirement. |
| Instructor support package | Partial | Product docs and manual proof templates | Needed before paid deployment. |
| Vivado/Basys3 certification | Blocked externally | Vivado absent locally | Run on hardware machine before E1/E2/E3 claims. |
| Commercial license/readiness | Partial | Current docs plus this audit | Build around support, campus deployment, and curriculum packaging, not premature SaaS. |

