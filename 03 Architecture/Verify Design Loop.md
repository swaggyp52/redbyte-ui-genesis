---
type: architecture
status: active
area: other
updated: 2026-04-13
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Project Surface]]"
  - "[[Design Surface]]"
  - "[[Verify Engine]]"
  - "[[Hardware Surface]]"
  - "[[ADR-004 Stimulus-First Observation Default]]"
  - "[[ADR-005 Verify Schedule Contract Owns Sequential Clock Authority]]"
  - "[[BUG-014 Design Replay Missed Runtime-Backed Mutations]]"
  - "[[BUG-016 Verify Workspace Nested Grid Collapse]]"
  - "[[Note Schema]]"
---

# Verify Design Loop

## Overview

This note defines the core RedByte authoring loop between Design and Verify. Its purpose is to keep structural editing, stimulus authoring, run evidence, and replay-backed explanation as one coherent student workflow instead of four loosely connected surfaces.

## Canonical Shape / Contract

The inner RedByte workflow is:

1. Project frames the current state and routes to the next step
2. Design owns circuit creation and structural edits
3. Verify owns stimulus authoring, run execution, and waveform evidence
4. Design receives selected run context back when the student needs to explain what happened
5. Hardware and Export sit downstream of that loop; they summarize readiness and handoff, not the core debug interaction itself

The Design ↔ Verify handoff contract is:

- Verify sends Design the currently selected tick plus the strongest available signal focus or failure context
- Design treats that handoff as authoritative replay context until the circuit actually changes
- any real circuit mutation immediately demotes replay to stale breadcrumb status and returns Design to live structural truth
- authored stimulus should survive that loop so the student can return to Verify without rebuilding the scenario from scratch
- downstream workflow surfaces may summarize this loop's freshness, but they must not absorb its controls

The student-facing questions are intentionally split:

- Design answers: what is wired here, what is selected, and why is this part behaving this way?
- Verify answers: what stimulus will run, what happened over time, and what should I inspect next?

## Rules

- Do not make students rebuild structural context in Verify or waveform context in Design.
- Verify is stimulus-first and evidence-first; compare authoring is an explicit branch, not the default identity of the loop.
- Design must visibly acknowledge arrival from Verify when replay context exists.
- Replay authority ends on real circuit mutation. Stale breadcrumbs may remain for orientation, but live Design truth retakes ownership immediately.
- Project, Hardware, and Export may report loop freshness and next actions, but they must not duplicate the inner Design ↔ Verify control model.
- If screen space is constrained, preserve the loop's core authorities first: Design canvas/selection and Verify stimulus/waveform/tick context.

## Consumption Sites

- `packages/rb-apps/src/apps/IdeApp.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- `packages/rb-apps/src/apps/ide/surfaces/verify/VerifyCommandBar.tsx`
- `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`
- `packages/rb-apps/src/apps/ide/__tests__/designSurface.workstation.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/verifySurface.observeFirst.test.tsx`
- `packages/rb-apps/src/apps/ide/__tests__/verifySurface.layout-workflow.test.tsx`

## Open Questions / Stubs

- The loop is defined conceptually, but the current Verify surface still exposes too many simultaneous secondary actions in the live UI. The next UI pass should simplify that visible default path to match this note.
- The return path from Hardware or Export back into the inner loop is still mostly CTA-driven rather than stateful. Decide whether that downstream return should preserve more focused context in future slices.