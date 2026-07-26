# V1 Release Checklist

This checklist is the classroom-ready release gate for v1.

> **Unified Workbench v3 RC routing:** This legacy V1 checklist does not certify the Unified Workbench v3 RC. RC evidence is governed by `docs/handoff/GANNON_REDBYTE_V3_RC_README.md`, `docs/release/manual-assignment-qa-script.md`, the exact-tree acceptance manifest, same-tree human review, and the uninterrupted 72-step `classroom:gate`. The RC also requires separate invocations of `ide:gate:sequential-testbench-authority` and `ide:gate:mapping-preview-package-agreement`; the aggregate does not replace either standalone gate.

Related docs:

- [v1.0.0-next-lab-ready Release Handoff](./v1.0.0-next-lab-ready-handoff.md)
- [Hardware Rehearsal Protocol (Basys3)](./hardware-rehearsal-protocol.md)
- [Post-v1 Evidence Backlog](./post-v1-evidence-backlog.md)

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

## Two Clean Rehearsals Rule

- [ ] Rehearsal #1 completed on fresh clone + new browser profile
- [ ] Rehearsal #2 repeated from scratch (fresh profile/storage reset)
- [ ] If either rehearsal fails:
	- log failure in [docs/rehearsal/failure-log.md](../rehearsal/failure-log.md)
	- open a ticket using [docs/rehearsal/failure-ticket-template.md](../rehearsal/failure-ticket-template.md)
	- apply bug-fix only changes
	- restart rehearsal from step 1

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
