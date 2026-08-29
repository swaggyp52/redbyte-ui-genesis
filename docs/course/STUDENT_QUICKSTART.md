---
doc_status: current
last_validated: 2026-08-28
owner: Connor Angiel
used_by_claude: true
role: student first-lab quickstart
---

# RedByte Student Quickstart

Use this when your instructor assigns a RedByte lab.

RedByte is a browser IDE for supported Basys3 digital-logic projects. It helps you build a circuit, simulate its behavior, map signals to Basys3 resources, and export a Vivado-ready package. It does not replace Vivado. Vivado still builds the bitstream, programs the board, and produces hardware logs when your lab requires them.

This guide describes the **Stable Preview - Browser-E0** workflow. Browser-E0
means the browser workflow and generated package were exercised; it does not
mean Vivado or a physical board was run.

## 1. Open RedByte

Use the URL or local folder your instructor gives you.

If you are using the public app, open:

```text
https://redbyteapps.dev/os/
```

If you are running RedByte from a local Windows course folder, use the setup and launch commands in:

```text
docs/course/windows-quickstart.md
```

For local Windows launches, the normal sequence is:

```powershell
.\setup.ps1
.\launch.ps1
```

Vivado and a Basys3 board are not required to open RedByte or complete browser-level E0 work. They are required only when your assignment asks for Vivado build, board programming, or physical observation evidence.

## 2. Follow The RedByte Spine

Use the surfaces in this order unless your instructor says otherwise:

```text
Project -> Design -> Simulate -> Board & Constraints -> Build & Export

Vivado and board observation are downstream proof activities, not additional RedByte stages.
```

RedByte owns Project through Export. Vivado build, board programming, and board observation are outside RedByte.

### Project

- Start fresh, open a course starter, open recent work, or use Import / Recover if you have a RedByte export ZIP to restore.
- Use the recommended next action on Project when you are unsure.
- Do not treat Import as the normal first step. Import is for recovery or review.

### Design

- Build or inspect the actual circuit graph on the canvas.
- Use **Edit** to change the circuit, **Live** to explore propagation, and
  **Replay** to inspect a recorded Simulate run without changing the design.
- Use Board, IO, Logic, Sequential, and Reusable palette sections as your assignment allows.
- Fix visible design issues before moving on.
- If you loaded a scaffold, it is starter material, not proof that your assignment is solved.

### Simulate

- Choose or author a Scenario, run simulation, and inspect waveform or circuit Replay.
- Expected-output checks are optional. A zero-check run records observed behavior
  as Simulated without claiming PASS.
- Add checks only when the assignment needs validation. Current passing checks
  are the browser proof RedByte uses before trusted Export.
- If a case fails, inspect the first mismatch, return to Design or the expected-output cells, repair, and rerun Compare.

Supported sequential work is limited to Register1 with one clock, rising-edge
capture, active-high asynchronous reset, and supported enable semantics.
RegisterBus, StateBank, falling-edge capture, multi-clock designs, and
unsupported register modes are blocked.

### Board & Constraints

- Map each required project input and output to a Basys3 resource such as `SW0`, `SW1`, `LD0`, a button, or `CLK100MHZ`.
- Check the visible chain:

```text
project signal -> Basys3 resource -> package pin -> XDC line
```

- Browser mapping is E0 evidence. It does not prove the board has been programmed or observed.

### Build & Export

- Build or download the Vivado package from Build & Export.
- A Draft export can be useful for debugging, but it is not trusted proof.
- A trusted E0 export requires current Design, current Compare PASS, current mapping, and the current package to agree.
- Keep the exported ZIP with your submission. It can include `top.vhd`, `top.xdc`, `testbench.vhd`, `vivado_import.tcl`, README/handoff files, `EXPECTED_IO.json`, and `project.rbproj.json`.

### Vivado And Board Work

If your lab requires hardware proof:

1. Unzip the package.
2. Follow the package README or run `vivado_import.tcl` as your instructor directs.
3. In Vivado, run synthesis, implementation, and bitstream generation.
4. Program the Basys3 board.
5. Record the required observation procedure.

## 3. Know The Proof Tiers

| Tier | What it proves | Produced by |
|---|---|---|
| E0 | RedByte browser/package evidence exists for the current project state. | RedByte |
| E1 | Vivado synthesis, implementation, and bitstream completed. | Vivado |
| E2 | A bitstream programmed onto a Basys3 board. | Vivado Hardware Manager or equivalent |
| E3 | Physical board behavior matched the assigned procedure. | Human or recorded board observation |

E0 does not prove E1, E2, or E3. E2 programming does not prove E3 observed behavior.

## 4. What To Submit

Follow your assignment, but a normal RedByte submission may ask for:

- the RedByte export ZIP from Export
- a screenshot or note showing current Compare PASS
- a screenshot or note showing completed Basys3 mapping
- Vivado build logs or screenshots when E1 is required
- board programming evidence when E2 is required
- an observation note, photo, or video when E3 is required

Do not modify files inside the exported ZIP after download unless your instructor explicitly asks you to. Re-export from RedByte instead.

## 5. Common Fixes

| Symptom | First action |
|---|---|
| You have no project yet | Open Project and choose Build Fresh or a course starter. |
| Design looks wrong after loading | Use Fit or Center in Design, then inspect nodes and wires. |
| Simulate says stale | Rerun Compare after changing the design, testbench, or mapping. |
| Compare FAIL | Open the first mismatch and compare expected vs observed values. |
| Board & Constraints says mapping is incomplete | Map every required input/output row to a Basys3 resource. |
| Export is Draft or Needs Review | Finish Compare PASS and mapping, then rebuild the package. |
| Vivado reports port or XDC mismatch | Re-export from RedByte and reopen the fresh package in Vivado. |
| Import fails | Use a RedByte export ZIP with `project.rbproj.json`, or ask a TA before replacing current work. |

## Attribution

Connor Angiel
