---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: product claim traceability and evidence model for RedByte
---

# RedByte Product Traceability Model

This model defines how RedByte product claims connect to repo truth, code, tests, gates, docs, and Obsidian memory.

The rule is simple: no public or product claim may exceed the evidence level that supports it.

---

## Core Objects

| Object | Meaning |
|---|---|
| Product claim | A statement about what RedByte does, guarantees, or intentionally does not do. |
| Source of truth | The highest-authority current repo source for the claim. Obsidian can add context, but cannot override repo truth. |
| Code owner files | Runtime files that implement or enforce the claim. |
| Tests/gates | Automated checks that prove the claim has not regressed. |
| Evidence level | The highest proof tier currently attached to the claim. |
| Current state | What is implemented and safe to say today. |
| Target state | What the product contract says RedByte should become. |
| Stale-memory risk | Any Obsidian note or historical doc that could mislead a future agent. |
| Update requirements | Docs, tests, or vault notes that must change when the claim changes. |

---

## Evidence Levels

| Level | Name | Meaning |
|---|---|---|
| L0 | Documented only | The claim exists in a doc or plan, but no implementation evidence is attached. |
| L1 | Code exists | Runtime or tooling code exists, but no focused test is known. |
| L2 | Unit or integration test exists | A focused automated test proves the local behavior. |
| L3 | Browser or workflow gate exists | A browser, gate, or workflow-level check proves the behavior through a realistic path. |
| L4 | Hardware or manual evidence exists | Vivado, Basys3, or manual observation evidence is recorded. |
| L5 | Release or pilot evidence exists | The claim has survived release rehearsal, classroom/pilot use, or equivalent signoff. |

Use the highest level that is actually supported. Do not borrow evidence from adjacent claims.

---

## Source Hierarchy

When a claim has conflicting evidence, use this order:

1. Current repo truth: `AI_STATE.md`, `docs/ACTIVE_WORK.md`, current product control docs, current git state.
2. Target/product contract docs: `docs/product/V1_RELEASE_SPEC.md`, `docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md`, `docs/contracts/RedByte_Product_Contract.md`.
3. Surface specs and product architecture: `docs/ide/**`, `docs/IDE_SYSTEM_MAP.md`, `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/manuals/RedByte_Product_Manual.md`.
4. Obsidian memory: dashboard, session log, architecture notes, bug notes, decision notes.
5. Historical or stale docs: superseded, deprecated, archived, or contradicted docs.

Repo current-state docs win over Obsidian memory.

---

## Required Trace Report Fields

Every traceability report should include:

- Claim
- Current truth status: `implemented`, `partially implemented`, `aspirational`, `contradicted`, or `unknown`
- Supporting repo docs
- Code files likely responsible
- Tests/gates proving it
- Missing tests or proof
- Stale or conflicting Obsidian notes
- Evidence level
- Recommended next action

---

## Examples

### Draft Export vs Trusted Export

- Claim: Trusted Export requires current Compare PASS, current mapping, and current export bundle.
- Current state: Implemented as a product truth and supported by Export/Project workflow authority.
- Minimum evidence: L2 if only unit tests exist; L3 when browser or workflow gates prove the user path.
- Update requirements: Export spec, current truth docs, tests/gates, and any Obsidian note that says "export ready" without the trust distinction.

### Map Pins vs Verify Proof

- Claim: Map Pins does not replace Verify proof.
- Current state: Current product truth and agent rules state mapped hardware is distinct from verified/trusted hardware.
- Minimum evidence: L2 for authority/test coverage; L3 if a workflow gate proves Map Pins completion still routes stale proof to Verify.
- Update requirements: Hardware spec, Export spec, workflow authority docs, tests/gates, and stale Obsidian memory.

### Curated Learning Path

- Claim: RedByte has a curated v1 learning path.
- Current state: Implemented after the 2026-05-05 learning-path slice, with path metadata and Project surface rendering.
- Minimum evidence: L2 from focused tests; L3 if browser/surface gate proves the path on Project.
- Update requirements: Active Work, product/manual docs if student-facing copy changes, and Engineering Brain dashboard/session log.

### Debug Chrome Hidden From Product Surfaces

- Claim: Developer chrome toggles are hidden from product surfaces by default.
- Current state: Implemented in `IdeWorkbenchShell` with `showDevChrome` defaulting to false.
- Minimum evidence: L2 from shell tests; L3 if browser surface baselines prove absence across surfaces.
- Update requirements: AI_STATE, relevant shell docs, and any stale notes that still list chrome toggles as visible by default.

### Vivado Export Readiness

- Claim: RedByte exports a Vivado-ready package.
- Current state: True only within the supported Basys3/Vivado/current-proof boundaries. Do not claim arbitrary HDL/hardware success.
- Minimum evidence: L3 for generated package gates; L4 for Vivado/board proof rows; L5 only after release/pilot evidence.
- Update requirements: Release readiness, certification matrix, proof docs, manual, and Obsidian support/session notes.

---

## Command Integration

Use the memory bridge trace command for source-backed reports:

```bash
pnpm rb:memory:trace -- "Map Pins does not replace Verify proof"
pnpm rb:control:trace-claims
pnpm rb:problem:trace
```

`rb:control:trace-claims` checks the canonical claim set in `.redbyte/agent/memory/product-claims.example.json` so the main product promises can be reviewed as a batch before a slice starts.

`rb:problem:trace` checks the latest product problem packet and identifies which claims, files, tests, and evidence levels matter for that raw feedback.

The commands write generated reports under `.redbyte/agent/runs/` and never write to the Obsidian vault.

## Attribution

Connor Angiel
