---
name: redbyte-jury-orchestrator
description: Use when establishing, running, or updating the RedByte 12-agent jury process, juror artifacts, jury browser trials, deliberation, implementation packages, or retrials.
---

# RedByte Jury Orchestrator

## Authority

Read first:

1. `AI_STATE.md`
2. `AGENTS.md`
3. `.agents/jury/CHARTER.md`
4. `docs/development/RED_BYTE_JURY_REVIEW_PROCESS.md`
5. current V2 product, Verify, storage, and release-readiness docs relevant to the task

Canonical docs and current source win over Obsidian notes or previous jury runs.

## Boundaries

- Label jury output as agentic browser review.
- Do not claim human professor/student review.
- Do not claim human screen-reader certification.
- Do not claim Vivado synthesis, implementation, bitstream, board programming, or Basys3 physical observation.
- Do not mark PRs non-draft or merge unless the user explicitly asks after review.
- Do not mutate stores or inject completed projects for from-scratch product evidence.

## Run Order

1. Preflight repo, branch, sync, PR status, checks, Node 20.19.0, preview identity, and build SHA.
2. Create ignored run roots under `.redbyte/proof/jury/YYYY-MM-DD/` and `.redbyte-brain/jury-runs/YYYY-MM-DD/`.
3. Fill a common brief from `.agents/jury/templates/common-brief.md`.
4. Run the primary from-scratch Half Adder browser trial with visible controls only.
5. Run secondary trials where feasible: Course/My checks, sequential timing, recovery, import, keyboard/accessibility tree/zoom.
6. Collect independent juror reports. Use subagents when available; otherwise run isolated reviewer passes sequentially.
7. Cross-examine, deliberate, preserve dissent, and publish `docs/release/RED_BYTE_JURY_REVIEW_001.md`.
8. Select one coherent fix package only after verdict.
9. Implement with focused gates and after evidence.
10. Rerun the same affected tasks and publish `docs/release/RED_BYTE_JURY_RETRIAL_001.md`.
11. Validate and update cockpit/process docs and PR body.

## Evidence

Each claim should have at least one of:

- browser screenshot path;
- Playwright trace or run log;
- console/page error log;
- DOM/geometry assertion;
- source reference;
- validation command output.

Screenshots alone support visual observations, not behavior claims.

## Closeout

Report start/end SHA, PR/check status, juror votes, P0/P1/P2 ledger, from-scratch trial result, metrics, implemented package, retrial result, validation, recommendation, and explicit non-claims.
