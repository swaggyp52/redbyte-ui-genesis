---
doc_status: current
last_validated: 2026-06-20
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 Verify truth model contract
---

# RedByte Verify Truth Model V2

This contract defines the Verify truth model for Product Trust Reset v2. It supersedes older Verify UI contracts wherever they allow expected outputs, observed outputs, Compare state, and repair actions to appear in the same ambiguous editing mode.

This is a product and implementation contract. It must be proven by runtime tests plus focused browser gates before the V2 Verify redesign can merge.

## Core Objects

Observed outputs:

- Produced by running the current circuit.
- Always read-only.
- Never directly editable.
- May be inspected, copied, or used as a source for a proposed student-authored check.

Expected outputs:

- Reference values used by Compare.
- Editable only in explicit Testbench Authoring mode.
- Never casually editable inside Results mode.

Compare result:

- Computed, never editable.
- PASS is valid only for the current design revision, selected check set, and testbench revision.
- FAIL points to one or more mismatches between expected and observed values.
- STALE appears immediately after circuit or testbench changes that invalidate the latest result.

## Check Ownership

Course-provided checks:

- Clearly labeled as course or starter checks.
- Locked by default.
- May be duplicated into My checks when authorship is allowed.
- Cannot be silently edited to manufacture PASS.

Student-authored checks:

- Clearly labeled as My checks.
- Editable only in Testbench Authoring mode.
- Any edit invalidates the current Compare result and marks it stale.

Generated starter stimulus without expected values:

- May support observation and learning.
- Does not create Compare PASS until expected checks exist.

## Required Verify Layout

Verify has two primary tabs:

- Testbench
- Results

Before Run:

- Testbench is primary.
- The stimulus/check grid owns the workspace.
- Scenario/check-set identity is obvious.
- Run Compare is the primary action when expected checks are selected.
- Empty waveform machinery is secondary.

After PASS:

- Results is primary.
- Summary and waveform dominate.
- Testbench remains available through its tab.
- The UI says what was proven and what the next action is.

After FAIL:

- Results is primary.
- Failure list and waveform dominate.
- First failure is selected.
- Expected versus observed is visible.
- Repair action is explicit.
- Result cells are not editable.

## FAIL Repair

Each selected failure must expose:

- signal
- case or tick
- expected value
- observed value
- check ownership

Allowed actions:

- `Fix circuit`
- `Edit my check`

Rules:

- `Fix circuit` is available for all failures.
- `Edit my check` appears only when the failing check is student-authored.
- Locked course checks do not expose an edit action.
- `Open first failing check` must focus the exact relevant row/cell or design path.

## Stale Rules

Current Compare result becomes stale when:

- the circuit graph changes
- boundary I/O changes
- selected check set changes
- an expected value changes
- scenario/testbench steps change
- relevant mapping changes for downstream Hardware/Export trust

Stale copy must say why:

- Design changed - rerun checks
- Testbench changed - rerun checks
- Pin mapping changed - review package readiness

## Gates Required Before Merge

- `ide:gate:verify-truth-model-v2`
- `ide:gate:verify-locked-course-checks`
- `ide:gate:verify-stale-result-invalidation`
- `ide:gate:verify-failure-repair-v2`
- `ide:gate:verify-testbench-results-layout-v2`
- `ide:gate:verify-sequential-consistency-v2`

Legacy Verify gates may stay temporarily, but they must not force the old signal rail, ambiguous editable result cells, or Observe-first novice flow back into the V2 design.
