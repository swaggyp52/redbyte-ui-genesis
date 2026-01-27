# RedByte UI Implementation Plan (Determinism)

This plan is ordered by impact and cohesion. Each phase is a small, reversible set of changes.

## PHASE_UI_01 - Shell Cohesion + Icon System (DONE)
- Unify icon usage via `@redbyte/rb-icons` IconMap registry.
- Standardize Dock, Desktop, and window chrome iconography.
- Add top bar with determinism indicator and System Log entry point.
- Add provenance footer in every window (app ID, resource ID, last tick).
- Remove random desktop wallpaper placement and align to a grid.

## PHASE_UI_02 - Terminal + Settings + System Log (DONE)
- Terminal MVP: deterministic command palette + core OS commands.
- Settings MVP: theme selection (RedByte Dark, Instrument), density, reduce motion, shortcuts reference.
- System Log app + store: append-only event view, export.
- Fix notification hitbox cleanup after dismiss.
- Surface determinism events into System Log.

## PHASE_UI_03 - Files + Provenance Deepening (NEXT)
- Files app: metadata panel with provenance (source app, last action tick).
- Open-with and preview surfaces wired to System Log.
- Determinism recorder: explicit capture controls in System Log.
- Add file-level audit trails to virtual FS.

## PHASE_UI_04 - Performance + Budget Enforcement (NEXT)
- Define UI performance budgets (frame time, max DOM nodes per window).
- Add UI audit tests to enforce overlay cleanup and z-index integrity.
- Log render storms and performance warnings to System Log.

## PHASE_UI_05 - Theme Engine Expansion (FUTURE)
- Add profile presets (operator, analysis, presentation).
- Theme export/import via settings.
- Accessibility checks and contrast audits.

## Validation
- Run targeted vitest suites for rb-shell, rb-apps, rb-primitives.
- Manual sanity: open/close windows, toggle themes, dismiss toasts, run terminal commands.
