# Merge Checklists — Student UX Batch 2026-03-11

**Context:** Three parallel tracks. Merge in this order: Hardware → Verify → Macros.  
**Gate baseline:** verify-workbench-contract PASS, student-loop-contract PASS.  
**Hard rule:** Both gates must PASS after every track merges. No exceptions.

---

## Track 1: Hardware Mapping UX

**Status:** Files exist (HardwareBoard2D.tsx + .module.css). Tests pass.  
**Priority:** Merge first — lowest risk, quick win.

### Required Proof Before Merge

Manual click-test of these 10 interactions (no Playwright required — visual spot-check):

| # | Action | Pass Criterion |
|---|--------|----------------|
| 1 | Click LED LD0 | Toggle responds, no text selected |
| 2 | Click LED LD7 | Toggle responds, no text selected |
| 3 | Click Switch SW0 | Toggle responds, animates visibly |
| 4 | Click Switch SW7 | Toggle responds, animates visibly |
| 5 | Click Button BTN0 | Responds visually |
| 6 | Hover over LED label | Teal highlight, 150ms transition |
| 7 | Hover over switch label | Teal highlight, 150ms transition |
| 8 | Click switch label text | Toggle fires (label clicks through) |
| 9 | Drag-select across board | No text highlighted/selected |
| 10 | Map a signal, then click board element | Mapping behavior unchanged |

### Build Checks

- [ ] `pnpm run ide:gate:verify-workbench-contract` → PASS
- [ ] `pnpm run ide:gate:student-loop-contract` → PASS
- [ ] No TypeScript errors in modified files
- [ ] No CSS regressions (existing board styles still apply)

### What NOT to Merge If

- Text selection on click still fires
- Any existing board interaction (map, unmap, preview) is broken
- Hitbox expansion pushed any element out of board bounds
- Hover transitions not visible at 100% zoom

### Commit Message

```
fix(hardware): expand hitboxes, fix text-click-through, add hover feedback

- pointer-events:none on all silkscreen/signal labels in board SVG
- expanded click targets: LED r=7→20, Button r=9→20, Switch 14×22→30×40
- added ledHitbox, btnHitbox, swHitbox invisible hit areas in CSS
- hover feedback: teal (#2ec4b6) highlight, 150ms transition
- no behavior changes — purely UX/responsiveness
```

---

## Track 2: Verify UI Redesign

**Status:** Agent working — TDD phase 1 (VerifyVectorListPanel).  
**Priority:** Merge second — highest student impact.

### Acceptance Criteria (Hard Gates)

**Layout:**
- [ ] Desktop (≥1200px): All three panels visible and readable at 1366×768
- [ ] Center waveform never shrinks below 400px
- [ ] Right panel visible by default when FAIL; hides on PASS
- [ ] Mobile (≤768px): Right panel collapsed, center waveform stacked first

**Auto-focus on FAIL:**
- [ ] When `lastRun.status === 'fail'`, first failing vector/case selected automatically
- [ ] Waveform auto-zooms to failure window on that first fail
- [ ] Right panel auto-populates with explanation on first fail
- [ ] `J` key jumps to next failing tick AND visibly changes what student sees (waveform scrolls/zooms)

**Failure Explanation Panel:**
- [ ] Shows: failing signal key
- [ ] Shows: expected value
- [ ] Shows: actual value
- [ ] Shows: likely reason (one of: output-mismatch, undefined-output, floating-output, timing-mismatch)
- [ ] Updates when student selects different vector row

**Waveform:**
- [ ] Remains primary workspace (center panel, widest)
- [ ] Failing ticks highlighted (columns red)
- [ ] Failing signals highlighted (red text in label + trace)
- [ ] Signal labels show hover tooltip (signal name + direction + pin + expected + actual)
- [ ] No nested-scroll trap inside waveform container

**Keyboard Navigation:**
- [ ] `↑ / ↓` in vector list: navigate rows
- [ ] `Enter` in vector list: select (confirms selection)
- [ ] `J / K` in waveform: next/prev fail tick
- [ ] `F` in waveform: fit view
- [ ] `Tab`: cycle panels

**Accessibility:**
- [ ] Fail state uses icon + color (not color-only): ❌ + red
- [ ] Pass state uses icon + color: ✓ + green
- [ ] Hover tooltip on signal labels
- [ ] WCAG AA contrast on fail text (≥4.5:1)
- [ ] Font scales with browser zoom

**Secondary Tools:**
- [ ] Truth table still accessible (tab or toggle)
- [ ] K-map still accessible (tab or toggle) for combinational circuits
- [ ] Vectors tab still accessible

**Tests:**
- [ ] VerifyVectorListPanel: renders, selection, keyboard nav, auto-focus
- [ ] VerifyFailureExplanationPanel: failure display, cases, empty state
- [ ] VerifyThreePanel: responsive breakpoints render correctly
- [ ] verify-failure-classifier: all 4+ failure types classified correctly
- [ ] No regressions in existing verify tests

**Build:**
- [ ] `pnpm run ide:gate:verify-workbench-contract` → PASS
- [ ] `pnpm run ide:gate:student-loop-contract` → PASS
- [ ] No TypeScript errors
- [ ] No stale test snapshots

### What NOT to Merge If

- 1366×768 feels cramped (three panels don't fit legibly)
- Failure explanation panel is a popup/drawer rather than persistent column
- Truth/kmap tabs are gone or hard to access
- `J` key does nothing visible
- Auto-select on FAIL doesn't happen (student must click manually)
- Nested scrolling reappears inside any panel

### Commit Message

```
feat(verify): three-panel layout with auto-focus failure explanation

- three-panel workspace: vector list | waveform center | failure explanation
- auto-focus on FAIL: first failing case selected, waveform centers, right panel populates
- VerifyVectorListPanel: keyboard nav (↑↓ Enter), pass/fail icons, auto-select
- VerifyFailureExplanationPanel: expected vs actual, signal key, likely reason
- VerifyThreePanel: responsive — desktop 3-col, tablet slide-over, mobile stacked
- verify-failure-classifier: output-mismatch / undefined / floating / timing types
- signal hover tooltips: name, direction, pin, expected, actual, status
- truth table / kmap still accessible as secondary tabs
- WCAG AA contrast, icon+color fail indicators, font scales with zoom
```

---

## Track 3: Macro System (v1 — Saved Block Templates)

**Status:** MacroLibrary.ts + macroFlattener.ts + MacroLibraryPanel.tsx created. Tests passing.  
**Priority:** Merge third — requires stable clone foundation.

### Pre-Merge Foundation Check (Do First)

Before macro UI merges, verify these are true:

- [ ] `designClipboard.ts` pasteCluster/serializeCluster is already in production use
- [ ] `pasteCluster` produces unique node IDs (no collisions when called twice)
- [ ] Internal wire connections remap correctly (no dangling edges on paste)
- [ ] Label collision policy: auto-increment prevents duplicate node labels in circuit
- [ ] Test: Insert same macro twice → both clusters independent, no shared state

**Run this check:**
```
pnpm -w exec vitest run packages/rb-apps/src/apps/ide/__tests__/macroLibrary.test.ts
```
All tests must pass.

### v1 Scope Check (Hard Limit)

Macro v1 = **Saved Block Templates only**. Verify scope is correct:

- [ ] `MacroDefinition` stores `ClipboardCluster` (expanded clone at insert time) ✓
- [ ] `getInstantiationTemplate` produces fully unique IDs, no shared-definition links ✓
- [ ] `flattenProjectMacros` strips library from export — no macro objects in Vivado output ✓
- [ ] **No live instance propagation** — editing a macro does NOT retroactively change inserted instances
- [ ] **No parametric macros** — no per-instance configuration, not yet
- [ ] **No recursive macros** — no macro containing another macro, not yet

**If any of these fail:** simplify before merging.

### Acceptance Criteria

**Save as Block:**
- [ ] Select 2+ gates in design surface (Ctrl+Click or box-select)
- [ ] "Save as Macro" button/action appears when ≥2 gates selected
- [ ] Save dialog: enter name, auto-detected inputs/outputs shown, confirm
- [ ] Saved macro appears in Macro Library panel
- [ ] Macro persists in project JSON (`project.macros` array)

**Reuse Block:**
- [ ] Click macro in library → enter insert mode
- [ ] Click canvas → macro instantiated as expanded gates/wires with unique IDs
- [ ] Inserted cluster auto-labeled (e.g., "Inverted_AND_1", "Inverted_AND_2")
- [ ] Inserted cluster is independent — delete original macro, instances still work
- [ ] Insert same macro twice → two independent clusters, no shared state

**Export:**
- [ ] `flattenProjectMacros()` called before Vivado export
- [ ] Exported .xpr, .vhd, .xdc contain only plain gates/wires
- [ ] No `macros` key in exported project JSON that ships to Vivado

**Delete:**
- [ ] Delete macro from library removes it
- [ ] Previously inserted instances still work (they're expanded gates, not references)

**Tests:**
- [ ] macroLibrary.test.ts: all tests pass
- [ ] macroFlattener.test.ts: all tests pass
- [ ] rbproject-roundtrip-ide.test.ts: passes (project round-trip with macros)
- [ ] canvas-input-controller.test.ts: passes (selection logic)
- [ ] ≥80% coverage for MacroLibrary.ts and macroFlattener.ts

**Build:**
- [ ] `pnpm run ide:gate:verify-workbench-contract` → PASS
- [ ] `pnpm run ide:gate:student-loop-contract` → PASS
- [ ] No TypeScript errors in macro files or callers
- [ ] No regression in existing design/export tests

### What NOT to Merge If

- Inserting same macro twice creates shared state or collides IDs
- Edit-macro-after-insert retroactively changes the instance (live propagation)
- Export emits `MacroInstance` objects or references (Vivado must see only gates)
- pasteCluster produces duplicate node IDs in any test case
- Any existing design gate (AND, OR, NAND, etc.) behavior changed
- Clone logic produces dangling wire edges (connections pointing to nonexistent nodes)

### Commit Message

```
feat(macros): Saved Block Templates v1

- MacroDefinition stores ClipboardCluster — insert-time expansion, no live links
- saveMacro: boundary analysis detects inputs/outputs from crossing connections
- getInstantiationTemplate: unique ID remap, auto-incremented instance labels
- MacroLibraryPanel: list, select, delete macros; insert mode on click
- macroFlattener: strips library from project export (Vivado sees only gates)
- project.macros persists in project JSON; round-trip stable
- no live instance propagation, no parametric macros, no recursive macros (v2)
```

---

## Merge Order Decision Point

```
State machine:

Hardware UX complete?
  └─ Yes → Merge hardware immediately
  └─ No  → Fix remaining issues, re-check 10-click proof

Verify redesign complete?
  └─ Yes, all criteria pass → Merge verify next
  └─ No, any criterion fails → Do NOT merge; fix failing criterion first

Macro foundation stable?
  └─ pasteCluster/clone reliable → proceed
  └─ Any ID collision or dangling edge → PAUSE, fix foundation first
Macro v1 scope correct?
  └─ Saved Block Templates only → proceed to merge
  └─ Live propagation or parametric → SIMPLIFY before merge
  └─ Both checks pass → Merge macros third
```

---

## Gate Baseline

Both gates were PASS at session start (2026-03-11):
- `pnpm run ide:gate:verify-workbench-contract` → PASS
- `pnpm run ide:gate:student-loop-contract` → PASS

Both gates must be PASS after every track merges.

---

*These checklists are binding. If a check fails, fix before merging. Do not merge-and-fix-forward.*
