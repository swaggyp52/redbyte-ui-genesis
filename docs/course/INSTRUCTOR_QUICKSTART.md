---
doc_status: current
last_validated: 2026-07-27
owner: Connor Angiel
used_by_claude: true
role: instructor setup and assignment quickstart
---

# RedByte Instructor Quickstart

Use this to assign a supported RedByte lab without relying on agent-only context.

RedByte V1 is a browser-based Basys3 digital-logic lab workbench. The classroom spine is:

```text
Project -> Design -> Simulate -> Board & Constraints -> Build & Export
```

Vivado build, board programming, and board observation are downstream proof steps. RedByte is not a Vivado replacement, not a universal HDL IDE, not a broad board abstraction, and not a SaaS classroom-management product.

The current release posture is **Stable Preview - Browser-E0**. It is suitable
for supervised evaluation of the supported browser workflow, not an
unsupervised-classroom reliability claim.

## 1. Choose The Assignment Scope

Start with labs that match current support:

- basic combinational logic such as AND, OR, XOR, and half adder work
- small Basys3 switch-to-LED mappings
- Register1 sequential examples with one clock, rising-edge capture,
  active-high asynchronous reset, and supported enable semantics only
- built-in lab profiles for Logic Gates, Half Adder, 2-Bit Counter, and the Lab 8 scaffold as E0 course metadata, not a full course-pack authoring system

Before assigning hardware requirements, check:

```text
docs/STUDENT_RELEASE_READINESS.md
docs/release/vivado-basys3-certification-matrix.md
docs/release/redbyte-bench-evidence-model.md
```

Do not advertise a project class as student-safe hardware work unless the required E1/E2/E3 evidence exists for that class.

## 2. Pick A Delivery Path

### Public hosted evaluation

Use when students only need the browser IDE and no local repo workflow:

```text
https://redbyteapps.dev/os/
```

Confirm the deployed page is the intended version before using it for class.

### Local Windows course folder

Use when students or a lab image run RedByte locally:

```powershell
.\setup.ps1
.\launch.ps1
.\doctor.ps1
```

The script details are in:

```text
docs/course/windows-quickstart.md
```

The doctor treats Git, Vivado, and Basys3 checks as advisory unless you require hardware validation.

## 3. Explain The Student Workflow

Students should use:

1. Project: open a blank project, starter, saved project, or Import / Recover utility.
2. Design: build or inspect the circuit graph.
3. Verify: run a Scenario, inspect Replay, and add optional checks when pass/fail proof is required.
4. Hardware: map project signals to Basys3 resources and package pins.
5. Export: build or download a RedByte E0 package.
6. Vivado: run synthesis, implementation, bitstream generation, and board programming only when required.
7. Observation: record physical behavior only when E3 is required.

Import is a recovery/review utility. A RedByte export ZIP with `project.rbproj.json` is the highest-fidelity restore path. Vivado ZIPs and HDL-only inputs are reconstruction-limited and should not be treated as perfect RedByte project restores.

## 4. Set Submission Requirements

For an E0 browser/package lab, require:

- the RedByte export ZIP
- current Compare PASS evidence
- completed mapping evidence when the lab uses Basys3 resources
- any assignment-specific notes or screenshots

For a Vivado or board lab, add only the tiers you actually need:

| Requirement | Evidence to collect |
|---|---|
| E1 Vivado build | Vivado log or screenshot showing synthesis, implementation, and bitstream generation completed. |
| E2 board programming | Hardware Manager or Tcl programming log/screenshot showing the bitstream was programmed. |
| E3 board behavior | Dated observation note, photo, video, or checklist showing expected controls and observed outputs. |

Keep E2 and E3 separate. Programming success is not behavior proof.

## 5. Before Class Checklist

- Pick one supported lab shape and one backup lab shape.
- Decide whether the lab is E0-only or requires E1/E2/E3.
- Give students the public URL or local folder instructions.
- Ask students to run `doctor.ps1` if using local Windows setup.
- Tell students what to submit and which proof tier each artifact satisfies.
- Have the TA use `docs/course/TA_TROUBLESHOOTING_GUIDE.md` for triage.
- Keep the certification matrix open for hardware claim questions.

## 6. Instructor Boundaries

Do not promise:

- automatic browser bitstream generation
- Vivado replacement behavior
- arbitrary VHDL or third-party project migration
- non-Basys3 board support
- turnkey Lab 8 or seven-segment-heavy hardware readiness without matching proof
- accounts, rosters, LMS integration, or hosted grading
- paid classroom readiness before proof, support, license, privacy, and deployment posture are complete

## 7. Good First Pilot

A conservative pilot sequence is:

1. E0-only Logic Gates or Half Adder browser lab.
2. E0 export handoff with students opening the package structure.
3. E1 Vivado build on one known project class.
4. E2/E3 board proof only for a row that has a current procedure and TA support.

## Attribution

Connor Angiel
