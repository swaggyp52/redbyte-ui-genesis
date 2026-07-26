---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: product-brain architecture and doc-routing map for RedByte agents
---

# RedByte Product Brain Architecture

This document defines how RedByte's product truth should be routed. It is not a new product surface and not a replacement for code, tests, or current cockpit docs.

## Core Principle

RedByte already has a product brain. It is distributed across the runtime, tests, current cockpit docs, product manual, contract, surface specs, release proof docs, and audits.

Future agents should strengthen that backbone rather than create a parallel knowledge system.

## Truth Hierarchy

| Rank | Truth source | Role | How agents should use it |
|---|---|---|---|
| 1 | Code, tests, runtime behavior | Current implementation truth | Verify when a fact is drift-prone or user-facing. Code wins when docs conflict. |
| 2 | `AGENTS.md`, `AI_STATE.md`, `CLAUDE.md` | Agent startup and latest repo posture | Read before proposing or implementing work. `AI_STATE.md` wins over stale prompt context. |
| 3 | `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md` | Current work cockpit and routing index | Use to avoid stale docs and identify current priorities. |
| 4 | `docs/product/RED_BYTE_CURRENT_TRUTH.md`, `docs/product/RED_BYTE_WORK_QUEUE.md` | Product control layer and ordered queue | Use for current product boundaries and next work ordering. |
| 5 | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/**`, `docs/rehearsal/**` | Release proof and QA truth | Use for safe public, student, TA, Vivado, and hardware claims. |
| 6 | `docs/manuals/RedByte_Product_Manual.md` | Current user-visible behavior | Use for what the app is supposed to do today. |
| 7 | `docs/contracts/RedByte_Product_Contract.md` | Target quality bar | Use as target truth, not as shipped-behavior proof. |
| 8 | `docs/IDE_SYSTEM_MAP.md`, `docs/ide/**` | Surface ownership and UI contracts | Use before product, UX, workflow, or surface changes. |
| 9 | Current audits and plans | Evidence-backed follow-up | Use for issue ordering, not as source-code permission. |
| 10 | Historical or aspirational docs | Background only | Exclude from default context unless the task is historical cleanup or legacy-shell behavior. |

## Startup Read Order For Product Work

For product, UX, workflow, or surface work:

1. `AGENTS.md`
2. `AI_STATE.md`
3. `CLAUDE.md`
4. `docs/ACTIVE_WORK.md`
5. `docs/DOC_INDEX.md`
6. `docs/product/RED_BYTE_CURRENT_TRUTH.md`
7. `docs/product/RED_BYTE_WORK_QUEUE.md`
8. `docs/STUDENT_RELEASE_READINESS.md`
9. `docs/contracts/RedByte_Product_Contract.md`
10. `docs/manuals/RedByte_Product_Manual.md`
11. `docs/roadmap/RedByte_Gap_Audit.md`
12. `docs/IDE_SYSTEM_MAP.md`
13. `docs/ide/SURFACE_CONFORMANCE.md`
14. Relevant proof docs under `docs/release/**` and `docs/rehearsal/**`

For FPGA-specific work, also read:

- `docs/00-canon/08-fpga-agent-bootstrap.md`
- `docs/00-canon/07-fpga-laboratory-constitution.md`
- `docs/fpga-merge-review-checklist.md`

These FPGA docs are background/constitutional unless current cockpit docs say otherwise.

## Current Product Brain Modules

| Module | Current owner doc(s) | Notes |
|---|---|---|
| Product identity and promise | `docs/product/RED_BYTE_CURRENT_TRUTH.md`, `docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md` | Browser-based FPGA educational IDE for Basys3. |
| Current workflow spine | `docs/product/RED_BYTE_CURRENT_TRUTH.md`, `docs/manuals/RedByte_Product_Manual.md` | Project -> Design -> Verify -> Map Pins -> Export. |
| Surface contracts | `docs/ide/00-ide-layout.md` through `docs/ide/05-import.md`, `docs/ide/SURFACE_CONFORMANCE.md` | Required before UI/surface work. |
| Target product contract | `docs/contracts/RedByte_Product_Contract.md` | Target promise, not automatic shipped proof. |
| Release proof posture | `docs/STUDENT_RELEASE_READINESS.md`, `docs/release/**` | Source for student-safe claims. |
| Known queue | `docs/product/RED_BYTE_WORK_QUEUE.md` | Short ordered work queue. |
| Audit evidence | `docs/audits/**` | Evidence snapshots. Do not treat as evergreen. |
| Roadmaps and plans | `docs/plans/**` | Implementation ordering. Must lose to current cockpit if stale. |
| Commercial readiness | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md` | Business/readiness boundary from this audit. |

## Stale-Doc Policy

Default agent context must exclude stale or OS-era docs listed in `docs/DOC_INDEX.md`, unless the task is explicitly about historical cleanup or legacy shell behavior.

Examples of docs that should not override current truth:

- Old OS/workbench docs that predate the current IDE spine.
- Aspirational `docs/00-canon/**` claims when they conflict with current cockpit docs.
- Historical gap-audit language that has since been resolved or superseded.
- Generated proof-pack references when the raw ignored artifacts are absent from the clone.

When a stale doc contains useful history, quote it as history. Do not make it a current blocker without fresh runtime evidence.

## How To Add Product Knowledge

Use the smallest durable home:

- Current state changed: update `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, or `docs/product/RED_BYTE_WORK_QUEUE.md`.
- Surface behavior changed: update the relevant `docs/ide/**` surface doc and product manual.
- Release proof changed: update `docs/STUDENT_RELEASE_READINESS.md` and relevant `docs/release/**`.
- A one-time investigation happened: add an audit under `docs/audits/**`.
- A sequenced repair plan is needed: add or update a plan under `docs/plans/**`.
- Commercial/business posture changed: update `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`.

Do not add a new top-level committed brain directory unless the user explicitly asks for one and explains why the existing docs backbone cannot hold the knowledge. An ignored local `.redbyte-brain/` scratchpad is allowed for browser-first product ownership sessions when it links back to canonical docs and stays out of commits.

Use `.redbyte-brain/` only for local working memory such as the active sprint dashboard, current product issue ledger, frontend affordance notes, and next-task prompt. If the scratchpad records durable truth, move that truth into `AI_STATE.md`, cockpit docs, product docs, surface specs, release proof docs, or tracked Obsidian notes before closeout.

## Agent Product-Work Checklist

Before product work:

- Confirm repo path and branch.
- Confirm tracked worktree status and ahead/behind state.
- Read the startup docs above.
- Translate complaints into the product-hardening ticket template fields.
- Identify exact surface ownership.
- Identify proof obligations before editing.

During product work:

- Keep one logical change per commit.
- Prefer existing patterns and tests.
- Keep TS/TSX source and JS mirror files aligned when both exist.
- Avoid source/test/golden edits outside the approved slice.

After product work:

- Run focused gates plus docs/encoding checks.
- Update current docs if behavior changed.
- Report exact branch, commit, push status, and honest live impact.
- Never equate GitHub source delivery with "live for students" unless deployment proof exists.

## Current Product-Brain Gap Found By The Audit

The current docs backbone is strong, but it needs sharper routing:

- `CLAUDE.md` and agent startup docs should keep importing the current cockpit rather than stale path references.
- `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md` contains useful product-flow thinking but should be treated as follow-up ordering, not current shipped proof.
- `docs/roadmap/RedByte_Gap_Audit.md` is valuable historical audit context, but resolved items should not be revived as current blockers.
- Current product-brain docs should distinguish product UX hardening from Vivado/Basys3 proof restoration.

## Product Brain Summary

The durable RedByte brain is:

Code and tests for runtime truth, cockpit docs for current state, product docs for behavior and queue, surface docs for ownership, release docs for evidence claims, audits for dated findings, and plans for ordered repair.

Keep that system tight. Do not split product truth into a parallel committed brain unless the existing hierarchy fails a concrete need.

