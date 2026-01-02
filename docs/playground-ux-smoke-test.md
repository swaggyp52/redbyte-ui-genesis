# Logic Playground UX Smoke Test Checklist

**Purpose**: Quick manual verification that core "buildability" workflows function correctly.
**When to Run**: After UI changes, before deployment, after dependency updates.
**Time Budget**: ~5 minutes per run.

---

## Test Environment

- [ ] Dev server running (`pnpm dev`)
- [ ] Browser console open (check for errors)
- [ ] Clear localStorage if testing fresh state

---

## 1. Component Palette → Add Node

**Goal**: Verify users can add components to canvas

### Steps:
1. [ ] **Click** an AND gate in the palette
2. [ ] Verify AND gate appears on canvas at default position
3. [ ] **Drag** an OR gate from palette to canvas
4. [ ] Verify OR gate appears at drag location
5. [ ] Check console for errors (should be clean)

**Expected**: Components add without errors, position correctly

---

## 2. Node Movement

**Goal**: Verify drag interaction works

### Steps:
1. [ ] Click and drag a node to new position
2. [ ] Release mouse
3. [ ] Verify node stays at new position (doesn't snap back)
4. [ ] Switch to Schematic view
5. [ ] Verify node position updated in schematic

**Expected**: Dragging feels responsive, changes persist across views

---

## 3. Wiring

**Goal**: Verify connections can be created

### Steps:
1. [ ] Add two gates (e.g., AND + LED)
2. [ ] Click output port on AND gate
3. [ ] Verify wire preview appears (ghost wire following cursor)
4. [ ] Click input port on LED
5. [ ] Verify connection created (visible wire between ports)
6. [ ] Switch to Schematic view
7. [ ] Verify wire appears in schematic

**Expected**: Wiring feels obvious, preview shows clearly, connections persist

---

## 4. Node Deletion

**Goal**: Verify delete interaction works

### Steps:
1. [ ] Click a node to select it
2. [ ] Press `Delete` key
3. [ ] Verify node disappears
4. [ ] Verify connected wires also disappear
5. [ ] Check circuit still renders correctly

**Expected**: Delete works immediately, no orphaned wires

---

## 5. Simulation Controls

**Goal**: Verify simulation runs and steps

### Steps:
1. [ ] Add Switch → AND → LED circuit
2. [ ] Click **Step** button
3. [ ] Verify tick count increases
4. [ ] Click **Run** button
5. [ ] Verify continuous execution (tick count increasing)
6. [ ] Click **Pause** button
7. [ ] Verify execution stops

**Expected**: Step/Run/Pause work without lag or errors

---

## 6. Switch Interaction

**Goal**: Verify input toggles propagate

### Steps:
1. [ ] Add Switch → LED circuit
2. [ ] Click switch to toggle ON
3. [ ] Verify LED lights up
4. [ ] Click switch to toggle OFF
5. [ ] Verify LED turns off
6. [ ] Check oscilloscope view shows signal change

**Expected**: Toggle feels instant, LED responds, oscilloscope updates

---

## 7. Multi-View Sync (Circuit ↔ Schematic)

**Goal**: Verify single source of truth across views

### Steps:
1. [ ] Build simple circuit in Circuit view
2. [ ] Switch to Schematic view
3. [ ] Verify all nodes + wires appear
4. [ ] Drag a node in Schematic view
5. [ ] Switch back to Circuit view
6. [ ] Verify node moved in Circuit view
7. [ ] Add a wire in Schematic view
8. [ ] Switch to Circuit view
9. [ ] Verify wire appears

**Expected**: Views stay in perfect sync, no drift or stale state

---

## 8. Save/Load (if implemented)

**Goal**: Verify persistence works

### Steps:
1. [ ] Build a simple circuit
2. [ ] Press `Ctrl+S` (or Save button)
3. [ ] Enter filename "smoke-test"
4. [ ] Verify save succeeds (no errors)
5. [ ] Clear circuit (`Ctrl+N` or New)
6. [ ] Press `Ctrl+O` (or Open)
7. [ ] Select "smoke-test.rblogic"
8. [ ] Verify circuit loads correctly

**Expected**: Save/load roundtrip preserves circuit exactly

**If not implemented**: Mark N/A

---

## 9. Half Adder Reference (Canonical Example)

**Goal**: Verify complex example circuit works end-to-end

### Steps:
1. [ ] Load Half Adder example (`03_half-adder`)
2. [ ] Verify circuit loads without errors
3. [ ] Toggle input A to 1
4. [ ] Verify Sum output = 1, Carry output = 0
5. [ ] Toggle input B to 1 (A=1, B=1)
6. [ ] Verify Sum output = 0, Carry output = 1
7. [ ] Step through simulation
8. [ ] Verify outputs update correctly on each step

**Expected**: Half Adder behaves like truth table, no simulation errors

**Truth Table**:
| A | B | Sum | Carry |
|---|---|-----|-------|
| 0 | 0 |  0  |   0   |
| 0 | 1 |  1  |   0   |
| 1 | 0 |  1  |   0   |
| 1 | 1 |  0  |   1   |

---

## Failure Modes

If ANY test fails, identify the bucket:

- **A. Pointer Events**: Clicks/drags not registering
- **B. Coordinate Math**: Nodes appear in wrong position
- **C. Rendering**: Visual glitches, missing elements
- **D. Store Updates**: Changes don't propagate to state
- **E. View Sync**: Changes in one view don't appear in another
- **F. Engine/Simulation**: Simulation produces wrong results
- **G. DOM Layering**: UI elements overlap incorrectly

---

## Pass Criteria

**All checks green** = Ship it
**1-2 failures** = Investigate and fix before deploy
**3+ failures** = Major regression, do not deploy

---

## Notes

- Run this checklist on both dev and production builds
- If testing on Cloudflare preview, verify URL routing works
- Check different browsers if time permits (Chrome, Firefox, Safari)
- Keep this checklist updated as features evolve
