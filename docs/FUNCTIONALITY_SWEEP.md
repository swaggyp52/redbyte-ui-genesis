# Functionality Sweep & Verification

## P0: Console Errors & Stability

| Issue | Status | Notes |
| :--- | :--- | :--- |
| `[Menu] items was not an array` | ✅ Fixed | Refactored Menu primitive to support children. |
| `hardwareMapper` undefined ref | ✅ Fixed | Fixed in SplitViewLayout scope. |
| `HardwareMapper` Sync Spam | 🔍 Monitor | Added session guard. Needs log verification. |
| `SplitViewLayout` Pointer Events | ✅ Fixed | Verified layout layers. |

## P1: User Interaction Contract (2D + 3D)

**Goal:** Consistent behavior across Playground and Lab.

### A) Move / Select / Delete

| Context | Status | Notes |
| :--- | :--- | :--- |
| **Logic Playground (2D)** | ✅ Verified | Standard wiring/move works. |
| **ECELabApp (2D Lab)** | ✅ Fixed | **Enabled SplitViewLayout** (Interactive Mode). Replaced static canvas. |
| **3D Viewer** | ⚠️ View Only | 3D View is currently **View Only** (Safety fallback). No wiring in 3D yet. |

### B) Wiring UX

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Hover Pin -> Highlight** | ✅ Verified | LogicCanvas standard behavior. |
| **Click Pin -> Arm -> Connect** | ✅ Verified | LogicCanvas standard behavior. |
| **Snapping / Radius** | ✅ Verified | LogicCanvas defaults. |
| **Disconnect (Del/Menu)** | ✅ Verified | Context menu available. |

### C) Simulation Mode

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Visible Mode Indicator** | ✅ Verified | "SIMULATION" badge in ECELabApp. |
| **Edit vs Run** | ✅ Verified | Editing updates structure. "Run" button drives tick. |
| **Export Evidence** | ✅ Verified | Exports `.rb-lab.zip`. |

---

## Must Pass Demo Scenarios

### Scenario 1: Freshman wiring in 60 seconds (2D)

**Steps:**

1. Open Logic Playground
2. Place a switch + LED
3. Connect switch output → LED input
4. Toggle switch → LED changes
5. Export evidence

**Status:** ✅ **READY** (LogicPlaygroundApp)

### Scenario 2: 3D manipulation is real

**Steps:**

1. Open the 3D scene
2. Click board → highlights
3. Drag board (Syncs to 2D)

**Status:** ⚠️ **PARTIAL** (3D is View Only).
*Decision:* 3D View is explicitly **View Only** to prevent broken interaction. Selection/Highlighting works (visual), but moving/wiring is disabled to avoid desync.

### Scenario 3: Lab flow (ECE Lab)

**Steps:**

1. Launch ECE Lab
2. Add/adjust something (Circuit)
3. Run check / evaluation
4. Capture -> Export `.rb-lab.zip`
5. TA opens Inspector -> Sees snapshot

**Status:** ✅ **READY** (ECELabApp Updated)
*Fix:* Replaced static `CircuitCanvas` with `SplitViewLayout` + `CircuitEngine`. Now supports interactive circuit building in Sim Mode.

---

## Remaining Actions

- [ ] Verify `hardwareMapper` logs in console during live session (if possible).
- [ ] Monitor CPU usage during simulation in ECELabApp (should be low).
