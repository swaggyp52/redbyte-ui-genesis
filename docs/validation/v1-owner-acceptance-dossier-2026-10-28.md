# RedByte 1.0 owner acceptance dossier (2026-10-28)

Status: **decision document for the owner.** Prepared locally on `claude/redbyte-v1-reliability`.
Nothing was pushed, merged, published or deployed. The public site, redbyteapps.dev, still serves
`57c8a94` (= `origin/main`, built 2026-07-27, labelled "1.0.0"; read-only check today).

Evidence roots: rc.7 `.redbyte/releases/redbyte-1.0.0-rc.7-evidence/` (its acceptance work in
`acceptance/`); rc.8 `.redbyte/releases/redbyte-1.0.0-rc.8-evidence/`. Screenshot names below are
relative to an `acceptance/` folder; "rc.8" screenshots come from the rc.8 package. A rendered copy
of this dossier with the screenshots embedded and each finding marked is
`.redbyte/releases/redbyte-1.0.0-rc.8-evidence/dossier/index.html`. Evidence tier throughout:
**E0** (browser and GHDL). Neither candidate has a Vivado, programming or board result.

## 1. Recommendation

**Do not accept rc.7. Accept rc.8, which fixes six named blockers and nothing else, as the
bounded RedByte 1.0.** Its qualification and browser proof are green (section 8). Before any copy
is handed out, the owner must settle **D1 (what the LICENSE grants)** and **D3 (consent for the
Gannon / ECE141 naming and course-derived labs)**. The public-site cutover additionally needs D2,
D5, D7, D8 and D9 (section 10).

rc.7 is a sound engineering base: its gates, 23 journeys and GHDL suites pass, and its claims are
mostly honest. Acceptance testing on the rc.7 package found six defects that a student, or the
distribution itself, would hit:

| # | Blocker on rc.7 | Consequence | Red on rc.7 | Fix in rc.8 | Regression |
| --- | --- | --- | --- | --- | --- |
| B1 | With the inspector open at 1440×900 and 1366×768, the Wire badge and Cancel took a second command row that came and went with every wire, moving the canvas 44 px on every arm and finish (RB-DEBT-030) | the pin a student aims at moves between the two clicks of a wire | `design-workspace-stability` journey fails on the rc.7 package ("choosing Wire moves no pin") | the whole Wire cue lives in the status line; the command row never holds a tool's cue | journey §1: no pin or row moves over three wires at both sizes; unit test `designSurface.authoringIssues` |
| B2 | No notices for React, React DOM, scheduler, zustand, immer, jszip (with the libraries its prebuilt file contains), Tailwind CSS, a Vite helper, IBM Plex fonts (OFL) | every copy handed out lacks the notices these licences require | package listing | `THIRD_PARTY_NOTICES.txt`: 22 packages, each with its licence text, generated from the build's own source maps | `ui:license-audit-gate` runs the generator's `--check` (it was `echo 'gate removed'` since 2026-03-01) |
| B3 | `wallpaper.jpg`: third-party fan art, unused, no provenance, in rc.1–rc.7 | distributing an image RedByte has no right to | package listing | removed from `public/` | absent from the rc.8 listing |
| B4 | "Vivado-ready" (landing page ×3), "Synthesizable top-level VHDL" (Package file note), Verilog preview "Synthesizable Verilog Export / Requires: rb_primitives.v" (no such file) | students are told the output is synthesis-proven; nothing has been through Vivado | text search of the rc.7 bundle | "for AMD Vivado"; "synthesis runs in Vivado, outside RedByte"; "read-only preview" | text search of the rc.8 bundle finds none of the three |
| B5 | QUICKSTART: logs in `.logs` (the launcher writes `run/`); rc.4 rebuild steps | a student following it cannot find the logs | file against `launch.mjs` | corrected; names the notice files | rc.8 QUICKSTART read in the package |
| B6 | Workbench dark: part names near-white on the light sheet (1.14:1) | names vanish once a student picks dark | `design-workspace-stability` §3 fails on rc.7 | schematic ink follows the sheet's own appearance | journey §3: every name ≥ 4.5:1 (rc.8 lowest 14.35:1) |

The product manual was corrected in the same pass: the part number was wrong in three places; the
Vivado procedure failed for designs with modules; §13 described instructor tools that do not exist;
it also claimed "no server", "tamper detection" and the wrong tick semantics, and omitted the
multi-file import exception. The manual is not in the ZIP.

Why not "hold": no fundamental product contract is unsound. Simulation, recording, checks,
persistence, hierarchy values and generated VHDL agree with independent oracles and GHDL; unsupported
parts and imports are refused by name; the launcher fails safely. What remains is usability and
polish (section 4), distribution decisions (section 10), and the absence of Vivado and board
evidence, which the product states openly.

## 2. The candidate

| | rc.7 (not accepted, kept for rollback) | rc.8 (recommended) |
| --- | --- | --- |
| Source commit | `b0d16cad7` | `bc5ec62eb` |
| Source digest | `0192223e…3946` | `990bb8bbf3a470fc4dcac8e191d102ee6956218d964d1dbbcd0da1e4fd99e8a6` |
| ZIP | `redbyte-1.0.0-rc.7-win-x64.zip` | `redbyte-1.0.0-rc.8-win-x64.zip` |
| SHA-256 | `300294d5c7a5954b125cf9cad6b2b3ca386d66945a20c48f31eca12ce9a5cbcb` | `82e179deb31b860ae337cadf6fd262017251d9ccf9e19072d6b676494bc12d8b` |
| Size / files | 33,277,570 bytes; 158 files + `SHA256SUMS.txt` | 33,016,832 bytes; 158 files + `SHA256SUMS.txt` |
| Differences | — | adds `THIRD_PARTY_NOTICES.txt`; removes `wallpaper.jpg`; launcher, server, Start/Stop scripts, Node runtime and LICENSE byte-identical; 14 source files changed outside `docs/` (Design cue and ink, two copy strings, the start page, notices generator, packager, licence gate, one journey) plus one test; no storage, simulation or export logic |

rc.7 was verified first: the ZIP matches its `.sha256`; all 158 files match `SHA256SUMS.txt` in
the served folder and after a clean extraction; the report's identity matches `candidate.json`,
`build.json` and the running server's health record. rc.7's evidence folder also holds `qual/`, an
earlier run on `d9e6d6865`; its report correctly cites `qual-final/` (on `b0d16cad7`).

**What the ZIP is: a portable package, not an installer.** Unzip and run. It creates no registry
entries, shortcuts or services and needs no administrator rights; nothing is written outside the
folder except the browser's own site data.

- `Start-RedByte.cmd` / `Stop-RedByte.cmd` (+ `.ps1`): run the launcher with the bundled runtime.
- `launch.mjs`, `server.mjs`: launcher and static file server, bound to `127.0.0.1` only.
- `runtime/node.exe`, `runtime/LICENSE`: Node.js 20.19.0 win-x64, byte-identical to the official
  distribution.
- `app/`: the built web application (`os/` is the IDE, `start.html` the landing page).
- `samples/`: a counter lab, a session backup, an oracle file and a project.
- `QUICKSTART.md`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`, `candidate.json` (identity and source file
  hashes), `SHA256SUMS.txt`.
- At run time it creates `run/` beside itself (ownership receipt, server logs, start lock).
  Projects live in the browser's IndexedDB for `http://127.0.0.1:<port>`, not in the folder.

**Requirements.** Windows 10/11 x64 and a current browser. Tested in Chromium only (Playwright);
Edge and Chrome are Chromium-based but were not tested separately; Firefox and Safari are untested.
Optional, outside RedByte: AMD Vivado 2024.2 for synthesis, bitstream and programming, and a Basys3
board. Students do not need GHDL (it is a qualification tool). RedByte never calls Vivado or GHDL;
with neither installed, Package still builds the ZIP and says "Synthesis, the bitstream and the
board itself happen there — RedByte has not run them."

**Independence.** rc.8 extracted with `Expand-Archive` into a clean folder, its 158 files verified,
started through `clean-run.cmd` (`PATH=C:\Windows\System32;C:\Windows`, no Node or development
variables, run from the user's home folder) with fresh browser profiles: 51 requests, none outside
`127.0.0.1`; no console or page errors; only its own storage keys; no service worker or cookie
(`acceptance/deps-probe.log`). Lifecycle (`acceptance/lifecycle.json`): stop and start keep saved
work; Start while running reopens the same instance; after the server is killed, Start recovers
with the work intact; a stale start lock is refused with its exact path and recovers once removed.
Negative environment (a separate rc.7 extraction, `rc.7 …/acceptance/launcher-negative.txt`):
runtime folder missing, a port owned by another folder (start and stop), a port held by another
program (start and stop), port 80 and an unknown option each exit 1 with a specific message and stop
no process. The launcher, server, scripts and runtime are byte-identical in rc.8, so these cases hold
for it unchanged.

## 3. Walkthrough: the fifteen owner tasks

Done as a student would, by pointer and keyboard on visible controls, in a fresh profile on the
packaged build, first on rc.7 and again on rc.8 (`acceptance/walkthrough/NN-*.png`, 27 steps,
no page errors). No store manipulation; the test bridge was not loaded (it loads only with `?e2e=1`).

| # | Task | What I did | Result | Friction |
| --- | --- | --- | --- | --- |
| 1 | Create a new circuit | Project → Blank project | Design opens with library, canvas and "Next on canvas" guidance (02) | — |
| 2 | Wire a combinational design (Y = A AND B) | choose Input Pin, click the canvas (twice), AND Gate, Output Pin; Add label A, B, Y; Wire, click pin then pin (three times) | three wires, values drawn on the pins (05, 08, 10) | both inputs are named "INPUT 1" until labelled; six "problems" (board mapping) appear after placing three parts |
| 3 | Make and correct a mistake | A.out → B.out | refused: "Outputs cannot be wired directly to each other. Source kept: A out…"; the target is tagged "Both outputs"; Esc cancels (11, 12) | on rc.7 the Wire row moved the canvas (B1, fixed) |
| 4 | Simulate actual behaviour | Explore; toggle A and B | Y = 1 only for 1·1 (13) | — |
| 5 | Add an expected-output check | Test this design → Generate all → Y expected per case | four cases (14–16) | — |
| 6 | Record the result | Run | "Recorded #1 · 4 checks passed" (17) | a red "4 problems" (unmapped pins) sits under a passing run |
| 7 | Waveform and sheet correspondence | Recorded trace; Circuit | trace and recorded circuit agree at the cursor tick (18, 19) | — |
| 8 | Follow a signal across representations | Follow signal on Y | followed across table, trace and circuit (20) | — |
| 9 | Save and reload | Save; reload the page | project and recording restored (21, 22) | Save never asks for a name; the package is later named after an internal id (`rb-blank-sqw6ql-vivado-project.zip` on rc.8) |
| 10 | Create or use a reusable module | open the hierarchical 4-bit adder starter; module creation from a selection is covered by the `nested-adder` and `nested-create-module` journeys (both pass on rc.8) | instances `u_fa0…u_fa3` of a FullAdder module (`gallery/hier-*`) | double-clicking an instance does not open it |
| 11 | Inspect a hierarchical design | open `u_fa1` and back; the same design in Meridian with recorded values on instance wires | values inside and outside instances agree (`gallery/hier-inside-module`, `meridian-hier-recorded`) | Meridian draws instances as empty boxes |
| 12 | Map a supported board resource | Board → A → click SW0; B by keyboard (Tab to the resource selector, arrows, Save assignment); Y → LD0 | A→SW0, B→SW1, Y→LD0, "MAPPING COMPLETE" with Continue to Package (23, 24) | the recommendation offers SW2 for B; the header shows `node-v2-3/b`; board labels overlap |
| 13 | Generate an HDL package | Package → Rerun after mapping → Generate & download checked ZIP | a Vivado project ZIP: `.xpr`, `top.vhd`, `top.xdc`, `testbench.vhd`, `vivado_import.tcl` (25–27) | — |
| 14 | Run real GHDL validation | GHDL 6.0.0 on the downloaded `top.vhd` and `testbench.vhd` (`acceptance/ghdl-check/`) | `status=PASS checks=4 failures=0`; with the AND changed to OR: "Vector 1 failed on Y: expected '0', got '1'" (rc.7 and rc.8) | — |
| 15 | An unsupported circuit refused | open a legacy project containing MUX4; import a Vivado ZIP whose logic cannot be rebuilt | Simulate and Package refuse by name with the fix (`gallery/mux-*`); the import keeps the ports only and says so (`gallery/vhdl-import-*`) | the refusal sentence is duplicated in Problems; the import's Mode card says "Reconstruction" |

Hidden knowledge: **Meridian (Sheet, Time, Logic, Source and Board lenses) is reachable only by
adding `?studio=meridian` to the address.** Nothing in the IDE links to it. Everything else in the
fifteen tasks was discoverable from visible controls. Wire mode ends after each completed wire
(clicking the next source pin starts it again): learnable, but not said on screen.

Small ports (RB-DEBT-029): a pin's mark is 16 px tall at 100 %, but a part's pins are 32 px apart,
so 24 px circles centred on adjacent targets do not intersect: the WCAG 2.5.8 spacing exception
holds for pins on one part. Targets still overlap where two symbols meet pin-end to pin-end (the
nested-adder layout). Post-release.

## 4. Visual critique

The brief's questions, answered in context:

- **Is the engineering object dominant?** Design: yes, the canvas is central with library and
  inspector either side (at 1366 with both docks open it gets a little over half the width).
  Simulate: the case table dominates, as it should. Board: no — a pale drawing between two columns.
  Package: the file list is clear. Meridian: the sheet dominates every lens.
- **Is the next action obvious?** Mostly ("Next on canvas", "Test this design", "Select next
  signal", "Continue to Package", "Generate & download"). Board-mapping errors in red while the
  student is still designing suggest something is broken when nothing is.
- **Design vs simulation vs evidence?** Distinguishable: the stage rail, "Recorded #n", "Exploring ·
  not recorded" in the inspector, "browser simulation · E0" in Meridian, and the E0 line on Package.
- **Lenses recognisable; selection consistent?** Yes in Meridian. With Q1 selected at t3 on the
  counter, the selection ring and inspector hold through Time, Logic, Source and Board; Logic shows
  the next-state expression with the t3 row marked and says it is derived, not observed; Source
  highlights the process for Q1 ("Q1 = lines 36-42 · as recorded"); Board lights LD1
  (`lenses/lens-*-q1-t3.png`). In the IDE the header chip follows selection but shows internal ids.
- **Waveform ↔ source ↔ schematic?** Understandable: recorded trace and recorded circuit agree at the
  cursor tick; the inspector explains a register's value from the recording ("Q1 was 0 at t2 and is
  1 at t3… read D = 1 (from RST1)"). Generated source names (`dff_1`, `and_2`) are not part names;
  the margin tag bridges them.
- **Blocking errors specific and actionable?** Yes (MUX4 names the part and the fix; wiring warnings
  name each disconnected output). Defects: a duplicated sentence; overlapping labels.
- **Ungrounded or misleading values?** Problem counts disagree on one screen; the import Mode label
  contradicts its outcome.
- **Unfinished-looking?** Truncations ("Filte", "Choose a compatib", "Inspect ports …") and board
  label collisions.
- **One coherent application?** The IDE is. Meridian is a second visual language reached by URL.

Findings, by consequence for students:

| ID | Finding | Screenshot | Reproduce | Class |
| --- | --- | --- | --- | --- |
| V1 | Canvas moved 44 px when wiring with the inspector open | rc.7 `walkthrough/11` vs rc.8 `walkthrough/11` | 1440×900, select a part, Wire, click a pin | **Blocking: fixed in rc.8 (B1)** |
| V2 | Part names illegible in Workbench dark | rc.7 vs rc.8 `gallery/dark-design` | open 2-Bit Up Counter; Ctrl+K "Workbench dark" | **Blocking: fixed in rc.8 (B6)** |
| V3 | Problem counts disagree (toolbar "0E 3W", panel "Errors 3", tab "6", "All 9", status "6 problems"); board mapping shown as red errors while designing and under a passing run | `walkthrough/07`, `17` | blank project; place two inputs and an output | Important post-release |
| V4 | Internal ids shown to students: inspector "Verify focus output_1"; header "SIGNAL B → node-v2-3/b" | `walkthrough/11`, `23`, `24`, `25` | select Y in Design; select B on Board | Important post-release |
| V5 | Duplicate default names ("INPUT 1" twice) | `walkthrough/07` | place two Input Pins | Important post-release |
| V6 | Board drawing: "SLIDE SWITCH INPU" runs into BTND; BTN labels collide with their circles; pale, low-contrast page | `walkthrough/23`, `24` | open Board on any project | Important post-release |
| V7 | Board recommends SW2 for the second input B ("switch matching bit 2") | `walkthrough/23` | map A, then select B | Important post-release |
| V8 | Save never asks for a name; the downloaded package is named after an internal id | `walkthrough/21`, `27` | blank project → Save → Package | Important post-release |
| V9 | Double-clicking a module instance does not open it | `gallery/hier-design` | hierarchical adder; double-click `u_fa1` | Important post-release |
| V10 | 720×450 at 150 % text: Start shows about 1.5 rows; "PATH 3" collides with the title; the starter's preview pane collapses to 0 px, so the status line covers Open starter: a pointer cannot open a starter, the keyboard can (Tab, Enter). Design at 720×450 scrolls (toolbar out of view after Fit) | `narrow/narrow-landing-720x450-24` | browser text 150 %, window 720×450, Starters → Full Adder | Important post-release |
| V11 | Problems: a refusal sentence repeated within one entry; category labels drawn over message text | `gallery/mux-package-refused` | open a MUX4 project; Package | Important post-release |
| V12 | Import Mode card says "Reconstruction" for a ports-only outcome | `gallery/vhdl-import-import-review` | import a Vivado ZIP with behavioural VHDL | Important post-release |
| V13 | Meridian hierarchy: instances drawn as empty boxes with unnamed ports, slanted wires, an unnamed input, B[0] clipped; Meridian reachable only by URL | `gallery/meridian-hier-recorded` | `?studio=meridian`, hierarchical adder, Run | Important post-release (V1.1) |
| V14 | Hierarchical adder opens with SUM and carry-out cut off until Fit | `gallery/hier-design` | open the starter at 1440×900 | Important post-release |
| C1 | Browser tab titled "RedByte Playground" | any | — | Cosmetic |
| C2 | Library tabs wrap; "Filte" placeholder cut by Bus +; section headers clipped | `walkthrough/02` | — | Cosmetic |
| C3 | Unexplained orange dot on the Package rail | `walkthrough/07` | — | Cosmetic |
| C4 | Starter subtitle "Logic Gates: AND / OR / XOR" begins with "· ·" | `gallery/starters-list` | — | Cosmetic |
| C5 | Truncated selects ("Choose a compatib", "LD0 · LED LD0 · p"); "Choose in resource control" headline | `walkthrough/23`, `24` | — | Cosmetic |
| C6 | Import headline "…replacing current work early"; stepper text cut | `gallery/vhdl-import-import-review` | — | Cosmetic |
| C7 | "Unsupported synth subset node" is engine jargon | `gallery/mux-package-refused` | — | Cosmetic |
| C8 | Package page's lower half empty | `walkthrough/25` | — | Cosmetic |
| C9 | Home preview crops the third gate (XOR, LD2) | `walkthrough/01` | open RedByte | Cosmetic |

Keep: the unwired lab's failure state (`gallery/incomplete-failed-run`: "16 of 16 checks failed",
`X ≠` per cell, VPRE1005 per output, Open in Design, First / Previous / Next); the Package boundary
sentence; Home's footer ("Vivado synthesis, bitstream and board observation stay outside
RedByte"); Meridian's grounded explanations and lens correspondence; refusal by name everywhere.

## 5. RB-DEBT-029, 030, 031

| Debt | Reproduced on rc.7 | Measured impact on a task | Decision |
| --- | --- | --- | --- |
| 029 small pin targets | yes: 16 px mark at 100 % | pins on one part 32 px apart: the WCAG 2.5.8 spacing exception holds; targets overlap only where two symbols meet pin-end to pin-end | post-release |
| 030 Wire row moves the canvas | yes: 44 px at 1440×900 and 1366×768 with the inspector open, on every arm and finish | the aimed pin moves between the two clicks of a wire | **crossed the V1 threshold: fixed in rc.8 (B1)**; a cut refusal has a More control that shows it whole (`design-workspace-stability` §2, 720×450) |
| 031 status line height changes | yes, in narrow windows with enlarged text | measured on both candidates (`probes/wire-narrow-rc7.json`, `-rc8.json`: choose Wire, arm, refuse, Esc, with a part selected). At 1440, 1366, 1280 and 1024 px no pin moves in rc.8. While a wire is armed the status line grows 5 px (48→53) at 1280×650 and 1024×640 with 150 % text (rc.7 only at 1024×640), without moving a pin. At 720×450 the Design workspace is taller than the window and scrolls (the surface grid sits 346 px down after Fit), so reaching the toolbar's Wire scrolls the circuit, identically in rc.7 | post-release; the 720×450 scrolling belongs with V10 |

## 6. What 1.0 supports

**A. Native browser capability (E0).**

| Capability | Status |
| --- | --- |
| Parts, wiring, undo, keyboard authoring, schematic | Supported |
| Modules one level deep (create from a selection, instances) | Supported |
| Nested modules (a module inside a module) | Supported with limits: unit tests and the `nested-create-module` journey (passes on rc.8; not part of the release runs) |
| Buses / vector ports | Supported with limits |
| Combinational simulation | Supported (matrix against an independent oracle) |
| Register1 (one rising clock, active-high async reset and enable); D/T/JK flip-flops, D latch | Supported with limits |
| Automatic `CLK100MHZ`, manual and custom clock lanes | Supported |
| RegisterBus, StateBank, multi-clock, falling edge, active-low reset, generated clocks; MUX4, Counter4Bit, Delay | **Refused by name** |
| Combinational feedback loops | Supported with limits (deterministic, RedByte-timed; HDL may settle differently) |
| Runs, recordings, scenarios, comparison, reproduce | Supported (determinism shown on one machine) |
| Imported VCD | Supported, labelled external and not executed |
| Checks: fail → repair → pass, stale | Supported |
| IndexedDB persistence; `.rbproj` open / Save As / Duplicate; `.rb-session.json` backup | Supported |
| Meridian Sheet, Time, Logic, Source and Board lenses | Supported with limits: only via `?studio=meridian`; no Export of its own |
| Buttons; seven-segment mapping | Supported with limits (seven-segment unit-tested only) |

**B. Generated artifacts (E0 bytes).** Flat and one-level hierarchical `top.vhd` with module files:
supported and run in GHDL. Nested-hierarchy VHDL: not proven in GHDL. `top.xdc`: text only, port
names checked. `testbench.vhd`: run in GHDL, never in Vivado's simulator. `.xpr`,
`vivado_import.tcl`, README, BRINGUP, EXPECTED_IO and the project file: assembled and
consistency-checked, never opened by Vivado. `program_and_test.tcl`: a scaffold (its programming
commands are commented out). Design-tab Verilog: a read-only preview, never compiled (rc.8 says so).
Reproducible ZIP and receipt: supported.

**C. External validation (GHDL 6.0.0).** Ten real GHDL runs of generated benches (AND, two-bit
counter, inverted counter, authored-clock counter); Register1 enable and reset; a hierarchical top
(40 checks); the preserved imported source with a hand-written bench; five imported sources whose
regenerated VHDL is run; the artifact-consistency matrix (11 fixtures with mutants); power-on and
module-input cases; and the owner-task package (section 3). Never run in GHDL: lab starters before
they are wired, MUX4, `.xpr`, Tcl, XDC, nested hierarchy, the multi-file preserved package, the
Verilog preview.

**D. Vendor (Vivado): nothing proven for 1.0.** Opening `.xpr`, synthesis, XDC acceptance,
implementation, timing, bitstream, Vivado simulation and the generated README's "harmless messages"
list are all unrun for this release. Historical real-Vivado runs (April–May 2026, five designs, no
hierarchy) predate 29 generator commits and do not carry over.

**E. Physical hardware (Basys3): nothing proven for 1.0.** Programming, observation, pin correctness
on a board and the bring-up procedures are unrun. Board Check is a browser simulation.

**HDL import boundary.**

| Outcome | When | What RedByte does | Status |
| --- | --- | --- | --- |
| Rebuilt circuit | every construct maps to RedByte parts, assignments, register processes or constant ties | editable circuit, simulation, regenerated HDL, Export | supported with limits (five sources proven in GHDL) |
| Preserved and refused | any construct not rebuilt (numeric_std, unrebuilt next-state logic, unknown components) | ports-only scaffold, blocking diagnostics, outputs X, Export refused (RBEX4103), source kept byte for byte | refused by name |
| Preserved and shipped | a ZIP with more than one VHDL file and an XDC whose ports match the top entity | original files exported unchanged under `imported/`; Package says "Preserved imported top-level VHDL (multi-file handoff)" | **not proven** (no GHDL, Vivado or browser run); documented in manual §12.2; keep or refuse is D5 |
| Not covered | Verilog import (parser and diagnostics only) | — | not offered |

RedByte is not a synthesis tool and does not import arbitrary VHDL. rc.8's UI, landing page and
QUICKSTART follow this table and the manual was corrected to it. Copy still to align (section 11.C):
the generated README's "deterministic synthesizable VHDL" line (it moves golden hashes), the
generated README's "Vivado 2024.2+" and "harmless messages", "Mapped for synthesis" on Board,
`README.md`, `docs/course/STUDENT_QUICKSTART.md` and `docs/VIVADO_INTEGRATION.md`.

## 7. Shipping hygiene

Classes: (a) fine as documented; (b) owner confirmation; (c) before public distribution; (d) before
any distribution. No legal conclusion is drawn here.

| Item | Evidence | Class | rc.8 |
| --- | --- | --- | --- |
| Notices for the bundled libraries and the IBM Plex OFL text | none in rc.7 | d | **fixed**: `THIRD_PARTY_NOTICES.txt`, 22 packages |
| `wallpaper.jpg` fan art | rc.1–rc.7, `main` | d | **removed** (still on `main` and the live site until cutover) |
| QUICKSTART `.logs`, rc.4 steps | QUICKSTART against the launcher | d / c | **fixed** |
| Licence gate was `echo` | `package.json` since 2026-03-01 | c | **fixed**: checks what ships |
| LICENSE: no licensor, no grant of any right to use, "All rights reserved" (which `docs/legal-attribution.md` bans); the source headers' "RPL-1.0" collides with the Reciprocal Public License identifier | `LICENSE`, source headers | b, before any distribution | **D1** |
| Source maps embed the full TypeScript source (26 maps, about 6.4 MB) and are served | `app/os/assets/*.map` | b, then c | **D2** |
| "Gannon Pilot" and "ECE141" shown to users; Labs 1–8 mapped from ECE141 handouts (repo docs name the instructor) | bundle, `docs/labs/INVENTORY.md` | b (class) / c (public) | **D3** |
| Node 20.19.0 runtime; Node 20 reached end-of-life on 2026-04-30 (nodejs/Release schedule) | `runtime/` | b | **D4** |
| `public/` leftovers shipped: `bootstrap.ps1` (clones the repository, auto-accepts winget agreements), four React test pages loading unpkg.com, placeholder icons, unused labs and samples, GitHub links, the `?e2e=1` test bridge, hosting configs (`_headers`, `_redirects`, `CNAME`) | `app/` | c | **D7** |
| `build.json` says `env: "dev"` in the package | `build.json` | c (label only) | unchanged; documented |
| The health endpoint returns absolute paths (the Windows user name) to a local request; no CORS headers; bound to 127.0.0.1 | `local-server.mjs` | c (hardening) | unchanged |
| jszip is dual MIT / GPL-3.0 | `node_modules` | b | record MIT (D10) |
| Commits from university accounts and machines; AI co-authorship | git history | b | D11 |
| Third-party "superpowers" skills under `.claude/skills/` without licence files; course and vendor PDFs in git history | repository only, not shipped | a (package) / c (public repository) | D11 |
| Secrets, tokens, keys | every packaged file | a | none found |
| Private paths or e-mail addresses in maps or bundle | maps, bundle | a | none (only a `C:\Users\YourName` placeholder) |
| Node runtime notice | `runtime/LICENSE` | a | present |

## 8. Evidence

All on Node 20.19.0; GHDL 6.0.0 (`REDBYTE_GHDL`, with `REDBYTE_REQUIRE_GHDL=1` exported for every
gate, recorded in `qual/qualify.sh` and `qual/ghdl.txt`).

**Qualification** (`qual/summary.txt`, full run on `9cc2ac081`; `qual-delta/` on `bc5ec62eb`):

| Gate | Result |
| --- | --- |
| vitest IDE | on `9cc2ac081`: 2 failed, 2173 passed, 1 skipped. The legend-contrast test's CSS parser required `:root[…] {` and B6 had given both schematic token blocks a selector list, so both themes parsed as empty and the test failed before measuring. Fixed in `bc5ec62eb` (test only; it passes on the rc.7 and rc.8 stylesheets and fails at 1.49:1 when the light label ink is `#c4ccd8`). On `bc5ec62eb`: 304 files, **2175 passed, 1 skipped** |
| vitest rest of rb-apps | 230 files (+1 skipped), 1852 passed, 3 skipped |
| rb-logic-core / rb-studio / rb-studio-kernel / rb-utils / rb-fpga-proof-core / rb-logic-view (+ crash-guard) | 531 / 53 / 33 / 24 (+2 skipped) / 32 / 85 (+1) passed |
| the nine other included packages | 32 files, 252 passed, 1 skipped |
| `apps/**` | no test files |
| Typecheck baseline | +0 in every scope (repo 138), on both commits |
| `verify:gates` | exit 0 (467 s), the licence gate now checking the shipped notices |
| `build:unified` | exit 0 |

**Skipped tests, named.** rb-apps rest: the two "GHDL unavailable" placeholders (they skip only when
GHDL is present) and `inspect-fixture`; IDE: one; rb-utils: two; the nine packages: one; rb-apps: one
skipped file. All match rc.7's counts.

**GHDL really ran.** Every GHDL suite reports its GHDL-present pattern. A negative control
(`qual-delta/ghdl-negative-control.log`: `REDBYTE_REQUIRE_GHDL=1`, GHDL path missing) fails eight
suites (47 tests) as designed, but four suites skip instead of failing (`testbench.ghdl-execution`,
`register-config-authority.agreement`, `hdl-export.fail-closed`, `vivado-e1-harness`; 16 more
skips). So a qualification without GHDL would show more skips, not failures; rc.8's skip counts are
the GHDL-present ones. Tracked as RB-DEBT-032.

**Browser proof on the rc.8 package** (`browser-proof-summary.txt`):

| Run | Where | Result |
| --- | --- | --- |
| Clean extraction | scratch folder, stripped environment | 158/158 files verified; started and stopped by its own scripts |
| Independence probe | clean copy, port 5199 | no request outside 127.0.0.1; no console or page errors |
| Lifecycle | clean copy | stop/start, reopen, crash recovery and stale lock all as designed |
| Owner walkthrough | clean copy | 27 steps, no page errors; package downloaded |
| GHDL check of the download | GHDL 6.0.0 | PASS 4/4; the AND→OR mutant fails |
| Gallery | clean copy | 20 states, light and dark; the 720×450 at 150 % session could not click its way into a starter (as on rc.7; V10) |
| Meridian lenses with a selection | packaged folder, port 5188 | one selection through Time, Logic, Source, Board; no page errors |
| `verify-candidate.mjs` | packaged folder, port 5188 | **24/24 pass** (12 min; `sourceUnchanged: true`; served build 1.0.0-rc.8 at `bc5ec62eb`), including `design-workspace-stability` |
| Counter-proof gate + 14 classroom journeys | packaged folder | **15/15 pass** |
| `ide-meridian-counter-slice` | packaged folder | **134/134** |
| The 16 journeys no release run includes (informational) | packaged folder | 8 pass (`crossprobe`, `engineering-location`, `migration`, `nested-create-module`, `package-history`, `parity`, `semantic-zoom`, `source-files`); 8 fail identically on rc.7 and are stale, all last edited 2026-09-05 to 09-08: two target a removed surface (`ide-vcb-workspace-bench`); one waits for a results summary no longer rendered; two expect the VCD tools outside the "Imported evidence" disclosure (`vcd-analyzer` passes); one reads the runs table's first cell as the verdict (it is the run number; the verdict is in Checks); one expects a run readout in the status line (not passed to it since 2026-09-02); one reads the Board's binding chain inside a collapsed disclosure (it does follow keyboard selection: `acceptance-board-detail2`). RB-DEBT-034 |

**Evidence audit.**

- Every directory the root vitest configuration includes was run (rc.6 had missed nine packages; rc.7
  and rc.8 run them); `apps/**` holds no tests.
- Failures are not hidden: each gate's exit code and failing tests are in `summary.txt` and
  `*.failures.txt`; the one red was diagnosed and fixed (above).
- Browser evidence matches the candidate: `verify-candidate` reads the served build's identity from
  the server (version, commit, source digest, package root) and checks the package is unmodified.
  The rc.8 screenshots come from the rc.8 package; rc.7 screenshots are labelled rc.7.
- Checksums: both ZIPs match their `.sha256`; every file matches `SHA256SUMS.txt`. Both were re-verified on
  2026-10-29 after all testing (`rc7-reverify.json`): nothing in either candidate was modified.
- Reproducibility: packaging is checked (the packager zips twice and compares; it records a boolean,
  not both hashes). Builds are not byte-reproducible by design (`build.json` carries a timestamp);
  the source digest identifies the inputs.
- Stale output: rc.7's `qual/` is an earlier run on `d9e6d6865`; only `qual-final/` is rc.7's.
- Fixed waits: about 80 sleeps in three long journeys predate rc.5; they can only cause a timeout,
  not a pass, and none sits in a read this decision depends on. The new stability journey has none.

## 9. Release risks

- **Licensing (D1, D2, D3, D10, D11).** The LICENSE text grants no right to use and names no
  licensor. Decide the grant before distribution; take advice where needed.
- **Deployment.** A push to `main` deploys production automatically (`deploy-cloudflare.yml`); the
  release branch is 479 commits ahead of `origin/main` and can be fast-forwarded. A push of any
  `claude/**` branch deploys a Pages preview. Production is rebuilt by CI (Linux, Node 20.19.0,
  `env: production`), so its bytes are not the ZIP's; the workflow verifies the deployed commit at
  `/os/version.json` and smoke-tests `/start.html` and `/os/`.
- **Rolling production back after students save work.** Projects saved by 1.0 may not open in the July
  build (persistence has changed since; not tested). Mitigation: roll back quickly if at all, and
  ask students to export a session backup first.
- **Platform.** Windows x64 only; unsigned ZIP and `.cmd` scripts (Mark-of-the-Web and SmartScreen
  behaviour of a downloaded ZIP was not tested; tests extracted local files); Chromium only; Node 20
  past end-of-life.
- **Evidence tier.** E0 only. A student's first Vivado run is the first Vivado run of this release's
  output.
- **Multi-file preserved import** ships unverified source (D5).
- **Meridian** is hidden; anyone told about it reaches a second visual language (D6).

## 10. Owner decisions

| ID | Decision | Options | Needed before |
| --- | --- | --- | --- |
| D1 | Licence grant and licensor | write a grant (who may install, run and share it within a course), name the licensor, add a warranty disclaimer and a third-party carve-out; drop "All rights reserved" per the project's attribution rules | any distribution |
| D2 | Source maps | ship them (source readable in developer tools) or strip them (a new candidate; generate the notices before stripping, since the generator reads the maps) | public distribution |
| D3 | Gannon / ECE141 naming and course-derived labs | confirm instructor and university consent; or rename them (a new candidate) | classroom use (consent) / public |
| D4 | Bundled Node 20 past end-of-life | accept it for a localhost-only server, or move the runtime to Node 22 (supported to 2027-04-30) or 24 (to 2028-04-30) in a new candidate | public distribution |
| D5 | Multi-file preserved import | keep it (documented, unverified) or refuse it like single-file imports (a new candidate) | public distribution |
| D6 | Meridian exposure | keep it hidden for 1.0 (recommended) or link it from the IDE | 1.0 |
| D7 | `public/` leftovers and the test bridge | strip them from the shipped app (journeys that use the bridge would need a test build) or ship knowingly | public distribution |
| D8 | Generated README "deterministic synthesizable VHDL" line | change it and re-record golden hashes deliberately, or leave it | public distribution |
| D9 | Cutover and label | approve the deployment sequence (section 12); ship the rc.8 bytes as they are, or rebuild them labelled 1.0.0 from the same commit (a new artefact with its own checksum and proof) | cutover |
| D10 | jszip licence choice | record MIT | any distribution |
| D11 | Provenance questions | university IP policy for work on university accounts and machines; AI co-authorship against the copyright headers; third-party skills and PDFs in the repository | public repository / distribution |

## 11. Remaining actions, each with its acceptance criterion

**A. This campaign (done unless marked).** rc.8 packaged, qualified and proven (section 8); dossier,
rc.8 release report, debt register, Design spec and cockpit updated and committed locally; nothing
pushed. Criterion: `git status` shows only `.claude/launch.json`; rc.7's archive and checksum
unchanged.

**B. Owner, before any distribution.** D1, D3 and D10 written down in the repository
(`docs/legal-attribution.md` or a release note). Criterion: the decisions are recorded and the
LICENSE text matches D1.

**C. V1 corrections before the public cutover**, only where the owner chooses to correct rather than
accept knowingly; each needs a new candidate and its proof:

1. Strip the `public/` leftovers (D7). Criterion: none of `bootstrap.ps1`, the unpkg test pages,
   placeholder icons, unused labs and samples, `README.md` or `user-manual.md` in the package
   listing; no `unpkg.com` string in any shipped file; every release journey still passes.
2. Source maps per D2. Criterion: no `.map` in the package (if stripped) and the notices still list
   every bundled package.
3. Generated README line (D8). Criterion: README.txt says "generated VHDL (synthesis happens in
   Vivado)"; golden hashes re-recorded in one commit naming the reason; the E1 export gates pass.
4. Remaining copy (section 6). Criterion: no "Vivado-ready", "synthesizable", "2024.2+" or
   "harmless" claim in shipped or linked documents except where marked historical.
5. Runtime per D4. Criterion: the bundled runtime on a supported line, its hash pinned, the
   lifecycle and negative launcher cases re-run.
6. LICENSE per D1, and `docs/THIRD_PARTY_NOTICES.md` updated (it still says "All licenses
   validated"). Criterion: LICENSE names the licensor and the grant; the document matches the
   generator's list.
7. RB-DEBT-032. Criterion: with `REDBYTE_REQUIRE_GHDL=1` and no GHDL, every GHDL suite fails.

**D. Post-release (1.0.x), by student consequence.**

- V3. Criterion: one problem count everywhere; unmapped pins are notes until Board.
- V4. Criterion: no `node-…` or `output_1` text in any student-visible string.
- V8. Criterion: Save asks for a name once, and the package uses it.
- V6 and V7. Criteria: no overlapping text on Board at 1366–1440; after A→SW0, B is offered SW1.
- V5. Criterion: default names are unique.
- V9. Criterion: double-clicking an instance opens it.
- The rest: V10, V11, V12, V14 and the cosmetic list.

## 12. Deployment sequence (prepared, not executed) and rollback

Preconditions: owner approval of rc.8 and of D9; D1 settled.

1. **Freeze.** Confirm the local branch and a clean tree (only `.claude/launch.json`), and that
   `HEAD` descends from `bc5ec62eb` with documentation-only commits after it:
   `git diff --stat bc5ec62eb HEAD -- . ':(exclude)docs'` prints nothing.
2. **Preview (approval: push).** `git push origin claude/redbyte-v1-reliability`. GitHub Actions
   deploys a Pages preview for the branch. Check its `/os/version.json` sha equals `HEAD`, open
   `/start.html` and `/os/` in a fresh profile, and run `design-core-authoring` against the preview
   URL.
3. **Pull request (approval).** Open a pull request into `main`. CI on Node 20.19.0 must be green;
   it is the faithful golden-gate signal.
4. **Merge (owner).** A fast-forward is possible. This triggers the production deploy; the workflow
   checks `https://redbyteapps.dev/os/version.json` for the merge commit and smoke-tests the site.
5. **After the deploy.** `/build.json` shows the merge commit and version 1.0.0; `/start.html` has no
   "Vivado-ready"; `/wallpaper.jpg` no longer serves an image; a fresh profile completes tasks 1–6.
6. **Windows ZIP.** Distribute the accepted rc.8 bytes with their `.sha256`, or the rebuilt 1.0.0 ZIP
   with its own checksum and proof (D9).

**Rollback.**

- **Production:** in Cloudflare Pages, roll back to the previous production deployment (`57c8a94`),
  or revert the merge on `main`, which redeploys. DNS is never touched.
- **Local package:** run `Stop-RedByte.cmd` in the rc.8 folder, then `Start-RedByte.cmd` in the rc.7
  folder on the same port. rc.8 changes no storage code, so projects carry over.
- **Archives kept:**

  | Candidate | SHA-256 |
  | --- | --- |
  | rc.7 (re-verified 2026-10-29) | `300294d5…cbcb` |
  | rc.6 | `9559b03b…e56e` |
  | rc.5 | `b14b8f96…0371` |
  | rc.4 owner delivery | `80239d91…9deb` |

## 13. Roadmap

**V1 corrections:** bounded; section 11.C and the owner decisions. No feature work.

**V1.1: make Meridian the reason to use RedByte**, on the same circuit authority, without
destabilising 1.0. The acceptance run shows the foundation is there: one selection already holds
across four lenses, and the explanations are grounded in the recording. What is missing is reach
and depth.

1. **Expose Meridian from the IDE (D6)**, with one selection across Sheet, Time, Logic, Source and
   Board: select a net anywhere and see it in every lens at the same tick.
2. **Hierarchy as a first-class view:** instances drawn with named ports, opened in place, with
   breadcrumbs and values at every level from the same recording (fixes V13).
3. **Time exploration:** scrubbing, stepping inside a tick, and comparing two recordings lane by
   lane on the sheet.
4. **Editing in Meridian** (wire, rename, add a part) under the IDE's refusals, so structure and
   behaviour live in one place.
5. **Source that speaks the circuit's names:** generated signals named after parts (`Q1`, not
   `dff_1`).
6. **Evidence linked to place:** a failed check opens the lens and tick that show the mismatch.
7. **Student polish from section 4** (V3–V12).

**Future (not scheduled):**

- Recorded Vivado runs (E1) and board observation (E2/E3) as product evidence.
- Reconstruction of nested-hierarchy and multi-file imports.
- Verilog import.
- Instructor tools (review, signing).
- macOS and Linux packages.
- Signed distribution.
