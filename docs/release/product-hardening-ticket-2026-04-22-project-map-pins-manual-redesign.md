# Product Hardening Ticket — Project Map Pins manual mapping redesign (Phase 4)

## Ticket

- **Title:** Project — Map Pins completion flow (manual mapping usability)
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** Project (Map Pins / board pin mapping section)
- **Journey segment:** After Design/Verify — finish pins before Export/Hardware
- **Environment:** Playground `/?e2e=1`, Vitest `projectSurface.*`, Playwright `ide-mapping-pipeline-coherence.spec.ts`
- **Linked GitHub issue:** #77 (recovery / trust)

## Runtime scenarios

| # | Route / path | Student goal | Pre-fix observation |
|---|----------------|--------------|---------------------|
| **A** | Load example → Project (`mode-button-project`) | Complete missing required pins | **Board pin mapping** appeared **below** Bridge, Warnings, **full command strip**, session narrative (“About this project”), optional “Try another starter” gallery — table often **below the fold**; student must scroll past narrative to find inputs |
| **B** | Same + edit SW0 pin field | See what changed / what remains | Summary strip and table work when visible; **discovery** of the editor was the bottleneck, not row status logic |
| **C** | Designs with human-facing port labels | Match ports to pins | Same: friction was **vertical placement**, not label rendering |
| **D** | Structured / non-direct rows | Understand non-editable rows | **Structured IO — edit in Design** copy already honest; not the top blocker this slice |

## Narrow blocker register (Project Map Pins manual editing only)

| Sev | Title | Workflow | Evidence | Root cause | Next action |
|-----|-------|----------|----------|------------|-------------|
| **SEV-2** | **Map Pins buried under session + examples** | First-time student opens Project to map; does not see pin table without scrolling | DOM order: Bridge → Warnings → **Command strip + long “About this project”** → optional starters → **then** mapping | Map Pins `section` lived **outside** the loaded-circuit fragment **after** all of that content | **Move** `Board pin mapping (Basys3)` to **immediately after** `ProjectWarningsPanel`, **before** command strip |
| SEV-3 | Per-keystroke `setMappingPin` + full derive | Typing in pin field may feel heavy on large designs | `onChange` → `commitMappingPin` every keystroke | Store path does clone + derive | Debounce or local draft (future slice) |
| SEV-3 | Column “Alias → package pin” vs “Pin editor” | Which column to type in | Table has six columns; third column is read-only resolved view | Naming / affordance | Clarify headers or column order (future slice) |

## Chosen blocker

**SEV-2 — Map Pins section vertical order** made manual mapping feel **missing or secondary** even though copy says it is primary. Students hit **Continue to …** and session copy before seeing the **actual input table**.

## Fix summary

- In `ProjectSurface.tsx`, render **`ide-project-panel-mapping`** **inside** the loaded-circuit branch, **after** `ProjectWarningsPanel` and **before** `ide-surface-command-stack` (primary workflow: see blockers → **edit pins** → then next-step strip).
- Remove the duplicate Map Pins block that previously rendered **after** workspace grid + examples.

## Disposition

- **Status:** fixed in slice
- **Commit:** `7b87fb2e054d9d7473193068ecfbbfdddb70e5ce`

## Attribution

Connor Angiel
