# Product Hardening Ticket — Student journey cross-surface friction audit (Phase 2 breadth)

## Ticket

- **Title:** Cross-surface student journey — friction map + top export-path fix
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** Full IDE (Project, Design, Verify, Hardware, Export, shared state)
- **Journey segment:** Basys3 class flow — design → verify → map → hardware → export
- **Environment:** Playwright + `vite preview` (Chromium); local dev server `127.0.0.1:4173/os/`
- **Linked GitHub issue:** (none)

## Runtime journey used (audit)

1. **Build** `pnpm --filter @redbyte/playground build` (preview serves `/os/`).
2. **E2E smoke:** `tests/e2e/ide-mapping-pipeline-coherence.spec.ts` — **Flow A** (`signal-tour`): load starter → Verify (Run) → Project Map Pins (set `V18` on SW0) → Hardware Map tab (pin matches) → Export (body contains `V18`). **Flow B** (`two-bit-counter`): sequential/clock context, Hardware shows `ide-hw-map-row-clk`.
3. **Code-path review:** Export **Readiness gates** → **I/O Mapping** row action when mapping is failing.

## Surface-by-surface blocker register

### Project / startup

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-3 | Restored `currentMode` vs first paint | Restore | Prior matrix (2026-04-22): meta `design`, UI sometimes Project | Restore vs `startupMode` ordering | Confusing first screen | Audit `IdeApp` restore path |

### Design

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-3 | “Verify: stale” chip noise on active work | Edit after verify | Design shows `dirtySinceVerify` (by design) | Compare hash model | Students think they broke something | Already student copy in places; optional tone pass |

### Verify

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-2 | Trace vs Compare discoverability | First verify on starter | E2E uses Run if visible; compare vs observe is a mode | Run plan complexity | Can complete trace without “real” check | Rely on `ide-vcb-use-saved-checks` / product QA |

### Project / Map Pins

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-2 | Authority split (Project table vs Map Pins in Hardware) | Mapping | E2E uses Project `ide-project-map-input-*` | Two UIs, one authority | Cognitive load | Docs + left-rail language already; optional unify |

### Hardware

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-3 | Stage / dock density | Board prep | Surface has many panels | Information architecture | Overwhelming on first visit | Triage with classroom feedback |

### Export

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| **SEV-1** | **“Fix Mapping” gate only scrolls inside Export** | Student on Export, I/O mapping gate **NEEDS FIX**, product copy says Project/Map Pins is authority | `ExportSurface` gate `onAction` was `mapSectionRef.scrollIntoView` only; `onGoToProject` exists but unused for this CTA | Gate wired to in-page scroll, not **mode switch** to **Project (Map Pins)** | Student clicks **Fix Mapping**, stays on Export, pin table is not the primary place to fix authority mapping — **feels like the app is broken**; export stays blocked | **This slice — navigate to Project when mapping gate is fail + external authority** |

### Cross-surface / shared

| Sev | Title | Workflow | Evidence | Root cause | Why it matters | Next action |
|-----|-------|----------|----------|------------|----------------|-------------|
| SEV-2 | Hardware `mappingReady` (clock/outputs) vs Export pin `required` counts | Map → Export | Different derivations in `HardwareSurface` vs `buildExportViewModel` | Layered rules | Could diverge in edge cases | Future harmonization test matrix |

## Chosen top blocker (this slice)

**SEV-1 — Export Readiness gate “Fix Mapping” does not take students to Project / Map Pins** when the product is in **Project mapping authority** mode (`onUpdateMappingPin` set). Highest impact on **“unexportable / stuck”** reports: the UI advertises a fix action that does not complete the loop to the **authoritative** surface.

## Reproduction (post-fix)

1. Open a project with **incomplete** or **invalid** I/O mapping (e.g. missing output in `ioMapping` while HDL has port — `RBEX1001` path in `exportSurface.trust-clarity` fixtures).
2. Open **Export** → expand **Readiness gates** → **I/O Mapping** shows **NEEDS FIX**.
3. Click **Open Project — Map Pins** (or **Fix Mapping** when not authority) → expect **Project** mode and ability to complete Map Pins.

## Disposition

- **Status:** fixed in slice (code + test)
- **Fix:** In `ExportSurface`, mapping gate: if mapping gate is failing and external mapping authority is active, call `onGoToProject()`; otherwise keep scroll-to-pin-table behavior.

## Attribution

Connor Angiel
