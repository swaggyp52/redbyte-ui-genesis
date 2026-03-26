---
type: decision
status: active
area: verify
updated: 2026-03-26
related:
  - "[[Verify Engine]]"
  - "[[Test Infrastructure]]"
---

# ADR-002 Truth Table Selection Does Not Auto-Switch Tabs

## Decision

Clicking a failure row in the truth-table or K-map view does NOT automatically switch `verifyTab` to `'mismatches'`. Tab context is stable across selection actions.

## Context

`applyFailureSelection` (VerifySurface.tsx) registers the selected failure, opens the analysis drawer, and sets `sidePanelTab = 'vectors'`. It does not change `verifyTab`.

When `onSelectFailureCase` fires from `TruthTablePane`, it routes through `applyFailureSelection`. The failure explainer (`ide-verify-explainer-*`) lives inside `verifyTab === 'mismatches'`. This means after clicking a combo row or K-map cell, the explainer is not immediately visible — the user must click the Mismatches tab themselves.

## Options considered

**Option A (chosen):** Keep tab context stable. Selection is a selection action, not a navigation action. Students stay in the truth-table/K-map view while exploring failures. If they want mismatch-analysis detail, they click Mismatches explicitly.

**Option B (rejected):** `applyFailureSelection` auto-switches `verifyTab = 'mismatches'` when called from truth-table context. This turns a selection helper into a navigation side effect, yanks the student out of K-map context, and creates a behavioral asymmetry (truth-table click = tab jump; waveform click = no jump). Too magical.

## Consequences

- The truth table and mismatch panel are complementary views, deliberately separate
- A future improvement could add a forward pointer inside the selected combo row: "Open in mismatch analysis →" — this is explicit navigation, not hidden
- `verifySurface.combo-kmap-provenance` was narrowed (2026-03-26):
  - K-map cell identification via kmap tab → kept and passing
  - Combo rows (`ide-truth-table-combo-fail-*`) require `displaySection="auto"` which VerifySurface never passes — these belong in a TruthTablePane unit test, not here
  - Cross-tab explainer assertions (Part 2) → removed per this decision
