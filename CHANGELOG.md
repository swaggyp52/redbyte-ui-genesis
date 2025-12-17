# RedByte OS Genesis - Changelog

## PHASE_T - Invariants (2025-12-17)

### State Invariant Enforcement

- **Invariants Contract**: Documented in AI_STATE.md
  - At most one focused window
  - Unique z-index values
  - Focused windows must not be minimized
  - Z-index values are positive integers

- **Dev-only assertion checks**: Created invariants.ts
  - assertWindowInvariants() throws descriptive errors
  - Gated behind process.env.NODE_ENV !== 'production'
  - Located in packages/rb-windowing/src/invariants.ts

- **Integrated in store**: All mutating actions check invariants
  - createWindow, closeWindow, focusWindow
  - toggleMinimize, toggleMaximize, restoreWindow
  - snapWindow, centerWindow
  - restoreSession
  - Uses setWithInvariants() wrapper

- **Bugs caught and fixed**:
  - toggleMinimize now unfocuses minimized windows (invariant violation)
  - Fixed test with invalid state (minimized + focused)
  - Updated shell-lifecycle test to expect correct behavior
  - All 201 tests passing with zero warnings

## PHASE_U - Modal UI (2025-12-17)

### Replace prompt/alert with Real Minimal OS UI

- **WorkspaceSwitcher modal**: Keyboard-first workspace selection
  - List all workspaces with arrow key navigation
  - Show current workspace indicator
  - Enter switches, Escape cancels
  - Search/filter by typing

- **MacroRunner modal**: Keyboard-first macro execution
  - List all macros with search/filter
  - Show step count in description
  - Enter executes, Escape cancels
  - Same interaction pattern as SystemSearch

- **Modal UI Contract**: Documented in AI_STATE.md
  - Keyboard-first: Arrow keys navigate, Enter selects, Escape closes
  - No focus theft: Opening modal doesn't change focused window
  - Deterministic execution: Uses same primitives as direct commands
  - Consistent styling: Matches SystemSearch / CommandPalette

- **Shell integration**: Removed all window.prompt() calls
  - switch-workspace command opens WorkspaceSwitcher modal
  - run-macro command opens MacroRunner modal
  - No browser prompts in UX
  - All 201 tests passing

## PHASE_S - CI + Release Discipline (2025-12-17)

### Continuous Integration

- **GitHub Actions CI**: Automated quality gates on PR and main branch
  - Test job: All 201 tests must pass with zero warnings
  - Build job: All packages must build successfully
  - Node 20.19.0 + pnpm 10.24.0 version lock
  - Frozen lockfile enforcement (no dependency drift)
  - pnpm store caching for fast CI runs

- **CI/CD Contract**: Documented in AI_STATE.md
  - No bypass policy: merge blocked if CI fails
  - Test + build gates mandatory before merge
  - GitHub is source of truth: green CI = shippable main

- **Release Checklist**: 10-step checklist in AI_STATE.md
  - Pre-push: tests, build, changelog, secrets check
  - Post-push: CI verification, tagging, documentation
  - Emergency rollback procedure documented

- **Version Enforcement**: Added engines field to package.json
  - node >= 20.19.0
  - pnpm >= 10.24.0

## PHASE_R - Stability Hardening (2025-12-17)

### Testing Quality Enforcement

- **Testing Contract**: Documented zero-warning policy in AI_STATE.md
  - All tests must produce NO console warnings or React errors
  - Proper `act(...)` wrapping for state updates
  - Deterministic execution with no race conditions
  - Global state cleanup between tests

- **Quality Gate**: Added vitest console warning enforcement
  - Tests now fail on React warnings (act, hydration, etc.)
  - Prevents warning regressions from being merged
  - Ensures production-quality test output

- **Test Fixes**: Fixed React act(...) warning in settings.test.tsx
  - Wrapped `useSettingsStore.setState()` in `act(...)`
  - Wrapped `fireEvent.keyDown()` state updates in `act(...)`
  - All 201 tests passing with zero warnings

## v1.0.0 - Genesis Release (2025-12-08)

### Critical Fixes - Production Ready

This release represents the complete stabilization of RedByte OS Genesis, fixing all critical runtime errors and rendering issues that prevented proper deployment.

#### React Runtime Errors Fixed
- **React Error #185 (Infinite Loop)**: Fixed two separate sources of infinite re-render loops
  - Shell.tsx: `getZOrderedWindows()` selector creating new array references
  - Dock.tsx: `getActiveWindows()` selector creating new arrays on every call
  - Solution: Access raw state + `useMemo` to prevent unnecessary re-renders

- **React Error #130 (Invalid Component)**: Fixed WelcomeApp property mismatch
  - Issue: Used `Component` (uppercase) instead of `component` (lowercase)
  - Added missing `iconId` field to manifest

#### Styling & Rendering Fixes
- **Tailwind CSS**: Fixed content configuration for monorepo
  - Root config now scans `./packages/*/src/**/*.{js,ts,jsx,tsx}`
  - Added package-specific configs for `rb-shell` and `rb-apps`
  - CSS bundle size increased from 0.5KB to 39KB (all utilities generated)

- **Desktop Icons**: Fixed positioning using inline `position: 'absolute'`
  - Icons now display at correct coordinates instead of vertical stack
  - Proper styling with rounded borders and hover effects

#### Data Integrity Fixes
- **Circuit Loading**: Fixed TypeError "t.nodes is not iterable"
  - Added `Array.isArray()` validation for decoded circuit data
  - Prevents crashes when loading malformed circuits from URLs

#### Deployment
- **GitHub Actions**: Disabled redundant workflows
  - Cloudflare Pages handles auto-deployment from main branch
  - Workflows now manual-trigger only

### Technical Debt Resolved
- React 19 unified across all packages
- Vitest configured with jsdom environment
- JSX runtime properly configured
- All external React dependencies properly configured

### Features Verified Working
✅ Welcome window with tutorial system
✅ Desktop with draggable icons
✅ Window management (minimize, maximize, close, drag, resize)
✅ Dock with running app indicators
✅ Settings app with theme and wallpaper selection
✅ Logic Playground with circuit editor
✅ Circuit sharing via URL parameters
✅ Boot screen animation
✅ Toast notifications

### Breaking Changes
None - This is the initial stable release

### Upgrade Notes
- No migration required
- Fresh deployment recommended

---

**Full Commit History**: 9b2dc9b3...b9fb24f9
