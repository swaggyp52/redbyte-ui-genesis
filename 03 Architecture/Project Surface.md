---
type: architecture
status: active
area: project
updated: 2026-04-13
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Authority Chain]]"
  - "[[Note Schema]]"
---

# Project Surface

## Overview

This note documents the Project surface contract for both Project Home and the loaded-project front door. Its purpose is to keep Project mode truthful and easy to scan before the student moves into Design, Verify, Export, and Hardware.

## Canonical Shape / Contract

The Project surface has two distinct states:

1. Project Home when no circuit is loaded
2. loaded Project when a circuit already exists

For Project Home, the contract is:

- Project Home must feel like a workflow foyer, not an analytics dashboard
- the landing state explains that Project is the workflow front door
- starting points stay explicit:
  - open a starter
  - build fresh
- the two primary start cards should read as deliberate lanes with generous spacing, not as one row of equal-weight utility tiles
- import remains available on Project Home as a secondary utility action (`import HDL / Vivado ZIP`), not as a peer landing card
- recent work and open-existing actions stay secondary to the starting-point choice

For the loaded Project state, the contract is:

- the hero owns one dominant workflow story:
  - what project is loaded
  - the current dominant status
  - the one current next action
- the hero must expose a single primary `Continue to ...` CTA and explain why that step is current
- the hero and workflow snapshot should read as one vertical current-focus story, not as disconnected dashboard cards
- the loaded reference card must keep visible project truth in one place:
  - source / starter context
  - top module
  - expected behavior
  - last saved
  - determinism hash
  - import fidelity when present
- the workflow snapshot must show exactly three launchpad cards:
  - Mapping
  - Verify
  - Export
- launchpad cards are evidence and orientation, not competing primary actions
- row-level helper buttons must not duplicate the same next action already owned by the hero CTA
- mapping summary and mapping table stay below the hero/snapshot stack as the first local fix surface when pin assignment is incomplete
- starter swapping stays secondary below the loaded-state workflow story
- browser-visible CTA language must stay stable across both states:
  - landing CTAs
  - starter-swap CTAs
  - blocker recovery buttons
  - mapping disclosure labels
  must all use plain ASCII copy that survives the built preview without mojibake drift

## Rules

- Project Home must remain honest about the empty state; do not fake a loaded project just to satisfy a gate or screenshot.
- Loaded Project mode must answer "what is loaded, what is done, and what should I do next" without requiring a scan across multiple unrelated panels.
- The hero CTA is the dominant next action. Secondary cards must support it, not compete with it.
- Do not regress the top of Project into equal-weight dashboard cards, chip piles, or duplicated CTA rows.
- Project CTA punctuation is part of product truth. Do not reintroduce typographic glyphs that can corrupt in the built preview when plain ASCII (`...`, `->`, `-`, `v`, `^`) is sufficient.
- Import fidelity belongs in the visible loaded reference card when it exists; do not hide all import truth inside collapsed details.
- Determinism hash is part of project truth and must stay visible somewhere in loaded Project mode.
- Mapping, Verify, and Export must remain the three visible workflow snapshot stages.
- Project surface terminology must stay aligned with the shared workflow authority path and student-facing language contracts.

## Consumption Sites

- `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
- `packages/rb-apps/src/apps/IdeApp.tsx`
- `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`
- `packages/rb-apps/src/apps/ide/__tests__/projectSurface.continuity.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/projectSurface.submission.test.tsx`
- `scripts/gates/ide-project-overview-contract.mjs`
- `scripts/gates/ide-project-continue-cta-contract.mjs`
- `docs/ide/01-project.md`
- `docs/contracts/RedByte_Product_Contract.md`

## Open Questions / Stubs

- The standalone `ide:gate:project-readiness-contract` still assumes a pre-loaded Project state and does not yet model the canonical Project Home empty state before checking loaded readiness. Decide whether that gate should seed a loaded project or explicitly tolerate Project Home first.
- The next Project slice should reduce loaded-state detail sprawl further by clarifying how much of the lower mapping/details region needs to stay visible before the student scrolls, without reopening the now-stable CTA/copy path.
