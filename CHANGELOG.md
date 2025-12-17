# RedByte OS Genesis - Changelog

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
