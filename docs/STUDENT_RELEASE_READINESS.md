---
doc_status: current
last_validated: 2026-07-22
owner: Connor Angiel
used_by_claude: true
role: canonical TA / instructor release surface
---

# Student release readiness (canonical TA / instructor surface)

**Last updated:** 2026-07-22
**Audience:** instructors, TAs, release owners  
**RC1 freeze (single release posture):** [`RC1_STUDENT_RELEASE_FREEZE.md`](./RC1_STUDENT_RELEASE_FREEZE.md)  
**Pairing docs:** `docs/course/STUDENT_QUICKSTART.md`, `docs/course/INSTRUCTOR_QUICKSTART.md`, `docs/course/TA_TROUBLESHOOTING_GUIDE.md`, `docs/lab-day-vivado-basys3-readiness.md` (lab-day bar), `docs/release/vivado-basys3-certification-matrix.md` (full matrix + tiers), `docs/product/RED_BYTE_VIVADO_E1_CERTIFICATION_PROTOCOL.md` (current E1 harness), `docs/product/RED_BYTE_VIVADO_E1_RESULT_TEMPLATE.md` (E1 closeout template), `docs/release/from-scratch-basys3-authoring-checklist.md` (blank-project workflow), `docs/release/proof/security-lock-complex-round-trip-audit-2026-04-23.md` (final-project / multi-file import tier)

This document is the **single place** to learn what students can **actually** rely on today: certified vs export-only vs fenced, and how that was proven.

---

## 1. Certification tiers (must not be conflated)

| Tier | Shorthand | Meaning |
|------|-----------|---------|
| **L0** | RedByte-valid | Design, Verify, Hardware, and workflow authorities behave; project loads and saves. |
| **E0** | Export-valid | Open Project ZIP / flat kit is internally consistent (`top.vhd`, `top.xdc`, `.xpr`, Tcl, manifest). Proven by repo tests + gates — **not** Vivado. |
| **E1** | Vivado-build-certified | Real **Vivado** `synth_1` → `impl_1` → `write_bitstream` completes (batch log). |
| **E2** | Board-program-certified | `.bit` programs via Hardware Manager or `scripts/vivado/redbyte_program_device.tcl`. |
| **E3** | Behavior-certified | Documented observation matches an agreed procedure (switches/LEDs/clock). |

**Student-safe claim for hardware labs requires at least E1 + E2 + E3** for the specific project class you assign. **E0 alone is never enough.**

**Current harness note (2026-07-02):** `docs/product/RED_BYTE_VIVADO_E1_CERTIFICATION_PROTOCOL.md` defines the current E1 sprint harness as import/open project, VHDL compile readiness, behavioral simulation/testbench when present, and synthesis, with optional route-only implementation dry run. It deliberately does not claim bitstream generation or board observation. Older rows in this document may contain stronger legacy full-build evidence; do not use the new harness to upgrade any row without a real Vivado run.

**Current Unified Workbench v3 RC source note (2026-07-25):** integrated pre-doc commit `0788044cbdf2699520d90a3428f2e5034dc73cab` unifies the five-stage workspace, browser-local named Verify documents with shared manual/Auto sequential execution authority, semantic Map Pins projection, exact package/manifest agreement, trusted-versus-draft Export receipt authority, and manifest-first Import recovery with exact scalar/vector-bit identity. The touched authority matrix passes 20/20 files and 258/258 tests under Node 20.19.0 / pnpm 10.24.0; typecheck, unified build, and the focused sequential, mapping/package, custom-clock ZIP, preservation, Verify-repair, Export-trust, Import, ZIP-recovery, and wire-interaction gates pass. This is still Browser-E0 source evidence only: final reconstructed exact-SHA certification and human release disposition remain pending, and no E1/E2/E3 row below changes because of it.

**RC semantic boundary:** A named scenario's policy remains browser-local and outside portable `RBProject`, but the shared materialized execution vectors and resolved clock/schedule projection may change generated `testbench.vhd`, package bytes, Export freshness, and receipt authority. Auto `runCycles` and automatic reset behavior are byte-bearing through that materialization. Auto board-clock and manual/custom testbench structures are therefore distinct Browser-E0/software-artifact claims. They add no Vivado, bitstream, programming, physical-board, E1, E2, or E3 credit to any row below. `ide:gate:sequential-testbench-authority` and `ide:gate:mapping-preview-package-agreement` remain separate required invocations outside the uninterrupted 72-step classroom aggregate.

**RC exclusions and known debt:** Guided 4-bit and Mapping Assistant v2 are outside this candidate. Design reaches 63.1% circuit-grid occupancy at 1366px and 65.0% at 1440px against a 62% release floor; the strategic 70% laptop target remains unmet. Neither limitation may be hidden by a general “release ready” claim.

---

## 2. What students can rely on **right now** (2026-04-23)

Proven on this lab machine unless noted:

| Starter / artifact | L0 | E0 | E1 | E2 | E3 | Student note |
|--------------------|----|----|----|----|----|--------------|
| IDE `half-adder` (2 SW -> SUM/CARRY LEDs) | yes | yes | **yes** (2026-05-05 bench) | **yes** (2026-05-05 bench) | pending | Multi-output combinational row added by bench-intelligence run; not student-safe hardware proof until E3 observation is recorded. |
| Classroom golden `golden-basys3-switch-and` (SW0 AND SW1 -> LED0) | yes | yes | **yes** (refreshed controlled bench 2026-05-05) | **yes** (refreshed controlled bench 2026-05-05) | pending | Fixture blocker fixed; controlled pack reprogrammed the board and left the four-case SW0/SW1/LD0 observation as manual E3. |
| IDE `signal-tour` (4 SW -> 4 LED) | yes | yes | **yes** (refreshed controlled bench 2026-05-05) | **yes** (refreshed controlled bench 2026-05-05) | **yes** | User-confirmed bench behavior on 2026-04-29; the 2026-05-05 controlled pack refreshed E1/E2 only and did not re-observe physical LEDs. |
| IDE `two-bit-counter` (Basys3 `CLK100MHZ`/W5, SW0, BTNC, LD0-1) | yes | yes | **yes** (refreshed controlled bench 2026-05-05; timing constraints met) | **yes** (refreshed controlled bench 2026-05-05; `xc7a35t_0`) | *pending* - TA runs section 3 checklist on hardware | Controlled pack confirms constrained Vivado timing and programming. Verify now auto-runs `CLK100MHZ` in the IDE and exported `testbench.vhd` drives the board clock automatically; E3 still requires manual observation. |

### 2b. From-scratch authoring (blank project — not gallery load)

| Certification twin | Meaning | E1 / E2 evidence (2026-04-23 bench) |
|--------------------|---------|-------------------------------------|
| `fs-comb-switch-and-basys3` | Blank-shaped save: SW0∧SW1→LD0 | `vivado_batch_fs_comb_from_scratch.log`, `vivado_program_fs_comb_from_scratch.log` |
| `fs-seq-two-bit-counter-basys3` | Blank-shaped save: 2-bit counter + CLK100MHZ | `vivado_batch_fs_seq_from_scratch.log`, `vivado_program_fs_seq_from_scratch.log` |
| `fs-custom-four-switch-led` | Blank-shaped save: SW0..SW3 each drive LD0..LD3 | `out/vivado-cert/custom-projects/fs-custom-four-switch-led/vivado_batch.log` |
| `fs-custom-mixed-gate-chain` | Blank-shaped save: `(SW0 AND SW1) OR (SW2 XOR SW3) -> LD0` | `out/vivado-cert/custom-projects/fs-custom-mixed-gate-chain/vivado_batch.log`; refreshed Batch 1 proof: `out/vivado-cert/custom-projects/b1-mixed/vivado_batch.log` |
| `fs-seq-two-bit-counter-basys3` | Blank-shaped save: 2-bit counter + `CLK100MHZ` | Refreshed Batch 1 proof: `out/vivado-cert/custom-projects/b1-counter/vivado_batch.log` |

**Reproduce export:** `pnpm lab:vivado:cert:from-scratch <fixture-id>` for the original blank twins, or `pnpm lab:vivado:cert:custom -- --case <case-id> --project <path.rbproj>` for custom blank-shaped projects. See `docs/release/proof/custom-projects-2026-04-29.md`. **Student procedure:** checklist doc §A–B.

**Batch 1 browser proof caveat (2026-04-30):** the real Vivado E1 rows above are current, but several browser rehearsal gates still encode old Observe/Compare and Project-owned mapping assumptions. Do not treat those gate failures as hardware proof failures; track them through `docs/release/product-hardening-ticket-2026-04-30-browser-rehearsal-gates.md`.

**Honest fences (not blanket-certified):**

- **Gannon Pilot Labs 1-5** are a supervised browser-E0 pilot path unless a specific row below is refreshed with E1/E2/E3 evidence. Students may submit the RedByte/Vivado ZIP as package-generation proof, but that ZIP does not prove Vivado build, bitstream generation, board programming, or observed board behavior.

- **Imported sim-only Clock components** (`config.role === "sim"`) are **not** board-ready clock proof. They are import-only in the browser workflow and must be replaced with the `CLK100MHZ` Board Resource before trusted auto Verify or Basys3 Export.

- **Lab starters** (`labStarters.ts`) and file-backed examples under `packages/rb-apps/src/examples/*.json` are **not** all run through E1 in this slice — treat as **L0/E0 until a row exists** in the matrix with a log path.
- **Lab 8 FSM lock**, **seven-segment-heavy**, **hierarchical/bus-native** work: see `docs/lab-day-vivado-basys3-readiness.md` — **partial or not a same-day promise**.
- **Design IDE gates:** some layout gates (e.g. design workbench offset) have failed in past runs; they do **not** block export/Vivado certification but may affect “screenshot release” polish — track separately.

---

## 3. Reproduce certification (lab machine)

**Combinational golden (classroom fixture):**

```powershell
pnpm exec tsx scripts/vivado-cert-export-open-project.ts
$Vivado = "C:\Xilinx\Vivado\2024.2\bin\vivado.bat"
$xpr = Resolve-Path "out\vivado-cert\golden-basys3-switch-and-unpacked\golden-basys3-switch-and\golden-basys3-switch-and.xpr"
& $Vivado -mode batch -source scripts\vivado\redbyte_batch_synth_impl_bitstream.tcl -notrace -nojournal -log out\vivado-cert\vivado_batch.log -tclargs $xpr 4
```

**Any IDE example / lab starter id:**

```powershell
pnpm exec tsx scripts/vivado-cert-export-ide-example.ts signal-tour
# then point batch Tcl at the printed .xpr under out\vivado-cert\examples\<id>\unpacked\
```

**Program device (after E1):**

```powershell
$Bit = "…\impl_1\top.bit"
& $Vivado -mode batch -source scripts\vivado\redbyte_program_device.tcl -notrace -nojournal -log out\vivado-cert\vivado_program.log -tclargs $Bit
```

Full command reference: `scripts/vivado/README.md`.

---

## 4. Proof artifacts (evidence, not vibes)

| Evidence | Path |
|----------|------|
| Bench evidence classifier (2026-05-06): `rb:bench:evidence:*` now classifies E0/E1/E2/E3 and writes per-run `evidence-classification.{md,json}`. Controlled run `20260505-222402` classifies `golden-basys3-switch-and`, `signal-tour`, and `two-bit-counter` as E2 because board observation remains uncertain/manual. | `docs/release/redbyte-bench-evidence-model.md`; `scripts/rb-bench-evidence.mjs`; `.redbyte/bench/runs/20260505-222402/evidence-classification.md` |
| Vivado/Basys3 bench intelligence (2026-05-05): four-row broad pass plus controlled three-target pack (`golden`, `two-bit-counter`, `signal-tour`) exported, built, bitstreamed, programmed, and warning-classified; E3 remains manual except prior `signal-tour` proof | `docs/release/vivado-basys3-bench-intelligence-2026-05-05.md`; generated raw pack `.redbyte/bench/runs/20260505-222402/` |
| RC1 bench closeout (E2/E3 honesty + hw_probe) | `docs/release/proof/rc1-bench-closeout-2026-04-23.md` |
| `signal-tour` E2/E3 closeout | `docs/release/proof/signal-tour-basys3-e2e-2026-04-29.md` |
| `golden-basys3-switch-and` blocker fix + fresh E1/E2 | `docs/release/proof/golden-basys3-switch-and-e2e-2026-04-29.md` |
| Custom-project harness + E1 batch | `docs/release/proof/custom-projects-2026-04-29.md`; `docs/release/custom-project-vivado-hardening-2026-04-29.md` |
| Two-bit counter sequential row (E1 + **E2** + E3 checklist) | `docs/release/proof/two-bit-counter-basys3-e2e-2026-04-23.md`; `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log` |
| From-scratch authoring (blank saves → Vivado → board) | `docs/release/proof/from-scratch-authoring-cert-2026-04-23.md`; `docs/release/from-scratch-basys3-authoring-checklist.md` |
| Earlier E1 matrix slice | `docs/release/proof/student-release-readiness-2026-04-23.md` |
| Working matrix + triage | `docs/release/vivado-basys3-certification-matrix.md` |
| Prior export-fidelity slice | `docs/release/proof/vivado-export-fidelity-board-rehearsal-2026-04-23.md` |

---

## 5. Exact claim after this slice

**Safe to say:** For **combinational** and **sequential** reference rows **and** for **blank-shaped** certification fixtures (`fs-comb-*`, `fs-seq-*`), RedByte-generated Open Project exports complete **real Vivado synthesis, implementation, and bitstream generation** on Vivado 2024.2 for Basys3 (`xc7a35tcpg236-1`), with logs under `out/vivado-cert/`. In the IDE, Basys3 board-clocked Verify runs now auto-toggle `CLK100MHZ` / `W5` by default, and exported `testbench.vhd` includes a matching free-running board-clock process for those sequential rows. **From-scratch** student authoring is **checklist-aligned** with those fixtures; arbitrary student complexity remains fenced.

**Not yet safe to say:** “Every starter in the gallery is board-certified” or “Lab 8 / SSD-heavy labs are turnkey” without filling matrix rows and E2/E3 proof.

**Board programming:** On the **original RC1 automation host**, `hw_probe` reported no targets (`out/vivado-cert/hw_probe_rc1.log`). On a **live lab bench** (2026-04-23), `hw_probe` exit **0** and `redbyte_program_device.tcl` completed **SUCCESS** for IDE `two-bit-counter` — log: `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log`. Other matrix rows still need E2 logs on a connected bench.

---

## 6. Student-ready minimum for next class

1. Assign only projects that have **E1** (and ideally **E3**) rows in `docs/release/vivado-basys3-certification-matrix.md`.
2. Require **two real proofs** before advertising “lab ready”: one combinational, one **CLK100MHZ/W5** sequential — `two-bit-counter` has **E1 + E2** on a bench where `pnpm lab:vivado:hw-probe` exits **0**; add **E3** (LED/switch observation) per RC1 freeze before claiming full hardware trust.
3. Keep using `docs/lab-day-vivado-basys3-readiness.md` for supported **logic subset** and **fenced** complexity.
