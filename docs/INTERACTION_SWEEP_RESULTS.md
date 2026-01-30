# Interaction Sweep Results (Phase 7)

**Date:** Jan 30, 2026
**Version:** Phase 7 Candidate

## 1. 2D Interaction (Editor)

| Feature | Status | Fix/Notes |
| :--- | :--- | :--- |
| **Drag Nodes** | **PASS** | Handled by `LogicCanvas` interaction mode. |
| **Wiring** | **PASS** | Snap-to-grid enabled. "First Wire" toast added. |
| **Delete** | **PASS** | Backspace/Delete key works. |
| **Validation** | **PASS** | `normalizeConnection` ensures Output->Input direction. |

## 2. 3D Interaction (Viewer)

| Feature | Status | Fix/Notes |
| :--- | :--- | :--- |
| **Read-Only** | **PASS** | Dragging disabled. Toast: "Switch to 2D view to edit". |
| **Sync** | **PASS** | 3D view subscribes to 2D engine state (React `use3DEngineSync`). |
| **Badge** | **PASS** | "3D VIEW (READ-ONLY)" badge verified. |

## 3. "Can't Move Boards" Issue

**Diagnosis:** User confusion between "Panning the View" vs "Dragging the Board".
**Resolution:**

* Nodes are draggable by header/body.
* Space+Drag pans the canvas.
* Added "Pan Mode" cursor cues.

### 3. Deployment Architecture (Fixed)

* **Root Domain:** Serves `manual-site` (Documentation/Landing).
* **`/os/` Path:** Serves `playground` (The Actual OS).
* **Deep Links:** `index.html` at root auto-redirects `?lab=...` to `/os/?lab=...`.

### 4. Trust & Polish (Phase 7.5)

* **Debug Gates:** Hidden `BridgeDebugPanel` and Inspector debug labels in production builds (`import.meta.env.PROD`).
* **Verification:** `verify-deploy.mjs` updated to validate OS at root and Docs at `/docs`.

## 5. Packaging & Startup

| Feature | Status | Fix/Notes |
| :--- | :--- | :--- |
| **Preview** | **FIXED** | Root `preview` script now correctly targets `apps/playground`. |
| **Install** | **FIXED** | `Start-RedByte.ps1` automates build & launch. |
| **Install** | **FIXED** | `Start-RedByte.ps1` automates build & launch. |
| **Trust** | **FIXED** | Build SHA shown in UI to prevent version drift. |

## 5. Local Fresh Install (Simulated)

| Step | Status | Notes |
| :--- | :--- | :--- |
| **Clean Install** | **PASS** | `Start-RedByte.ps1` installs deps, builds, launches. |
| **ECE Lab Load** | **PASS** | Loads correctly. |
| **Drag/Drop** | **PASS** | Nodes move correctly. |
| **Wiring** | **PASS** | Wires snap and validate. |
| **Export** | **PASS** | `.rb-lab.zip` generated. |
| **Import** | **PASS** | Inspector reads file correctly. |

## Remaining Limitations (Verified)

1. **Zoom:** 3D View camera controls are separate from 2D Zoom (this is intentional but worth noting).
2. **Performance:** Large circuits (>500 nodes) may drop FPS in 3D (Sim still runs 60Hz).
