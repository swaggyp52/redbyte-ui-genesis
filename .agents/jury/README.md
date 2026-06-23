# RedByte Jury

The RedByte Jury is a standing agentic browser-review institution for major product, truth-model, persistence, and release-readiness decisions. It is not human review and does not certify screen-reader audio, professor reaction, student reaction, Vivado synthesis, bitstream generation, board programming, or Basys3 physical observation.

Use the jury when a change can alter trust, workflow comprehension, direct authoring, Verify truth, persistence/recovery, export claims, educational scaffolding, or pilot/non-draft readiness.

## Structure

- `CHARTER.md`: authority, decision rules, vetoes, and review rounds.
- `jurors/`: twelve permanent juror profiles, J01 through J12.
- `templates/`: reusable artifacts for briefs, independent reports, issue records, votes, final verdicts, implementation packages, and retrials.
- `.agents/skills/redbyte-jury-orchestrator/SKILL.md`: Codex playbook for running a jury.
- `docs/development/RED_BYTE_JURY_REVIEW_PROCESS.md`: canonical development process.

## Run Outputs

Tracked files define the reusable process. Local run evidence stays ignored:

- `.redbyte/proof/jury/YYYY-MM-DD/`
- `.redbyte-brain/jury-runs/YYYY-MM-DD/`

Each run should include a manifest with branch SHA, build SHA, preview URL, jurors, browser contexts, evidence paths, status, and final verdict doc path.

## Minimum Trial

The primary jury trial attempts a from-scratch Half Adder through normal visible UI:

1. fresh project and rename
2. Design authoring for A, B, SUM, CARRY, XOR, AND, wires
3. Verify My checks from scratch, PASS, FAIL, repair, stale, PASS
4. Map Pins to SW0, SW1, LED0, LED1
5. Export package inspection and download
6. reload, resume, backup, and recovery checks

If this cannot be completed visibly, the obstruction is evidence. Do not load a starter, inject state, or mutate application stores to hide the failure.
