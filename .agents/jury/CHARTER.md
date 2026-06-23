# RedByte 12-Agent Jury Charter

## Mission

The jury protects RedByte's product trust. It reviews whether RedByte behaves like a dependable Basys3-first educational digital-logic workbench for normal student and professor use.

The jury is agentic browser evidence. It is not human review, assistive-technology certification, Vivado proof, bitstream proof, programming proof, or board-observation proof.

## Jurors

- J01 Novice Student
- J02 Experienced Student
- J03 Professor / TA Operations Lead
- J04 Visual Art Director
- J05 Color and Accessibility Systems Specialist
- J06 Interaction and Information Architect
- J07 Digital Logic Pedagogy Expert
- J08 Verify and Testbench Truth Auditor
- J09 FPGA / Vivado / Basys3 Engineer
- J10 Reliability and Classroom Concurrency Engineer
- J11 Frontend Architect and Performance Engineer
- J12 Security, Support, and Skeptical Release Red Team

## Review Rounds

1. Blind review: each juror receives the same common brief and produces independent evidence.
2. Cross-examination: jurors challenge at least two anonymized claims using browser/source evidence.
3. Deliberation: the coordinator deduplicates issues, preserves disagreement, and ranks root causes.
4. Verdict: each juror votes READY, READY WITH FIXES, or NOT READY.
5. Retrial: after fixes, the same tasks rerun and scores are compared.

## Decision Rules

- Any reproducible P0 is stop-ship.
- Any unresolved P1 affecting the core from-scratch flow blocks non-draft.
- Truth and safety vetoes from J08 through J12 require evidence-based resolution, not majority override.
- Major product direction requires at least 8 of 12 support.
- If 3 or more jurors dissent, preserve a minority report.
- No feature is added because one juror prefers it. Issues require reproduction, student impact, and a gate or test plan.

## Severity

- P0: data loss, false trusted PASS, wrong pin/export readiness, destructive import/recovery, app crash, privacy/security stop-ship, or unsupported hardware proof claim.
- P1: core workflow blocked or confusing, hidden/cropped primary action, inaccessible required action, unclear Course/My check authority, unclear Vivado/hardware boundary, or unrecoverable normal-use failure.
- P2: polish, copy, spacing, hierarchy, or local workflow friction that does not block the core task.

## Evidence Rules

- Use current app build and record build SHA.
- Use isolated browser contexts and storage.
- Use visible controls, mouse, and keyboard for product claims.
- Test IDs may locate visible controls, but may not skip workflow steps.
- Do not mutate stores, inject completed projects, use starters for from-scratch evidence, or call hidden helpers to bypass authoring.
- Capture screenshots, console/page errors, geometry, storage/reload results, elapsed time, click counts, scroll counts, and backtracks where practical.

## Non-Claims

Unless separately performed and recorded, jury output must say:

- no human professor/student review was performed;
- no human screen-reader certification was performed;
- no Vivado synthesis/implementation/bitstream/programming proof was performed;
- no Basys3 physical observation proof was performed.
