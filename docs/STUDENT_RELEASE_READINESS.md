# Student release readiness (canonical TA / instructor surface)

**Last updated:** 2026-04-23  
**Audience:** instructors, TAs, release owners  
**RC1 freeze (single release posture):** [`RC1_STUDENT_RELEASE_FREEZE.md`](./RC1_STUDENT_RELEASE_FREEZE.md)  
**Pairing docs:** `docs/lab-day-vivado-basys3-readiness.md` (lab-day bar), `docs/release/vivado-basys3-certification-matrix.md` (full matrix + tiers), `docs/release/from-scratch-basys3-authoring-checklist.md` (blank-project workflow), `docs/release/proof/security-lock-complex-round-trip-audit-2026-04-23.md` (final-project / multi-file import tier)

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

---

## 2. What students can rely on **right now** (2026-04-23)

Proven on this lab machine unless noted:

| Starter / artifact | L0 | E0 | E1 | E2 | E3 | Student note |
|--------------------|----|----|----|----|----|--------------|
| Classroom golden `golden-basys3-switch-and` (SW0∧SW1→LED0) | yes | yes | **yes** | **no** — `hw_probe` / program: *no hw_target on RC1 bench* | pending | E2/E3 when `pnpm lab:vivado:hw-probe` exits 0 on your PC. |
| IDE `signal-tour` (4 SW → 4 LED) | yes | yes | **yes** | **no** (same bench) | pending | Same gate as above. |
| IDE `two-bit-counter` (Basys3 `CLK100MHZ`→W5, SW0, BTNC, LD0–1) | yes | yes | **yes** (`vivado_batch_two_bit_counter_e2e.log`) | **yes** (`vivado_program_two_bit_counter_e2_2026-04-23.log`; `hw_probe` exit 0 same session) | *pending* — TA runs §3 checklist on hardware | Proof + E2 detail: `docs/release/proof/two-bit-counter-basys3-e2e-2026-04-23.md`. |

### 2b. From-scratch authoring (blank project — not gallery load)

| Certification twin | Meaning | E1 / E2 evidence (2026-04-23 bench) |
|--------------------|---------|-------------------------------------|
| `fs-comb-switch-and-basys3` | Blank-shaped save: SW0∧SW1→LD0 | `vivado_batch_fs_comb_from_scratch.log`, `vivado_program_fs_comb_from_scratch.log` |
| `fs-seq-two-bit-counter-basys3` | Blank-shaped save: 2-bit counter + CLK100MHZ | `vivado_batch_fs_seq_from_scratch.log`, `vivado_program_fs_seq_from_scratch.log` |

**Reproduce export:** `pnpm lab:vivado:cert:from-scratch <fixture-id>` — see `docs/release/proof/from-scratch-authoring-cert-2026-04-23.md`. **Student procedure:** checklist doc §A–B.

**Honest fences (not blanket-certified):**

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
| RC1 bench closeout (E2/E3 honesty + hw_probe) | `docs/release/proof/rc1-bench-closeout-2026-04-23.md` |
| Two-bit counter sequential row (E1 + **E2** + E3 checklist) | `docs/release/proof/two-bit-counter-basys3-e2e-2026-04-23.md`; `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log` |
| From-scratch authoring (blank saves → Vivado → board) | `docs/release/proof/from-scratch-authoring-cert-2026-04-23.md`; `docs/release/from-scratch-basys3-authoring-checklist.md` |
| Earlier E1 matrix slice | `docs/release/proof/student-release-readiness-2026-04-23.md` |
| Working matrix + triage | `docs/release/vivado-basys3-certification-matrix.md` |
| Prior export-fidelity slice | `docs/release/proof/vivado-export-fidelity-board-rehearsal-2026-04-23.md` |

---

## 5. Exact claim after this slice

**Safe to say:** For **combinational** and **sequential** reference rows **and** for **blank-shaped** certification fixtures (`fs-comb-*`, `fs-seq-*`), RedByte-generated Open Project exports complete **real Vivado synthesis, implementation, and bitstream generation** on Vivado 2024.2 for Basys3 (`xc7a35tcpg236-1`), with logs under `out/vivado-cert/`. **From-scratch** student authoring is **checklist-aligned** with those fixtures; arbitrary student complexity remains fenced.

**Not yet safe to say:** “Every starter in the gallery is board-certified” or “Lab 8 / SSD-heavy labs are turnkey” without filling matrix rows and E2/E3 proof.

**Board programming:** On the **original RC1 automation host**, `hw_probe` reported no targets (`out/vivado-cert/hw_probe_rc1.log`). On a **live lab bench** (2026-04-23), `hw_probe` exit **0** and `redbyte_program_device.tcl` completed **SUCCESS** for IDE `two-bit-counter` — log: `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log`. Other matrix rows still need E2 logs on a connected bench.

---

## 6. Student-ready minimum for next class

1. Assign only projects that have **E1** (and ideally **E3**) rows in `docs/release/vivado-basys3-certification-matrix.md`.
2. Require **two real proofs** before advertising “lab ready”: one combinational, one **CLK100MHZ/W5** sequential — `two-bit-counter` has **E1 + E2** on a bench where `pnpm lab:vivado:hw-probe` exits **0**; add **E3** (LED/switch observation) per RC1 freeze before claiming full hardware trust.
3. Keep using `docs/lab-day-vivado-basys3-readiness.md` for supported **logic subset** and **fenced** complexity.
