---
doc_status: current
last_validated: 2026-04-29
owner: Connor Angiel
used_by_claude: true
role: RC1 release freeze — honest posture
---

# RedByte RC1 — student release freeze (honest posture)

**Freeze date:** 2026-04-23  
**Role:** single **RC1** instructor/TA truth for “what we ship to students this cycle.”  
**Supersedes for release wording:** general marketing or stale README claims — this doc + `docs/STUDENT_RELEASE_READINESS.md` win on conflicts.

---

## RC1 scope

| Area | Status |
|------|--------|
| IDE mapping / verify / hardware / export handoff (prior slices) | **Frozen** — fix only regressions or bench blockers. |
| Tier model (L0 / E0 / E1 / E2 / E3) | **Frozen** vocabulary — see `docs/STUDENT_RELEASE_READINESS.md`. |
| **E1** (real Vivado bitstream) for selected rows | **Certified** — logs in `out/vivado-cert/vivado_batch_*.log` (see proof bundle). |
| **E2** (program device) | **Update:** `signal-tour` and `golden-basys3-switch-and` both programmed successfully on the live bench (2026-04-29). `two-bit-counter` E2 remains proven from 2026-04-23. |
| **E3** (observed behavior) | `signal-tour` is now behavior-certified on the live bench. `golden-basys3-switch-and` still needs the four-case manual confirmation after its fixture blocker fix. `two-bit-counter` still needs TA sign-off. |

---

## What students can safely use **now** (RC1 claim)

**Safe (tool path):** Students can use RedByte for the **supported logic subset** (`docs/lab-day-vivado-basys3-readiness.md`), complete Verify + Map Pins, export an Open Project ZIP, and — on a lab PC with Vivado 2024.2 — run synthesis through **bitstream** for the **E1-certified** designs below.

**Hardware proof status:** The bench is now active again. `signal-tour` has full **E2 + E3** proof. `golden-basys3-switch-and` has **E1 + E2** and a real export blocker fix, but its final four-case E3 note is still open. `two-bit-counter` still has **E1 + E2** with E3 pending TA sign-off.

### E1-certified rows (Vivado 2024.2 / `xc7a35tcpg236-1`)

| Row | Evidence |
|-----|----------|
| Classroom `golden-basys3-switch-and` | `out/vivado-cert/vivado_batch_golden_and_2026-04-29.log` -> `impl_1/top.bit`; program log `out/vivado-cert/vivado_program_golden_and_2026-04-29.log` |
| IDE `signal-tour` | `out/vivado-cert/vivado_batch_signal_tour_2026-04-29.log`; program log `out/vivado-cert/vivado_program_signal_tour_2026-04-29.log` |
| IDE `two-bit-counter` (CLK100MHZ→W5 + sequential constraints) | `out/vivado-cert/vivado_batch_two_bit_counter_e2e.log` (supersedes earlier `vivado_batch_two_bit_counter.log` for post-catalog export) |

### E3 procedures (when E2 succeeds — TA checklist)

1. **golden-basys3-switch-and:** LD0 lights **only** when SW0 **and** SW1 are high (others off). This checklist is still pending explicit sign-off after the 2026-04-29 fixture fix and reprogram.
2. **signal-tour:** SW0..SW3 each drive LD0..LD3 respectively. This row is now satisfied by live bench confirmation on 2026-04-29.
3. **two-bit-counter:** **SW0 high** — counter advances on **100 MHz board clock** (LD0 = LSB, LD1 = MSB; LEDs may look steady/blurred at speed). **SW0 low** — hold. **BTNC** — synchronous reset to **00**. Confirm against Verify compare vectors in IDE. Optional: slow the clock in a student lab variant if observing individual states is required.

---

## RC1 “safe with caution”

- Any **gallery starter**, **lab starter**, or **`examples/*.json`** file **not** listed in `docs/release/vivado-basys3-certification-matrix.md` with **E1 + dated log** → treat as **not RC1 tool-certified**.
- **Lab 8 / seven-segment / hierarchy-heavy** paths → **fenced** in lab-day doc; not RC1 turnkey.

---

## RC1 “not yet safe / fenced”

- Declaring **“lab ready”** or **“board certified”** for the whole product.
- Assigning homework that assumes **every** starter completes E1 without checking the matrix.

---

## TA closeout checklist (complete RC1 on a real bench)

1. `pnpm lab:vivado:hw-probe` (or run `hw_probe.tcl` per `scripts/vivado/README.md`) → must exit **0**.
2. Rebuild or reuse `impl_1/top.bit` for the row under test.
3. `redbyte_program_device.tcl` with that `.bit` → exit **0**, archive log under `out/vivado-cert/`.
4. Run any still-open **E3** checklist above; update `docs/release/vivado-basys3-certification-matrix.md` and this doc with dates.

---

## Proof index

| Artifact | Purpose |
|----------|---------|
| `docs/release/proof/rc1-bench-closeout-2026-04-23.md` | This slice: E2 attempt, probe, RC1 wording |
| `docs/release/proof/two-bit-counter-basys3-e2e-2026-04-23.md` | Sequential example: catalog + E1 + **E2 success log** (live bench) |
| `out/vivado-cert/vivado_program_two_bit_counter_e2_2026-04-23.log` | `two-bit-counter` **E2** — `program_hw_devices` SUCCESS |
| `docs/release/proof/student-release-readiness-2026-04-23.md` | Earlier E1 matrix work |
| `out/vivado-cert/hw_probe.log` | Latest `hw_probe` run (overwritten by `lab:vivado:hw-probe`) |
