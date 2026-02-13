# Classroom Release Candidate v1 Playbook

## Before class (TA)
- Run `pnpm classroom:rc` once to verify install + build + preview path.
- Open `http://127.0.0.1:4173/os/` and confirm Home loads in student mode.
- Confirm TA escape hatch works at `http://127.0.0.1:4173/os/?ta=1`.
- If distributing starter content, prepare packs using [instructor-pack.md](./instructor-pack.md).

## Day 1 (student onboarding)
- Students open Home and launch **Lab 1 starter** from Lab Starters.
- Students complete Build + Simulate steps first; hardware is optional.
- Student-facing fallback policy: if bridge/toolchain is unavailable, proceed in simulation and submit bundle evidence.
- Students generate submission from Submit tab and upload the `.zip` bundle.

## Day 2 (reinforcement)
- Repeat Lab Workspace flow with a new starter.
- Use checklist and issue cards in Lab Coach to resolve blockers before submit.
- TA samples bundles in Submission Inspector for deterministic artifact checks.

## Lab day routine (TA + grading)
- Start in student mode by default.
- Enable TA mode only for grading and diagnostics actions.
- Collect bundle files (`rb-submission-*.zip`) from LMS or shared folder.
- Grade quickly via Submission Inspector summary (verdict, lab id, timestamp, toolchain).

## If something breaks
- Follow diagnostics export flow in [DIAGNOSTICS_EXPORT_INSTRUCTIONS.md](./classroom/DIAGNOSTICS_EXPORT_INSTRUCTIONS.md).
- Use lockdown controls in [TA_LOCKDOWN_INSTRUCTIONS.md](./classroom/TA_LOCKDOWN_INSTRUCTIONS.md).
