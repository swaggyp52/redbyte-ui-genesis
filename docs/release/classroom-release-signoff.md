# Classroom Release Sign-Off Standard

This is the canonical release-readiness standard for classroom delivery.

## Single command

Run this from the repository root:

```bash
pnpm run classroom:signoff
```

A release is classroom-ready only when this command ends with:

- `FINAL VERDICT: CLASSROOM_READY`
- exit code `0`

Any other result means do not release.

## What the command enforces

1. Release hygiene
- Required signoff scripts are wired and not no-op stubs
- No merge-conflict markers in tracked files
- Clean working tree (`git status --short` must be empty)

2. Repository health
- `pnpm -s repo:status`

3. Student loop health
- `pnpm -s ide:gate:student-loop-contract`
- `pnpm -s ide:gate:verify-summary-contract`

4. Key handoff surfaces
- `pnpm -s ide:gate:export-ready-contract`
- `pnpm -s hw:dryrun-program-flow-gate`

5. Import onboarding health
- `pnpm -s ide:gate:import-actionable-targets-contract`
- `pnpm -s ide:gate:import-renders-schematic`

## Operator checklist

Before class release:

- [ ] Run `pnpm run classroom:signoff`
- [ ] Confirm every check prints `[PASS]`
- [ ] Confirm final line is `FINAL VERDICT: CLASSROOM_READY`
- [ ] Confirm command exits with code `0`
- [ ] Record date/time, branch, and commit hash in your release notes

## Development override

For local development only, you can run:

```bash
pnpm run classroom:signoff -- --allow-dirty
```

This keeps all checks visible while allowing non-clean working trees.
Do not use this mode for final classroom sign-off.
