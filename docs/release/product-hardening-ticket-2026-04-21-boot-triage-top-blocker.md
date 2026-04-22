# Product Hardening Ticket — Boot triage / top blocker (left rail contract)

## Ticket

- **Title**: SEV-1 — IDE shell left rail width breaks release gates (boot/layout contract)
- **Date**: 2026-04-21
- **Owner**: Agent / Connor Angiel
- **Surface**: Global shell / workflow spine (`IdeLeftRail`, `ide-root.css`)
- **Journey segment**: First paint / default IDE load (`/?mode=*`, fresh and with onboarding suppressed)
- **Mode**: All modes (rail is global)
- **Environment**:
  - Fresh machine / clean browser profile: yes (Playwright gate uses clean preview + init script for onboarding)
  - OS: Windows 10
  - Browser: Chromium (Playwright)
  - Node: per repo
  - pnpm: per repo
- **Obsidian note**: (not used for evidence)
- **Linked GitHub issue**: #77 (SEV-1 boot stabilization — `gh` unavailable in env; scope aligned to issue intent)

## Tiny risk register (this triage, runtime + gates)

| Tier | Title | Evidence | Likely root cause | Student impact | Action |
|------|-------|----------|-------------------|----------------|--------|
| SEV-1 | Left rail width breaks shell/layout gates | Gate measured **92px** rail | Late `ide-root.css` set `--ide-rail-width: 92px` over Phase 7 **72px** | Density/workbench space wrong vs documented shell; gates red | Align token to **72px** (this slice) |
| SEV-2 | `repo:status` / ZIP import gate red (pre-existing) | `AI_STATE.md` notes IDE ZIP import contract fail | Separate import fixture/contract drift | Instructor/import path trust if gate stays red | Own in a follow-up slice; do not conflate with rail |
| SEV-3 | Duplicate `:root[data-redbyte-mode='ide']` rail tokens in CSS | Multiple `--ide-rail-width` assignments in same file | Accumulated polish passes | Future silent regressions | Consider consolidation later (out of scope) |

## Problem

- **Observed behavior (before fix)**: `ide-shell-chrome-contract` failed: left rail **92px** vs contract **68–80px** (canonical **72px**). `ide-layout-contract` also failed until aligned with **Project** having no left dock (`leftDockMode="hidden"`).
- **Expected behavior**: Default IDE shell matches documented rail width contract on first paint across modes.
- **Why this matters**: Gates are the classroom/signoff proxy; a widening rail is an unowned layout drift that breaks density contracts and can crowd the workbench on lab laptops.
- **Severity**: SEV-1 for **product recovery** (blocks honest “green gates” story for shell); not a data-loss bug.

## Reproduction

- **Exact repro steps**:
  1. `node scripts/gates/ide-shell-chrome-contract.mjs`
  2. Alternatively: `node scripts/gates/ide-layout-contract.mjs`
- **Reproducibility**: always (before fix)
- **First known version or date**: 2026-04-21 (observed in this triage)

## Evidence

- **Console excerpt**: Gate output: `left rail width must stay within range 68..80px (canonical: 72px), got 92`
- **Test / gate output**: `FAIL: IDE shell chrome contract satisfied` / `FAIL: IDE layout contract satisfied`
- **Root cause (code)**: `ide-root.css` — later `:root[data-redbyte-mode='ide'] { --ide-rail-width: 92px; }` overrides the Phase 7 baseline `72px` block.

## Truth Sources

- **Target truth**: `docs/contracts/RedByte_Product_Contract.md` §4.1 Global Shell Contract
- **Current truth**: `docs/manuals/RedByte_Product_Manual.md` §6.1 Global Shell
- **Gap truth**: `docs/roadmap/RedByte_Gap_Audit.md` (visual/runtime assessment gaps)
- **System map**: `docs/IDE_SYSTEM_MAP.md` (shell / rail ownership)
- **QA / rehearsal**: `docs/release/v1-release-checklist.md` (startup/shell expectations where referenced)

## Acceptance Proof

- **Minimum acceptance proof**: `pnpm --filter @redbyte/playground build` (gates read preview `dist`); `node scripts/gates/ide-shell-chrome-contract.mjs` → PASS; `node scripts/gates/ide-layout-contract.mjs` → PASS
- **Required test / gate command(s)**: Same as above; `pnpm --filter @redbyte/playground build` and `pnpm build:unified` still pass
- **Required manual proof**: Optional: open IDE at 1920×1080 and confirm rail does not exceed 80px width visually

## Docs Review

- **Docs reviewed**: SURFACE_CONFORMANCE, IDE_SYSTEM_MAP, product contract (shell), hardening template
- **Docs updated if behavior changes**: This ticket, `AI_STATE.md` Change Log (factual)

## Disposition

- **Status**: fixed
- **Fix PR / commit**: (see git after push)
- **Notes**: `registerAllApps` is a no-op; `ide-persistence-contract` passes. **Primary blocker**: late `ide-root.css` set `--ide-rail-width: 92px`, failing `ide-shell-chrome-contract` / rail width check in `ide-layout-contract`. **Secondary (same slice)**: `ide-layout-contract.mjs` was out of sync with product (Import not on rail; Project/Export hide dock; Design hides console until diagnostics). Gates realigned without changing app behavior.

## Attribution

Connor Angiel
