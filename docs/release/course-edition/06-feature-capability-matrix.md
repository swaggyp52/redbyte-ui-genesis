# Feature Capability Matrix

Date: 2026-05-11

Allowed states:

- Implemented and manually observed
- Implemented but untested
- Partially implemented
- Documented only
- Aspirational
- Stale / likely obsolete
- Broken
- Unknown

This matrix only marks "manually observed" where this session used the running browser app or command output directly.

| Feature | Current State | Evidence | Required for Course? | Risk | Tests Needed | Docs Needed | Owner Surface | Priority | Keep/Defer/Remove |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Basic gates | Implemented and manually observed | Logic Gates starter loaded in browser; `examplesCatalog.ts`; `labStarters.ts`. | Yes | Low-medium: console warnings during load. | Starter load, Verify Compare, Export ready-to-build. | Student quick start. | Project/Design/Verify | P0 | Keep |
| Combinational circuits | Implemented and manually observed | Logic Gates and Half Adder loaded; Compare path observed for Logic Gates. | Yes | Medium until warnings classified. | Golden combinational browser and export gate. | Verify guide. | Design/Verify/Export | P0 | Keep |
| Adders | Implemented and manually observed | Half Adder card loaded; Full Adder in `examplesCatalog.ts`/starters. | Yes | Medium: not all adders manually verified this session. | Half/full adder starter tests and export gates. | Lab guide. | Project/Verify | P0 | Keep |
| Counters | Implemented and manually observed | 2-Bit Up Counter card loaded; readiness docs record row-specific E1/E2 and E3 pending/open. | Yes, bounded | Medium-high: sequential semantics and E3. | Clock/reset/Compare/export/hardware row gates. | Sequential guide and limitations. | Verify/Export | P0 | Keep |
| Sequential circuits | Partially implemented | Counter support present; docs fence unsupported falling-edge, multi-clock, active-low reset, async sequential work. | Yes, bounded | High if generalized. | Single-clock rising-edge acceptance tests. | Known limitations. | Verify/Export | P0 | Keep bounded |
| FSM / lock project | Partially implemented | Lab 8 bridge starter present; `docs/ACTIVE_WORK.md` says not RC1 turnkey. | Optional bridge only | High | Starter smoke and warning label tests. | Professor guide/support boundary. | Project/Design/Verify | P1 | Keep as bridge/defer turnkey claim |
| Simulation | Implemented but untested | Verify/Design simulation controls visible; code exists. | Yes | Medium | Determinism and loop-detection gates. | Product manual and student Verify guide. | Design/Verify | P0 | Keep |
| Vector tests | Implemented and manually observed | Verify Compare for Logic Gates passed 12/12 after selecting Compare checks. | Yes | Medium: observe-only can be mistaken for proof. | Observe vs Compare E2E. | Verify/proof guide. | Verify | P0 | Keep |
| Verify | Implemented and manually observed | Verify surface loaded; Logic Gates Compare PASS observed. | Yes | Medium | Browser starter path gate; console warning gate. | Verify guide. | Verify | P0 | Keep |
| Project save/load | Partially implemented | Project showed open saved project and recent project; code has persistence helpers. Not fully exercised. | Yes | Medium | Save/load/roundtrip browser gate. | Recovery guide. | Project | P0 | Keep |
| Starter projects | Implemented and manually observed | Project showed curated examples and Lab 1-8 starters; three loaded. | Yes | Medium: support level not course-visible enough. | Starter load gate for official list. | Student/professor starter schedule. | Project | P0 | Keep |
| Curated learning path | Implemented and manually observed | Project cards visible; `examplesCatalog.ts` defines path metadata. | Yes | Medium: certification must match docs. | Path smoke and support-label test. | Quick start. | Project | P0 | Keep |
| Board pin mapping | Implemented and manually observed | Hardware/Map Pins loaded with Basys3 resource list; starter exports showed mapped counts. | Yes | Medium | Pin binding persistence/parity gates. | Basys3 mapping guide. | Hardware | P0 | Keep |
| Basys3 export | Implemented and manually observed | Export listed Basys3/Vivado artifacts; docs/bench matrix. | Yes | Medium | Golden Basys3 export tests. | Vivado handoff guide. | Export | P0 | Keep |
| XDC generation | Implemented but not file-inspected in browser | Export listed `top.xdc`; code under export/fpga; certification docs. | Yes | Medium | Golden XDC parity and clock constraint tests. | Mapping/export guide. | Export | P0 | Keep |
| VHDL generation | Implemented but not file-inspected in browser | Export listed `top.vhd`; code/tests exist. | Yes | Medium | Golden VHDL tests. | Export guide. | Export | P0 | Keep |
| Vivado import Tcl | Implemented but not executed | Export listed `vivado_import.tcl`; Vivado certification docs exist. | Yes | Medium | Vivado import/build certification. | Vivado guide. | Export/external | P0 | Keep |
| Bitstream/build evidence | Documented only in this session | Certification matrix and bench docs record E1 rows; Vivado not run now. | Hardware labs | Medium | E1 classifier/golden row gates. | Evidence guide. | External/Vivado | P0 | Keep |
| Programming evidence | Documented only in this session | Certification matrix and bench docs record E2 rows; board not used now. | Hardware labs | Medium | E2 capture and classifier. | Evidence guide. | External/Vivado | P0 | Keep |
| Observed behavior evidence | Partially implemented/documented | Evidence model clear; current docs keep E3 row-specific/open. | Designated checkoffs | High | Manual observation template and row closure. | E3 guide. | External/lab | P0 | Keep distinct |
| Evidence bundles | Partially implemented | Export artifacts include README/bringup/expected IO/project snapshot; docs define tiers. | Yes | Medium | Artifact determinism and bundle manifest tests. | Grading/evidence guide. | Export/ops | P1 | Keep |
| Import/export | Implemented and manually observed for Import surface; export observed | Import route loaded; Export route observed; roundtrip gates exist. | Import optional, Export required | Medium | Roundtrip and import fidelity gates. | Import utility guide. | Import/Export | P2 | Keep |
| Professor review tools | Partially implemented/unknown | Release checklists and manual QA scripts exist; no separate admin console observed. | Minimal yes | High | Sample grading workflow. | Professor manual. | Ops/Project | P1 | Keep minimal/defer dashboard |
| Troubleshooting tools | Partially implemented | `Start-RedByte.ps1` smoke exists; full course doctor/reset/update set not implemented here. | Yes | High | Doctor/reset smoke. | Troubleshooting guide. | Launcher/support | P0 | Keep/add later |
| Local bridge / hardware bridge | Implemented but untested/dev-only | Bridge packages/scripts exist; docs treat hardware bridge as maintainer-oriented. | No for students | High | Maintainer smoke only. | Maintainer notes. | Internal | P3 | Defer from course package |
| RedByte Lab apps if present | Unknown/review uncertain | `packages/rb-lab-*`, `labs/**`, `tools/labs/**` exist. Not audited file-by-file. | Maybe | Medium | Per-lab inventory. | Lab schedule. | Lab content | P2 | Review |
| Install scripts | Partially implemented | `Start-RedByte.ps1` installs deps if needed; no bounded student `install.ps1` created. | Yes | High | Clean Windows install test. | Install guide. | Launcher | P0 | Keep/add |
| Launch scripts | Implemented and observed | `run.bat`, `Start-RedByte.ps1`, `pnpm start:smoke` passed. | Yes | Medium | Launch smoke on lab image. | Quick start. | Launcher | P0 | Keep |
| Doctor scripts | Documented/partial | Some doctor-like scripts exist, but no course `doctor.ps1` verified. | Yes | High | Doctor JSON/human output smoke. | Troubleshooting guide. | Launcher/support | P0 | Add later |
| Update/reset scripts | Documented only for course need | No bounded course `update.ps1`/`clean-reset.ps1` implemented in this task. | Yes | High | Preserve-project update/reset tests. | Recovery guide. | Launcher/support | P0 | Add later |
| Manuals/docs | Partially implemented | Product manual, contract, readiness docs strong; stale docs coexist. | Yes | High if not narrowed. | Docs validation and stale-link audit. | Student/professor manuals. | Docs | P0 | Keep/rewrite/archive |
