# RedByte Capability Audit (Phase 0)

**Date:** 2026-02-01  
**Scope:** Documentation vs implementation reconciliation for lab readiness

---

## Executive Summary

The documentation promises a unified, deterministic, multi-view lab platform with evidence capsules, replay verification, and hardware pipeline support. The codebase contains partial implementations for these claims, but key integrations remain incomplete. The largest drift is between the legacy `ProjectContext` architecture described in docs and the current package-based app/store design.

---

## Canonical State Owner (Current)

- **Logic Playground** owns circuit state internally and persists to the file system (`useFileSystemStore`) using `.rblogic` files.
- **Determinism recording** is local to Logic Playground (`useDeterminismRecorder`), not yet unified with `LabProjectV1`.
- **LabProjectV1** and evidence capsules exist in `rb-lab-engine`, but are not yet the canonical in-app source of truth.

**Implication:** There is no single canonical store used by Playground + Lab + 3D. Phase 2 unification is required.

---

## Evidence Capsule / Proof Pack Status

- **Evidence capsule export/import** exists in `rb-lab-engine` and is wired in `rb-shell` (Truth Bar + Command Palette).
- **Integrity verification** is implemented (`manifest.json`, `capsule.json`, `project.json` hashes).
- **Proof pack** logic exists in `rb-apps` but is not integrated with the new capsule export path.

**Implication:** Capsule pipeline works but is not yet the unified export for all apps or proof pack workflows.

---

## Demo URIs (rb://demo)

- **User Manual** handles `rb://demo/*` links and opens Logic Playground with `initialExampleId`.
- **Examples registry** exists in `rb-apps/src/examples` and is used by the manual.

**Status:** ✅ Demo URIs work via manual link handler.

---

## Bitstream / Hardware Pipeline

- **rb-fpga-toolchain** includes Vivado flow with bitstream generation and status parsing.
- **Docs** describe a One-Command Runner, but no UI-level command exists in shell or apps.

**Implication:** Toolchain is present but not wired to the app surface.

---

## Documentation Drift

Docs (e.g., `ARCHITECTURE.md`, `PROJECT_MODEL.md`) describe a `src/os/context/ProjectContext` architecture that does not match the package layout used by the current OS shell (`packages/rb-shell`, `packages/rb-apps`, `packages/rb-lab-engine`).

**Action Needed:** Update docs to reference the current package architecture and canonical state plan.

---

## Gap List (High Priority)

1. **Unified Project Store**: No single LabProject-driven store used by Playground/Lab/3D.
2. **Import Landing**: Import loads into filesystem but only covers Playground; no Lab/3D sync.
3. **Recordings**: Proof/recordings exist but not captured in the new capsule export path.
4. **IO Mapping**: Placeholders exist, but no shared IO mapping UI or 2D/3D sync.
5. **Docs Drift**: `ProjectContext` references are outdated vs package layout.

---

## Recommended Next Actions

1. **Phase 1:** Finalize `LabProjectV1` as canonical store and migrate Playground state to it.
2. **Phase 2:** Implement adapters for Playground/Lab/3D views and live sync.
3. **Phase 3:** Replay verification wired into `Project: Verify Reproducibility`.
4. **Phase 4:** Add IO mapping UI and bind to 2D/3D views.
5. **Docs:** Update architecture and project model docs to the current package structure.

---

## References (Evidence)

- `packages/rb-lab-engine/src/services/exportService.ts` — Capsule export/import
- `packages/rb-shell/src/TruthBar.tsx` — Export control
- `packages/rb-shell/src/Shell.tsx` — Import handler + command palette
- `packages/rb-apps/src/apps/UserManualApp.tsx` — rb://demo link handling
- `packages/rb-fpga-toolchain/src/vivado.ts` — Bitstream generation
- `docs/ARCHITECTURE.md`, `docs/PROJECT_MODEL.md` — legacy ProjectContext references
