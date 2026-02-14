# V1 Release Checklist

This checklist is the classroom-ready release gate for v1.

## Required Commands

Run from repo root:

1. `pnpm v1:rehearse`
2. `pnpm rc:check`
3. `pnpm v1:verify -- <path-to-submission-zip>`

All must exit with code `0`.

## Rehearsal Evidence

- [ ] Completed [docs/rehearsal/student-setup.md](../rehearsal/student-setup.md) checklist
- [ ] At least one doctor report JSON exported
- [ ] At least one student submission bundle exported
- [ ] Any failures logged in [docs/rehearsal/failure-log.md](../rehearsal/failure-log.md)
- [ ] Failure tickets opened from [docs/rehearsal/failure-ticket-template.md](../rehearsal/failure-ticket-template.md) where needed

## Product Gates

- [ ] Student mode remains fail-closed for instructor-only surfaces
- [ ] First Run Wizard path completes through `doctor_export`
- [ ] Verify/package/export flow is understandable and deterministic
- [ ] Startup console banner prints build SHA, mode, and toolchain/board status

## Sign-Off

- Release owner:
- Date:
- Commit SHA:
- Notes:
