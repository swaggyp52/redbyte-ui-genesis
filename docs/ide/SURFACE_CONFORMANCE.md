---
doc_status: current
last_validated: 2026-04-21
owner: Connor Angiel
used_by_claude: true
role: surface change governance
---

# RedByte IDE Surface Conformance Governance

**Document:** RB-SURF-CONF-001 v1.0
**Date:** 2026-04-21
**Applies to:** IDE surface work in `packages/rb-apps/src/apps/ide/**`

---

## Purpose

This document extends the repo's manual-governance model to product legitimacy work. It defines:

1. which files and docs are authoritative for each IDE surface
2. which proof docs must be reviewed when a surface changes
3. how complaints become enforceable hardening work
4. what evidence is required before surface work is considered done

---

## Four Truth Layers

RedByte product work must keep these truth layers separate:

| Layer | Meaning | Canonical source |
|---|---|---|
| Current truth | What the product does today | `docs/manuals/RedByte_Product_Manual.md`, current runtime behavior |
| Target truth | What the product must become | `docs/contracts/RedByte_Product_Contract.md` |
| Gap truth | What is still wrong or unproven | `docs/roadmap/RedByte_Gap_Audit.md` |
| Proof truth | What has been demonstrated with evidence | `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`, screenshots, recordings, test/gate output |

Working memory, architecture notes, and bug context may live in the Obsidian vault, but they do not replace these source docs.

---

## Canonical Read Order

Before proposing or implementing any product, UX, workflow, or surface change, read:

1. `docs/contracts/RedByte_Product_Contract.md`
2. `docs/manuals/RedByte_Product_Manual.md`
3. `docs/roadmap/RedByte_Gap_Audit.md`
4. `docs/IDE_SYSTEM_MAP.md`
5. this document
6. the relevant proof doc:
   - `docs/release/manual-assignment-qa-script.md`
   - `docs/release/v1-release-checklist.md`
   - `docs/release/product-hardening-ticket-template.md`
   - `docs/rehearsal/failure-ticket-template.md`

Do not use the stale / OS-era docs listed in `docs/DOC_INDEX.md` as default context unless the task explicitly targets historical cleanup or legacy shell behavior.

---

## Surface Authority Map

| Surface / shared owner | Primary code | Must review | Proof focus |
|---|---|---|---|
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | Product contract Project surface promise, current manual, gap audit workflow/coherence items, IDE system map, manual QA Phase 1, release checklist startup / first-run clauses | next action obvious, readiness truthful, starter/load path coherent |
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` | Product contract Design promise, current manual, gap audit design-legitimacy items, IDE system map Design chrome, manual QA Phase 2 | authoring clarity, live issue visibility, selection/wiring confidence |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | Product contract Verify promise, current manual, gap audit verify-trust items, IDE system map Verify chrome, manual QA Phase 3 | truthful pass/fail, waveform readability, mismatch evidence, tick lock-step |
| Hardware | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | Product contract Hardware promise, current manual, gap audit hardware-clarity items, IDE system map Hardware chrome, manual QA Phase 4, release / rehearsal hardware docs | mapping immediacy, synchronized highlights, honest dependency chain |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | Product contract Export promise, current manual, gap audit export-trust items, IDE system map export path, manual QA Phase 5 | coherent artifacts, honest readiness, Vivado handoff clarity |
| Import | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | Product contract Import promise, current manual, gap audit fidelity items, IDE system map import path, manual QA Phase 6 | fidelity honesty, actionable warnings, visible round-trip result |
| Shell / workflow spine | `packages/rb-apps/src/apps/IdeApp.tsx`, `packages/rb-apps/src/apps/ide/workflowStages.ts`, `packages/rb-apps/src/apps/ide/components/IdeLeftRail.tsx`, `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx` | Product contract Global Shell Contract, current manual workflow language, gap audit coherence items, IDE system map, release checklist startup / determinism clauses | surfaces agree on done / blocked / next / why; no contradictory CTA or status language |

---

## Change Impact Matrix

When a change touches one of these file patterns, the corresponding review and proof work is mandatory.

| Changed file pattern | Must review | Minimum proof |
|---|---|---|
| `**/ProjectSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 1 | targeted tests plus a project-entry replay or screenshot showing obvious next action |
| `**/DesignSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 2 | targeted tests plus a design replay showing visible authoring / issue behavior |
| `**/VerifySurface.tsx` or `**/verify/**` | contract + manual + gap audit + system map + manual QA Phase 3 | targeted tests plus a verify replay showing run / tick / mismatch evidence behavior |
| `**/HardwareSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 4 + relevant rehearsal doc | targeted tests plus a mapping replay or screenshot proving synchronized feedback |
| `**/ExportSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 5 | targeted tests plus artifact or screenshot proof of handoff/readiness behavior |
| `**/ImportSurface.tsx` | contract + manual + gap audit + system map + manual QA Phase 6 | targeted tests plus import replay or screenshot proving fidelity messaging |
| `**/IdeApp.tsx`, `**/workflowStages.ts`, `**/IdeLeftRail.tsx`, `**/IdeWorkbenchShell.tsx` | global shell contract + affected surface rows + release checklist | cross-surface proof that active surface, CTA, and status language stay coherent |

---

## Hardening Ticket Requirement

Before coding a product complaint, convert it into a structured hardening ticket. Use one of:

- `docs/release/product-hardening-ticket-template.md`
- `.github/ISSUE_TEMPLATE/product-hardening.yml`

Every ticket must capture:

1. journey segment
2. surface and mode
3. environment and whether it reproduces on a fresh machine / clean profile
4. observed behavior
5. expected behavior
6. exact repro steps
7. evidence
8. violated contract / QA / current-truth clause
9. minimum acceptance proof
10. docs that must be reviewed or updated if the behavior changes

No "make it better" work starts without this structure.

---

## Update Process

For any surface change:

1. Classify the problem in a hardening ticket.
2. Read the canonical docs in the required order.
3. Identify which truth layers are affected:
   - current truth
   - target truth
   - gap truth
   - proof truth
4. Implement the smallest reversible fix.
5. Run focused proof for the touched surface.
6. Update impacted docs if behavior, wording, or proof obligations changed.
7. Add a factual `AI_STATE.md` Change Log entry for meaningful changes.

---

## Closure Standard

Surface work is not done when tests merely pass. It is done when:

- the implementation is correct
- the affected surface still matches the contract
- the current-truth docs remain honest
- the relevant QA / rehearsal proof still passes or is updated
- the hardening ticket's acceptance proof is satisfied

---

## Invariants

These rules apply across all surfaces:

1. The next correct action must be obvious.
2. No surface may imply readiness that does not exist.
3. Status, CTA language, and stage ownership must agree across surfaces.
4. Visual cleanup without proof does not count as hardening.
5. Historical shell / OS narratives are not current product truth.
6. Batch 1 product-state vocabulary is canonical across surfaces: draft design, simulated, testbench configured, Compare passed, pins mapped, draft export, trusted export, Vivado built, board programmed, board observed.
7. Observe runs may explain behavior, but only current Compare PASS can complete the Verify proof stage for trusted Export/Hardware handoff.

---

## Related Docs

- `docs/contracts/RedByte_Product_Contract.md`
- `docs/manuals/RedByte_Product_Manual.md`
- `docs/roadmap/RedByte_Gap_Audit.md`
- `docs/IDE_SYSTEM_MAP.md`
- `docs/release/manual-assignment-qa-script.md`
- `docs/release/v1-release-checklist.md`
- `docs/release/product-hardening-ticket-template.md`
- `docs/rehearsal/failure-ticket-template.md`

## Attribution

Connor Angiel
