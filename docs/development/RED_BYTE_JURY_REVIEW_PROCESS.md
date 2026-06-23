# RedByte Jury Review Process

The RedByte Jury is the standing review process for major product changes and release-readiness decisions. It is a 12-role agentic browser jury, not a human review process.

## When It Is Required

Run the jury for:

- major surface redesign;
- Verify truth-model or expected/observed authority changes;
- persistence, recovery, storage, or multi-tab changes;
- new educational authoring flows;
- import/export trust-boundary changes;
- pilot, non-draft, merge, or release-readiness decisions.

## Permanent Jurors

The twelve juror definitions live in `.agents/jury/jurors/` and are governed by `.agents/jury/CHARTER.md`.

## Evidence Paths

Tracked process files:

- `.agents/jury/`
- `.agents/skills/redbyte-jury-orchestrator/SKILL.md`
- `docs/development/RED_BYTE_JURY_REVIEW_PROCESS.md`
- release verdict docs under `docs/release/`

Ignored run outputs:

- `.redbyte/proof/jury/YYYY-MM-DD/`
- `.redbyte-brain/jury-runs/YYYY-MM-DD/`

## Required Browser Trial

Every full jury run must attempt the from-scratch Half Adder through visible UI only. It must not use a starter project, injected state, hidden store mutation, or hidden shortcuts to complete the primary trial.

If the flow fails, record the exact obstruction and classify it. A blocked from-scratch core workflow is normally P1 and blocks non-draft unless evidence proves a lower severity.

The current primary gate is:

- `ide:gate:jury-half-adder-visible-trial`

It must remain a visible-workflow gate. It may use test IDs to find visible controls, but it must not mutate application stores, inject a completed project, or bypass authoring. It records metrics, screenshots, git status, dirty-worktree state, package manifest, downloaded package hash, and explicit non-claims under ignored `.redbyte/proof/jury/YYYY-MM-DD/`.

## Verdict Rules

- Any reproducible P0 is stop-ship.
- Any unresolved P1 affecting the core from-scratch flow blocks non-draft.
- J08 through J12 truth/safety vetoes require evidence-based resolution.
- Major product direction requires at least 8 of 12 support.
- If 3 or more jurors dissent, the verdict must preserve a minority report.

## Implementation Rule

No product-code changes are made until the first-round jury verdict is complete. After verdict, choose one coherent fix package containing all P0s and a coherent set of shared-root-cause P1s. Do not add unrelated P2 polish.

## Non-Claims

Jury output must explicitly state when no human review, no human assistive-technology certification, and no Vivado/Basys3 E1-E3 proof were performed.

## Current Jury Run

Jury Review 001 is tracked in `docs/release/RED_BYTE_JURY_REVIEW_001.md`.
Jury Retrial 001 is tracked in `docs/release/RED_BYTE_JURY_RETRIAL_001.md`.

Current verdict: `READY WITH FIXES / KEEP DRAFT`.

The primary from-scratch Half Adder trial now passes after a narrow mapping-authority and proof-harness package. Secondary Course/My check, sequential timing, recovery, import, and accessibility trials remain required before any non-draft decision. Human professor/student walkthrough and actual assistive-technology review remain separate required evidence.
