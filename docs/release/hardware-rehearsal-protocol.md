# Hardware Rehearsal Protocol (Basys3)

Purpose: produce real hardware evidence for student-machine readiness.

## Preconditions

- Windows student-like profile (clean or reset state)
- Basys3 connected via known-good data USB cable
- Repo at tag `v1.0.0-next-lab-ready`

## Checklist

- [ ] Driver/toolchain detection succeeds
- [ ] Wizard `board_detect` succeeds
- [ ] Wizard `known_good_program` succeeds
- [ ] Wizard `sample_capture` succeeds
- [ ] Wizard `doctor_export` succeeds
- [ ] Studio export creates `.rb-lab.zip`
- [ ] `pnpm v1:verify -- <exported-bundle>` passes

## Exact Flow

1. `pnpm install`
2. `pnpm dev`
3. Run wizard exactly in order:
   - `bridge_check`
   - `board_detect`
   - `programmer_check`
   - `known_good_program`
   - `sample_capture`
   - `doctor_export`
   - `done`
4. Open Dashboard -> Studio.
5. Complete Build -> Simulate -> Hardware -> Submit/Export path.
6. Export student bundle.
7. Run `pnpm v1:verify -- <path-to-exported-bundle>`.

## Stop-and-Ticket Rule (Mandatory)

If any step fails:

1. Stop immediately.
2. Log failure in `docs/rehearsal/failure-log.md`.
3. Open a ticket from `docs/rehearsal/failure-ticket-template.md`.
4. Include exact step name, error text, and evidence paths.
5. Only then implement a bug fix; restart rehearsal from step 1.
