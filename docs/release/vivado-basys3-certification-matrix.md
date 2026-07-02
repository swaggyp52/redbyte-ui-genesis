# Vivado + Basys3 certification matrix (RedByte)

**Date:** 2026-05-05
**Purpose:** Separate **export-valid** artifacts from **tool-certified** and **board-certified** outcomes. This is the working matrix for the real lab machine; update cells only with evidence (logs, bit paths, observation notes).

---

## Certification tiers (product vocabulary)

Align with **`docs/STUDENT_RELEASE_READINESS.md`** for instructor-facing language.

| Tier | Meaning | Minimum evidence |
|------|---------|------------------|
| **L0 — RedByte-valid** | Student can load, edit, verify, and map in the IDE without workflow lies. | UX/gates + runtime behavior; not tool/board proof. |
| **E0 — Export-valid** | Deterministic ZIP / project folder passes repo gates; VHDL, `top.xdc`, `.xpr`, and Tcl agree on top module, part, and constraint path. | Green export / project-folder tests; deterministic hash where applicable. |
| **E1 — Vivado-build-certified** | `open_project` + **synth_1** + **impl_1** (including **write_bitstream**) completes in Vivado batch mode without tool failure. | `scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl` log showing expected `STATUS` lines + path to `.bit`. |
| **E2 — Board-program-certified** | `.bit` programs onto a Basys3 via Hardware Manager **or** batch Tcl `scripts/vivado/redbyte_program_device.tcl` (local `connect_hw_server` or remote `-url host:3121`). | Log from `vivado_program.log` showing `program_hw_devices` / `SUCCESS`, or GUI screenshot. |
| **E3 — Behavior-certified** | Observed I/O matches an agreed test procedure (manual or scripted). | Dated observation note tied to project revision / ZIP hash. |

**Rule:** `bundle.valid` and classroom goldens prove **E0 only**. Never describe E0 as “lab ready.”

Evidence classifier support (2026-05-06):

- Model doc: `docs/release/redbyte-bench-evidence-model.md`
- Command: `pnpm rb:bench:evidence:classify`
- Controlled-run outputs: `.redbyte/bench/runs/20260505-222402/evidence-classification.md` and `.json`
- Current controlled classification: `golden-basys3-switch-and`, `signal-tour`, and `two-bit-counter` are all **E2** in that run because observed behavior remains manual/uncertain.
- Hard rule remains active: E3 cannot be inferred from E2 programming logs.

**Curated vs from-scratch:** **IDE example rows** prove the gallery asset. **From-scratch rows** use `meta.projectKind: 'blank'` and **no** `sourceExampleId`—see `docs/release/proof/from-scratch-authoring-cert-2026-04-23.md` and the authoring checklist.

---

## Standard Vivado invocation (this repo)

**Batch full build (preferred for certification):**

```powershell
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
& $Vivado -mode batch -source scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out/vivado-cert/vivado_batch.log -tclargs "<path\to\slug\slug.xpr>" 4
```

**Import-only Tcl** (creates a parallel project under `<name>_vivado/` — used by flat kit rehearsal):

```powershell
vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log
```

**Produce a golden Open Project tree for rehearsal:**

```powershell
pnpm exec tsx scripts/vivado-cert-export-open-project.ts
```

**Current E1 harness (no bitstream/board claim):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode EnvCheck
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode DryRun
powershell -ExecutionPolicy Bypass -File scripts/vivado/redbyte-e1-certify.ps1 -Mode Certify
```

See `docs/product/RED_BYTE_VIVADO_E1_CERTIFICATION_PROTOCOL.md` and `docs/product/RED_BYTE_VIVADO_E1_RESULT_TEMPLATE.md`. This harness records E1 import/compile/testbench/synthesis proof or a blocker such as `BLOCKED_NO_VIVADO`; it does not certify bitstream generation, programming, or observed board behavior.

**Blank-shaped from-scratch fixtures (certification, not gallery examples):**

```powershell
pnpm lab:vivado:cert:from-scratch fs-comb-switch-and-basys3
pnpm lab:vivado:cert:from-scratch fs-seq-two-bit-counter-basys3
```

---

## Student-critical matrix (fill with evidence)

**RC1 freeze / bench honesty:** `docs/RC1_STUDENT_RELEASE_FREEZE.md`  
**Evidence logs:** `docs/release/proof/student-release-readiness-2026-04-23.md` (E1), `docs/release/proof/rc1-bench-closeout-2026-04-23.md` (E2/E3)

| Project / fixture | Category | L0 | E0 | E1 | E2 | E3 | Certified for class? | Notes / limits |
|-------------------|----------|----|----|----|----|----|----------------------|----------------|
| IDE `half-adder` | Combinational / adder | yes | yes | **yes** (2026-05-05 bench) | **yes** (2026-05-05 bench) | pending | **E1+E2 proven; E3 open** | Multi-output combinational sanity row. Vivado succeeds with first-run project warnings plus combinational no-clock timing/power warnings; see `docs/release/vivado-basys3-bench-intelligence-2026-05-05.md`. |
| `golden-basys3-switch-and` | Combinational | yes | yes | **yes** (refreshed controlled bench 2026-05-05) | **yes** (refreshed controlled bench 2026-05-05) | pending | **E1+E2 proven; E3 still open** | Real export blocker fixed before recertification. Controlled pack `.redbyte/bench/runs/20260505-222402/` confirms Vivado build/bitstream/program success and classifies no-clock combinational warnings; see `docs/release/vivado-basys3-bench-intelligence-2026-05-05.md`. |
| IDE `signal-tour` | Combinational / map tour | yes | yes | **yes** (refreshed controlled bench 2026-05-05) | **yes** (refreshed controlled bench 2026-05-05) | **yes** | **yes for this row** | User-confirmed board behavior on 2026-04-29; controlled 2026-05-05 pack refreshed E1/E2 only and did **not** re-observe LEDs. Vivado emits optimized-empty-top/no-clock warnings that RedByte should explain. |
| IDE `two-bit-counter` | Sequential (CLK100MHZ/W5 + DFF) | yes | yes | **yes** (refreshed controlled bench 2026-05-05; timing constraints met) | **yes** (refreshed controlled bench 2026-05-05; `xc7a35t_0`) | *pending TA sign-off* | **E1+E2 proven on live bench** | **IO:** SW0=enable, BTNC=sync RST, LD0/1=count (100 MHz -> LED blur). Controlled pack confirms constrained Vivado timing and programming; E3 still requires physical observation. |
| **From-scratch** `fs-comb-switch-and-basys3` | Combinational (blank save) | yes | yes | **yes** (`vivado_batch_fs_comb_from_scratch.log`) | **yes** (`vivado_program_fs_comb_from_scratch.log`) | *checklist* | **Authoring path** | SW(0)∧SW(1)→LED; alias pins. Checklist: `docs/release/from-scratch-basys3-authoring-checklist.md` |
| **From-scratch** `fs-seq-two-bit-counter-basys3` | Sequential (blank save) | yes | yes | **yes** (`vivado_batch_fs_seq_from_scratch.log`) | **yes** (`vivado_program_fs_seq_from_scratch.log`) | *checklist* | **Authoring path** | Same IO story as IDE counter row; gate-level twin without example id. |
| Custom `fs-custom-four-switch-led` | Multi-output (blank save) | yes | yes | **yes** (`out/vivado-cert/custom-projects/fs-custom-four-switch-led/vivado_batch.log`) | pending | pending | **E1 proven; board proof pending** | Recreates signal-tour as a blank-shaped custom project. Vivado warns about an "empty top module" after optimization, but bitstream generation succeeds. |
| Custom `fs-custom-mixed-gate-chain` | Mixed combinational (blank save) | yes | yes | **yes** (`out/vivado-cert/custom-projects/fs-custom-mixed-gate-chain/vivado_batch.log`; refreshed `out/vivado-cert/custom-projects/b1-mixed/vivado_batch.log`) | pending | pending | **E1 proven; board proof pending** | `(SW0 AND SW1) OR (SW2 XOR SW3) -> LD0` via custom project harness. Batch 1 also found that long dated case IDs can exceed practical Windows/Vivado run-path limits. |
| Custom `fs-comb-switch-and` | Basic combinational (blank save) | yes | yes | **yes** (`out/vivado-cert/custom-projects/fs-comb-switch-and/vivado_batch.log`) | pending | pending | **E1 proven; board proof pending** | Harness replay of the blank-shaped AND row. |
| Custom `fs-seq-two-bit-counter` | Sequential (blank save) | yes | yes | **yes** (`out/vivado-cert/custom-projects/fs-seq-two-bit-counter/vivado_batch.log`; refreshed `out/vivado-cert/custom-projects/b1-counter/vivado_batch.log`) | pending | pending | **E1 proven; board proof pending** | Harness replay of the blank-shaped counter row; includes `CLK100MHZ` / W5 clock constraint path. |
| Golden ALU classroom export | Combinational / MUX | yes | repo gates | *pending* | | | | `pnpm classroom:golden-basys3-alu` |
| Lab 4 smoke (`classroom:smoke:lab4`) | ALU slice | yes | repo gates | *pending* | | | | |
| `lab8-vivado-export.ts` security lock | Sequential FSM | yes | repo + script | *pending* | | | | Manual switch clock policy per prior proof |
| `22_lab7-sync-counter-starter-basys3.json` | Counter scaffold | *file example* | *pending* | *pending* | | | | Scaffold may be incomplete — verify before class |
| `23_lab8-fsm-lock-starter-basys3.json` | FSM + IO | yes | *pending* | *pending* | | | **No blanket claim** | High stacking risk |
| Seven-segment heavy labs | Multi-IO | partial | *pending* | *pending* | | | Partial | Bus / mapping limits |
| IDE Vivado project-folder clock fixture | Test-only | — | tests | — | — | — | N/A | Handoff contract only |

**Legend:** Check boxes in Git with **commit hash + log path** (e.g. `docs/release/proof/vivado-basys3-cert-run-*.md`).

---

## Automation vs manual

| Outcome | Automate? | How |
|---------|-------------|-----|
| Synth / impl / bitstream complete | Yes (batch Tcl) | Exit code + log; optional parse of `STATUS` |
| Timing-clean / max frequency | Partial | Review timing summary; do not hide “timing not met” if present |
| Hardware Manager program | Sometimes | Tcl when cable + target stable; else GUI |
| LED / switch / 7-seg behavior | Manual / hybrid | Written test procedure per row |

---

## Likely failure classes (triage order)

1. **Port / XDC mismatch** — VHDL port names vs `get_ports` in XDC (caught late in synth/DRC).
2. **Primary clock** — Missing or wrong `create_clock` on W5 when board clock is used; **sequential designs must be rehearsed with real `CLK100MHZ` mapping**.
3. **Derived / generated clocks** — RedByte now **blocks** unsupported `create_generated_clock` / `derive_*` / `set_clock_groups` in source constraints (honest fence).
4. **Synth** — Unsupported constructs, bad top, black boxes.
5. **Impl / timing** — 100 MHz + long paths; may need student simplification.
6. **Bitstream** — Rare if impl reaches `write_bitstream Complete!`.
7. **Programming** — Drivers, cable, wrong bit path, `hw_server` connectivity on remote benches.

---

## Honest fencing (safe claims today)

From `docs/lab-day-vivado-basys3-readiness.md` (aligned):

- **Strong:** Combinational + `DFlipFlop` single-clock rising-edge path with supported Basys3 IO aliases when **E1** is proven per project.
- **Partial:** Hierarchy reuse, bus-native authoring, generic non-manifest import, complex FSM + counter + 7-seg stacks.
- **Blocked / call out:** Derived-clock timing intent that RedByte refuses to silently drop; vector top ports on some HDL import paths.

---

## Related proof docs

- **`docs/STUDENT_RELEASE_READINESS.md`** — **canonical** “what students can use now” for TAs.
- `docs/release/proof/student-release-readiness-2026-04-23.md` — E1 matrix + E2 attempt for this slice.
- `docs/release/proof/two-bit-counter-basys3-e2e-2026-04-23.md` — `two-bit-counter` Basys3 IO truth + E1 rebuild + E2 attempt.
- `docs/release/proof/from-scratch-authoring-cert-2026-04-23.md` — blank-shaped projects: export + E1 + E2 on bench.
- `docs/release/from-scratch-basys3-authoring-checklist.md` — TA procedure mirroring student authoring.
- `docs/release/proof/security-lock-complex-round-trip-audit-2026-04-23.md` — multi-file final-project import tier (not E1 turnkey export).
- `docs/release/proof/vivado-export-fidelity-board-rehearsal-2026-04-23.md` — E0 / handoff slice (no full compile in that environment).
- `docs/lab-day-vivado-basys3-readiness.md` — instructor-facing lab-day bar.

---

## Certification plan audit (2026-04-23)

### 1. Best export fixtures for real certification

- **Combinational:** `golden-basys3-switch-and` (minimal), golden ALU, Lab 4 smoke project.
- **Sequential:** IDE project-folder clock fixture (W5 + `create_clock` in tests), Lab 7 counter starter, Lab 8 export script (`lab8-vivado-export.ts`).
- **Stress / class realism:** `23_lab8-fsm-lock-starter-basys3.json`, seven-segment examples — certify only after simpler rows pass.

### 2. Minimum student-critical matrix

- SW → LED (combinational).
- Small multi-gate combinational (adder slice or ALU golden).
- **One** `CLK100MHZ` + DFF sequential (counter or single FF).
- Optional second row: sequence detector / lock **after** the counter row passes E1.

### 3. Existing rehearsal scripts

- `scripts/lab8-vivado-export.ts` — Lab 8 kit + flat ZIP.
- `scripts/classroom-golden-basys3.ts`, `classroom-golden-basys3-alu.ts` — deterministic flat exports.
- `scripts/classroom-smoke-lab4.ts`, `classroom-smoke-labs-5-8.ts` — classroom smoke.
- `tools/fixtures/basys3/build_vivado.tcl` — UART smoke **not** student RedByte export.
- **New:** `scripts/vivado-cert-export-open-project.ts`, `scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl`.

### 4. Standard Vivado path on this machine

- `C:\Xilinx\Vivado\2024.2\bin\vivado.bat` (verified `-version` on lab host).

### 5. Board programming path

- **Local:** Hardware Manager GUI or batch Tcl (`open_hw_manager` / `program_hw_devices`).
- **Remote:** `hw_server` on machine attached to cable + `connect_hw_server` from client Vivado — document host/port in lab runbook.

### 6. Automated vs manual checks

- **Auto:** E1 via batch Tcl; log scrape for `synth_design Complete!` / `write_bitstream Complete!`; `.bit` existence.
- **Manual:** E2/E3 (behavior), timing signoff judgment, “is this good enough for a novice lab?”

### 7–9. Failure classes / safe certification / official lab path

- Covered in tables above; official path = **this doc** + `docs/lab-day-vivado-basys3-readiness.md` + `scripts/vivado/README.md`.

### 10. Representing “certified” in repo

- **This matrix** (human + commit history).
- **Proof markdown** under `docs/release/proof/` with log excerpts and `.bit` path.
- **Optional follow-up:** small JSON status file + test that schema is valid (not required for first slice).
