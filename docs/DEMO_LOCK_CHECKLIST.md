# Demo Lock Checklist

**Goal:** Ensure RedByte OS is ready for public demo and classroom use.

## 1. Deployment Truth

- [x] **Build JSON:** `https://redbyteapps.dev/build.json` returns valid JSON with SHA.
  - ✅ **PASS:** Verified via `verify-deploy.mjs` (SHA: `b2ebd0d`).
- [x] **Badge:** Website Home shows "Build: [SHA]".
- [x] **Badge:** OS Start Here shows "Build: [SHA]".
- [x] **Deep Link:** `https://redbyteapps.dev/?lab=lab-0` loads Lab 0 directly.

## 2. Friend Laptop Validation (No Repo)

- [ ] **Clean Browser Check:**
  - Open `https://redbyteapps.dev/students` -> Verify "Install Guide" text present.
  - Open `https://redbyteapps.dev/lab-0` -> Verify OS loads.
  - Open `https://redbyteapps.dev/build.json` -> Verify JSON content (not HTML).
  - Check Footer/Home for "Build: [SHA]" tag.

## 2. Environment Gates

- [ ] **Web Demo:** Hardware Panel shows "Simulation Only" overlay.
- [ ] **Local Install:** Hardware Panel allows "Verify Device" (with Bridge running).

## 3. Interaction Contract (Student)

- [ ] **Playground:** Drag/Drop gates works (2D).
- [ ] **Playground:** Wire connections snap and stick.
- [ ] **3D View:** Read-only toast appears on drag. badge visible.
- [ ] **Sync:** Toggling Input in 2D updates 3D view immediately.

## 4. Classroom Flow

- [ ] **Export:** Clicking "Snapshot Evidence" creates `.rb-lab.zip`.
- [ ] **Inspector:** Dragging `.rb-lab.zip` into Submission Inspector shows all metadata.
- [ ] **Lab 0:** "Load Starter Circuit" works (ECELab).

## 5. Local Packaging

- [ ] **Launcher:** `.\Start-RedByte.ps1` runs successfully on fresh clone.
- [ ] **Preview:** `pnpm preview` runs without "dist missing" error.
