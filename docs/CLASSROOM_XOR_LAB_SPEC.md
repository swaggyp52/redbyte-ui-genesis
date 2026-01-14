# RedByte Classroom: First-Week XOR Lab Flow

**Status:** Specification (Not Code Yet)  
**Date:** 2026-01-14  
**Scope:** One-hour student workflow, no instructor rescue required  
**Success Criteria:** Freshman can build, test, save, reload, and explain XOR gate in ≤60 minutes

---

## 1. Student Story (The Exact Task)

A student arrives with zero prior circuit experience.

They should be able to:

1. **Load the app** → See only what they need (schematic view, logic inspector, controls)
2. **Load XOR template or blank canvas** → No decisions, clear starting state
3. **Place logic gates** → AND, OR, NOT, XOR (drag-drop or palette)
4. **Wire them** → Connect outputs to inputs, visual feedback
5. **Set inputs** → Toggle switches A and B
6. **Observe outputs** → Logic inspector shows A, B, and output values
7. **Step simulation** → Advance one tick at a time, see state change
8. **Understand the result** → "When A=1 and B=1, output is 0 ✓"
9. **Save the circuit** → "My XOR" filename, one click
10. **Reload the circuit** → Load "My XOR", exact same state
11. **Export evidence** → Screenshot showing final circuit and truth table
12. **Reset and repeat** → One click, back to blank or template
13. **Finish in ≤60 minutes** → No wait, no confusion, no crashes

At no point should they need:
- Instructor help
- Stack trace reading
- Configuration choices
- Page reloads
- Advanced views

---

## 2. App Entry Point (The Gate)

**URL:** `/?mode=beginner&example=xor`

**What loads:**

```
┌─────────────────────────────────────────┐
│  RedByte Logic Lab — XOR Gate            │
│  [← Back to Home] [Reset] [Load Example] │
├─────────────────────────────────────────┤
│                                           │
│  [Schematic View + Gate Palette]         │
│  (drag gates, draw wires)                │
│                                           │
├─────────────────────────────────────────┤
│  Simulation Controls:                     │
│  [⏸ Pause] [⏭ Step] [▶ Run] [⏹ Stop]  │
│                                           │
│  Inputs:  A: [Toggle]  B: [Toggle]       │
│  Output:  Y: [0]                         │
│                                           │
│  Truth Table (Auto-updated):             │
│  A  B  Y                                  │
│  0  0  0 ✓                               │
│  0  1  1 ✓                               │
│  1  0  1                                  │
│  1  1  0                                  │
└─────────────────────────────────────────┘
```

**What is NOT visible:**
- Quad view
- 3D view
- Oscilloscope
- Advanced inspector tabs
- Performance graph
- Module sidebar
- Settings

**What is locked/disabled:**
- Cannot open other views (404 or clear message: "Available in Advanced mode")
- Cannot switch to advanced without explicit action
- Cannot access unsupported features

---

## 3. Views and Features (In / Out for Week 1)

### ✅ EXPLICITLY IN (Required)

| Feature | Why | Constraint |
|---------|-----|-----------|
| Schematic view | Core teaching tool | No panning/zoom advanced features |
| Logic inspector | See node values | Values only; no waveform history |
| Toggle inputs | Test the circuit | A, B, output Y only |
| Step simulation | Understand determinism | One tick at a time, no auto-run |
| Play simulation | See behavior sequence | Max 10 ticks auto-run before pause |
| Save circuit | Reproducibility | One-click, auto-named "My XOR" |
| Load circuit | Verify persistence | Load saved or pre-built examples |
| Reset to blank | Recovery path | One-click, no warning |
| Load known-good | Recovery path | "Load XOR Template" button |
| Screenshot export | Evidence submission | Image of schematic + truth table |
| Simple error messages | Clarity | "Feedback loop detected — simulation paused" |

### ❌ EXPLICITLY OUT (Deferred to Advanced)

| Feature | Why Not Week 1 | When Available |
|---------|-----------------|-----------------|
| Quad view (build/analyze/simulate/design) | Cognitive overload | After student completes 3+ labs |
| 3D circuit view | Nice-to-have, not essential | When circuit size > 10 nodes |
| Oscilloscope / waveform view | Intermediate concept | Week 3+ |
| Multi-window layouts | Advanced workflow | Never, unless student requests |
| Free-form mode switching | Navigation burden | Mode is locked per URL |
| Realtime animation | CPU heavy on weak laptops | Step-only mode by default |
| Advanced settings (tick rate, etc.) | Distraction | UI-less; hardcoded defaults |

---

## 4. Guardrails (Concrete Limits)

### Circuit Complexity Limits

| Limit | Threshold | Action |
|-------|-----------|--------|
| Max nodes | 20 | Warn: "Circuit has many nodes — 3D disabled" |
| Max fan-out per node | 6 | Warn: "Node has many outputs — performance may degrade" |
| Max simulation ticks (play mode) | 10 | Auto-pause after 10 ticks |
| Feedback loop detection | Combinational or cyclic | Pause simulation, show error |

### Performance Degradation (Automatic)

```
Circuit size ≤ 5 nodes  → Full features (schematic, logic inspector, animation)
Circuit size 6–15 nodes → Disable 3D preview, keep animation
Circuit size 16–20 nodes → Step-only mode, disable animation, show warning
Circuit size > 20 nodes → Disable save, show "Simplify circuit" message
```

### Student-Facing Guardrails (UI Level)

- Cannot create gates beyond palette (no free drawing)
- Cannot delete gates that are wired (must disconnect first)
- Cannot create duplicate node IDs
- Cannot export if circuit has warnings (feedback loops, etc.)
- Cannot switch to other modes without explicit "Unlock Advanced Mode" action

---

## 5. Error Messages (Student vs. Instructor)

### Rule: Students Get Explanations, Instructors Get Diagnostics

#### Example 1: Feedback Loop

**Student sees:**
```
⚠️ Feedback Loop Detected

This circuit has a circular connection:
Gate A → Gate B → Gate A

Simulation paused. Check your wiring and try again.
```

**Instructor (expand details) sees:**
```
Technical Details:
- Cycle detected at nodes: AND_1 → OR_2 → AND_1
- Combinational loop (no delay elements)
- Tick cost exceeded at tick 3
- Ring buffer: [tick=2, values={...}, tick=3, aborted]
```

#### Example 2: Performance Warning

**Student sees:**
```
⚠️ Circuit May Be Slow

You have 18 gates and complex wiring.
Step mode recommended for this size.

[Use Step Mode] [Try Anyway]
```

**Instructor (expand details) sees:**
```
Performance threshold exceeded:
- Node count: 18 (limit: 20)
- Fan-out max: 5 (limit: 6)
- Estimated ticks/sec: 8 (target: 30+)
- Recommendation: Disable 3D, use step mode
```

#### Example 3: Save Error

**Student sees:**
```
Cannot Save

Your circuit has feedback loops that may cause issues.
Fix the errors and try again.

[Show Issues] [Save Anyway]
```

**Instructor (expand details) sees:**
```
Save-blocking errors:
- Combinational loop at: AND_1 → OR_2 → AND_1 (tick cost: 523ms)
- Cannot guarantee deterministic replay with this issue
- File would be saved but marked [UNSTABLE]
```

---

## 6. Recovery Paths (The Hard Requirement)

### Path 1: "My Circuit Feels Broken"

**Button:** `[Reset to Blank]`

**Action:**
- Clear circuit immediately
- App stays open
- Cursor ready to place new gates
- No reload, no warning, instant
- No loss of previous saves (previous "My XOR" still in history)

**Time to recovery:** <1 second

### Path 2: "I Want to Start Over With a Template"

**Button:** `[Load Example] → [XOR Gate Template]`

**Action:**
- Pre-built XOR circuit loads
- All gates and wires visible
- Ready to run/step
- Student can modify or re-save as new file

**Time to recovery:** 2 seconds

### Path 3: "I Saved Something, Where Is It?"

**Button:** `[Load Circuit]`

**Action:**
- List of saved circuits (local storage)
- Click to load instantly
- Reload button to verify it's the same

**Time to recovery:** 3 seconds

### Path 4: "I Closed the Browser By Accident"

**Expected behavior:**
- LocalStorage persists
- Student returns to same URL
- Previous circuit auto-loads
- Can resume immediately

**Time to recovery:** Page refresh

**No path should require:**
- Instructor intervention
- Reload cascade
- "Clear browser cache"
- Account recovery
- Lost work

---

## 7. Save/Load/Export Contract

### Save (.circuit file format)

```json
{
  "id": "xor-gate-v1",
  "name": "My XOR",
  "timestamp": "2026-01-14T14:23:45Z",
  "circuitData": {
    "nodes": [
      {"id": "AND_1", "type": "AND", "pos": [100, 100]},
      {"id": "OR_1", "type": "OR", "pos": [200, 100]},
      ...
    ],
    "wires": [
      {"from": "AND_1", "to": "OR_1"}
    ]
  },
  "metadata": {
    "nodeCount": 8,
    "hasLoop": false,
    "estimatedTickTime": 45
  }
}
```

### Load
- Restore exact state (no drift)
- Verify determinism (run with same inputs, check output hash)
- Show load timestamp

### Export to Screenshot
- Schematic view (circuit diagram)
- Input state (A, B values)
- Truth table (all 4 rows, marks which are satisfied)
- Timestamp

---

## 8. Feature Flags / URL Params (The Gate Mechanism)

```
/?mode=beginner
  ↓
  - Loads Beginner view only
  - Can't access advanced features
  - Simplified UI

/?mode=beginner&example=xor
  ↓
  - Loads Beginner view
  - Pre-loads XOR template
  - Ready to go

/?mode=advanced
  ↓
  - Unlocks quad view, 3D, oscilloscope
  - Student must explicitly opt-in
  - Can toggle back to beginner
```

---

## 9. UX Specifics (Micro-Decisions)

### Gate Palette (Draggable)

**Available gates:** AND, OR, NOT, XOR (only)

**Unavailable (grayed out):** NAND, NOR, XNOR, (any advanced gates)

**Why:** XOR can be built from AND/OR/NOT; including XOR directly avoids "just use the answer" problem

### Wiring Feedback

**While dragging:** Highlight valid drop zones (input pins)

**On connect:** Show data flow (output → input, directional)

**On error:** "Can't connect output to output" (red flash, not a warning dialog)

### Simulation Playback

**Step mode:** "Current tick: 0 / 10"

**Play mode:** Auto-advance 1 tick/sec, show "Paused after 10 ticks"

**Stop:** Return to tick 0, reset inputs

---

## 10. Known Limitations (Acknowledge Them)

These are out of scope for Week 1, but should be documented:

- **Multi-gate logic blocks:** Students can't define custom gates (later)
- **Timing analysis:** No propagation delay modeling (later)
- **Advanced testbenches:** No randomized input sequences (later)
- **Circuit library sharing:** No upload/download from server (scope: local only)
- **Collaboration:** Single-user only (later, if at all)

---

## 11. Measurement / Success Criteria

### Week 1 Lab is Complete When:

- [ ] Beginner mode loads without advanced features visible
- [ ] XOR template loads and is ready to run
- [ ] Student can place 5+ gates, connect them, see output toggle
- [ ] Step simulation works (A=0, B=0 → Y=0, then A=0, B=1 → Y=1, etc.)
- [ ] Reset button clears circuit in <1 second
- [ ] Save/Load round-trip preserves exact state
- [ ] Screenshot export shows circuit + truth table
- [ ] No stack traces or internal errors visible to student
- [ ] All errors are rephrased in student-facing language
- [ ] Classroom test: Freshman completes task in ≤60 minutes, no instructor help

### Metrics to Track (Post-Launch)

- Time to first gate placement
- Time to first successful simulation
- Number of resets per student
- Number of save/load cycles
- Error message frequency (which ones appear most?)
- Browser close → return rate (does localStorage work?)

---

## 12. Out-of-Scope (Explicitly Not This Spec)

- Account logins
- Multiplayer / collaboration
- Server-side persistence
- Grading integration
- LMS connectors
- Mobile optimization (web only, for now)
- Accessibility audit (do later, separately)

---

## 13. Implementation Roadmap (Derived From This Spec)

Once this spec is locked, implementation can proceed in this order:

1. **Week 1:** URL routing, Beginner mode gate, hide advanced views
2. **Week 2:** Load XOR template, simplified logic inspector
3. **Week 3:** Save/Load local storage
4. **Week 4:** Reset, known-good recovery paths
5. **Week 5:** Error message taxonomy + UI
6. **Week 6:** Guardrails + performance degradation
7. **Week 7:** Screenshot export
8. **Week 8:** Classroom dry-run, iterate based on feedback

---

## 14. Questions This Spec Answers

**Q: Can a student get stuck?**  
A: No. Reset clears the circuit instantly. Load Example restores known-good state. LocalStorage persists.

**Q: What if the circuit is too complex?**  
A: Automatic step-only mode at 15+ nodes. Save is blocked at >20 nodes with clear message.

**Q: What errors can a student see?**  
A: Feedback loops, performance warnings, save-blocking issues. All phrased in student-friendly language. Instructor can expand for diagnostics.

**Q: How do I know the circuit behaves the same after reload?**  
A: Deterministic simulation + exact state round-trip. Same inputs = same outputs, every time.

**Q: What if the laptop is slow?**  
A: Automatic degradation (disable animation, use step mode). Circuit still works, just slower.

**Q: Can the student break the app?**  
A: No. All state is isolated. Reset always works. No server state to corrupt.

---

## Sign-Off

This spec is the forcing function. Everything we build must serve this story.

If a feature doesn't fit this spec, it gets deferred or removed.

If a student can't complete the task in 60 minutes, we iterate the spec, not the student.

**Next step:** Lock this spec, then start building.
