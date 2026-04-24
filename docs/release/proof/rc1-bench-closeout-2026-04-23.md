# Proof: RC1 bench closeout — E2/E3 honesty + programming path hardening (2026-04-23)

## 1. Problem

RC1 requires a **honest** split between **E1 (tool)** and **E2/E3 (bench)**. The prior slice documented an E2 **attempt** that saw no target; this slice must **close** the automation story (probe + robust Tcl) and **freeze** instructor-facing RC1 claims without pretending E2 succeeded.

## 2. Root cause

**No Basys3 JTAG target** is visible to `hw_server` on the machine used for RC1 automation (`localhost:3121` — `Labtools 44-27` / `44-199`). This is **environment/hardware visibility**, not RedByte export logic. A secondary issue was brittle `get_hw_targets` usage without `refresh_hw_server` and `-of_objects` server handle.

## 3. Files changed

- `scripts/vivado/redbyte_program_device.tcl` — `refresh_hw_server`; `get_hw_targets -of_objects` first server; **`catch`** on `get_hw_targets` for clean exit 2; explicit `open_hw_target $tgt`.
- `scripts/vivado/hw_probe.tcl` — **new** — TA diagnostic without a `.bit`.
- `scripts/vivado/run-hw-probe.mjs` — **new** — launcher (`VIVADO_BAT` or default 2024.2 path).
- `scripts/vivado/README.md` — bench-check section.
- `docs/RC1_STUDENT_RELEASE_FREEZE.md` — **canonical RC1 posture** (E1 yes / E2 no on this bench / E3 blocked).
- `docs/STUDENT_RELEASE_READINESS.md` — RC1 link; E2 column truth; proof index.
- `docs/release/vivado-basys3-certification-matrix.md` — E2/E3 / RC1 column alignment.
- `package.json` — `lab:vivado:hw-probe`.
- `packages/rb-apps/src/__tests__/vivado-batch-build-script-contract.test.ts` — expects `refresh_hw_server` / `get_hw_servers`.
- `docs/DOC_INDEX.md` — RC1 freeze entry.

## 4. Release / readiness change

- **RC1 student claim:** RedByte + Vivado **E1 path is real** for three reference rows; **hardware programming and behavior are not certified** on the RC1 automation host until `hw_probe` passes elsewhere.
- **Single freeze doc:** `docs/RC1_STUDENT_RELEASE_FREEZE.md`.

## 5. Automated proof

```text
pnpm -w exec vitest run packages/rb-apps/src/__tests__/vivado-batch-build-script-contract.test.ts
pnpm -s build:unified
pnpm -s ide:gate:export-ready-contract
```

(Execute in workspace before merge.)

## 6. Real Vivado proof

Unchanged from prior slice: `vivado_batch_*.log` produce valid `top.bit` for golden, `signal-tour`, `two-bit-counter`.

## 7. Real board proof

| Step | Log | Result |
|------|-----|--------|
| `hw_probe.tcl` | `out/vivado-cert/hw_probe_rc1.log` | **FAIL exit 2** — no targets |
| `redbyte_program_device.tcl` (golden `.bit`) | `out/vivado-cert/vivado_program_golden_and_e2_retry.log` | **FAIL** — no targets after refresh |
| **E3 observation** | — | **Not run** (blocked on E2) |

**Connection path:** local `hw_server` (`connect_hw_server` default), not remote.

## 8. Remaining fenced classes

Unchanged: starters without E1 rows; Lab 8 / SSD-heavy; hierarchy promises — see `RC1_STUDENT_RELEASE_FREEZE.md`.

## 9. Exact RC1 student-ready claim

**Students may rely on RedByte for design → verify → map → export and on Vivado to reach a valid `.bit` for the three E1-listed reference designs.**  
**Students must not be told the product is “board certified” in RC1** until their **lab** machine records `lab:vivado:hw-probe` exit **0** plus programming + E3 notes in the certification matrix.
