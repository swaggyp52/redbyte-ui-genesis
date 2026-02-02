# RedByte OS Phase 9 Redirect — Canonical Rebuild Prompt

## Intent
Build a fully functional, high‑fidelity operating system for student circuit design and lab execution. The system must feel powerful, precise, layered, and visually expressive — not minimal, broken, or one‑dimensional.

## Vision Summary
### The OS
- Window-based desktop environment (responsive like macOS/Windows)
- Users can open, move, stack, and manage windows without lag, misalignment, or broken drag logic
- Every dock icon launches a working, meaningful application (no placeholders, no dead ends)

### Core Labs (Trio)
1. **Logic Playground**
   - Schematic Editor
   - Truth Table
   - Verilog Editor
   - Oscilloscope
   - 3D Logic View
   - All panels are coequal and synchronize state across views

2. **2D Lab**
   - Physical hardware interaction layer
   - Talks to connected boards (Arduino, Basys3)
   - Simulates IO in absence of hardware
   - Mirrors state from Playground and vice versa

3. **3D Lab**
   - Visualization layer for hardware circuits and components
   - Shows activity on connected boards
   - Syncs with 2D Lab and Logic Playground
   - Shares IO mapping and view state

These three labs must cohere. Changes in one must reflect everywhere.

---

## Assessment Tasks
1. **Functional Integrity Check**
   - Which apps launch?
   - Which views respond and update as intended?
   - Do changes in one view update others?

2. **Synchronization Audit**
   - Are Logic Playground, 2D Lab, and 3D Lab synchronized via shared project state?
   - Is the unified store truly canonical?

3. **Hardware IO Layer**
   - Can a user interact with physical boards or simulated IO without failure?
   - Is the system aware of connected boards?
   - Does live hardware interaction propagate correctly to UI views?

4. **Window System Fidelity**
   - Windows move freely without glitching
   - z‑index, snapping, focus, resizing behave like a modern OS
   - `WindowShell` used consistently with error/loading/empty states

5. **Visual Identity and Style**
   - UI reflects power, depth, and hierarchy
   - Themes applied correctly across components
   - Apps feel polished and distinct

6. **Dead Ends and Broken States**
   - No buttons/icons/options that lead nowhere
   - No dock apps that fail to load or crash silently
   - Any non‑functional UI is removed or clearly marked as future/disabled

7. **Determinism & Debuggability**
   - Inputs lead to consistent, inspectable results
   - `.rbx.zip` capsule captures all logic/state to re‑import and replay a session

---

## Diagnostic Summary (Current Drift)
- **Window chrome inconsistency**: `WindowShell` exists but is unused, so app chrome is inconsistent.
- **Trio visibility gap**: Dock exposes Logic Playground + Lab, but not 3D Lab; core trio not surfaced as coequal.
- **Unified project state is present but not singular**: local/legacy stores still coexist, risking drift.
- **IO mapping fragmentation**: multiple schemas (`boardMap`, `ioMapping`) create cross‑app mismatch risk.
- **Evidence capsule path is implemented** but not uniformly enforced as the canonical export across all app flows.

---

## Phase 9 Recovery Plan
### 1) Canonicalize the trio in the OS surface
- Dock + Launcher must present Logic Playground, 2D Lab, 3D Lab as core, first‑class apps.
- Remove or explicitly disable any non‑functional dock items.

### 2) Enforce unified project state as the single source of truth
- Replace legacy/local circuit stores with adapters that read/write from unified project state.
- Standardize IO mapping schema and migrate all labs to it.
- Ensure cross‑app updates are bi‑directional and deterministic.

### 3) Apply OS chrome contract everywhere
- Wrap all apps in `WindowShell` (or a unified shell component).
- Error/loading/empty states must be visible and consistent.

### 4) Normalize the determinism pipeline
- All apps must export/import the same capsule format.
- Recordings/proof packs must be part of unified project state on export.

### 5) Remove or quarantine dead ends
- If visible, it must work; if it does not work, remove or mark as future/disabled.

### 6) Visual identity pass
- Apply tokens and themes consistently to reinforce depth, hierarchy, and clarity.

### 7) Verification gate
- Add targeted tests for:
  - Window focus/z‑index
  - Cross‑panel sync (schematic ↔ HDL ↔ oscilloscope ↔ 3D)
  - Capsule round‑trip integrity

---

## Values
- **Determinism**: The system should behave like the logic it teaches.
- **Responsiveness**: The OS should feel alive, not sluggish.
- **Cohesion**: No silos between apps — one circuit, many synchronized views.
- **Visual Clarity**: It must look excellent, not minimalist. Identity matters.
