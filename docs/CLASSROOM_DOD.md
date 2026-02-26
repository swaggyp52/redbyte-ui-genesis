# Classroom Definition Of Done (IDE)

This checklist defines whether the RedByte IDE is classroom-ready for student submission flow.

## Student loop
- Project starter opens in IDE (`ProjectSurface`) and is editable in `DesignSurface`.
- Verify can be run and results are visible in `VerifySurface` with pass/fail details.
- Submission ZIP export succeeds from IDE with deterministic artifact content.
- Submission ZIP can be re-imported in IDE via `ImportSurface` and opened in `SubmissionViewerSurface`.

## Instructor loop
- IDE submission bundles parse in inspector and show grade summary fields:
  - `studentName`, `deviceId`, `labCode`/`assignmentId`, `submittedAt`.
- Queue view supports duplicate grouping and CSV export.
- Commit skew status is visible when submission commit differs from viewer commit.

## Enforcement + determinism
- Lab 7 and Lab 8 submit gates enforce proof requirements:
  - `sequence-proof` (`sequenceProofRun`)
  - `fsm-paths` (`fsmPathsRun`)
- Schedule-aware verification contract passes:
  - `verifyTruthTable.schedule`
  - sequential parity fixture
- Export/import determinism passes:
  - identical input snapshot -> stable report/hash contract
  - submission parser integrity validation for manifests with non-empty `includedFiles`

## Required closure command
- `pnpm -s classroom:gate`
