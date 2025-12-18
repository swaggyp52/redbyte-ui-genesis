# RedByte OS Genesis - Changelog

## PHASE_W - Files Operations (2025-12-18)

### Files App: User-Owned Workspace

Upgraded Files from "navigation + intents" into a user-owned workspace with create/rename/delete operations.

- **Per-Window Mutable Filesystem**: Each Files window has independent mutable state
  - Deterministic ID generation using incremental counter (`folder-1`, `file-2`)
  - Auto-suffix for duplicates: "New Folder", "New Folder (2)", "New Folder (3)"
  - Per-window state isolation (operations in one window don't affect others)

- **Create Operations**: Modal-confirmed folder and file creation
  - Create Folder: Cmd/Ctrl+Shift+N, default name "New Folder"
  - Create File: Cmd/Ctrl+N, default name "New File.txt"
  - Name validation: trim whitespace, reject empty, reject `/` and `\`
  - Auto-suffix on duplicate names in same folder

- **Rename Operation**: F2 keyboard shortcut
  - Modal pre-filled with current entry name
  - Root folder protection (Home/Desktop/Documents cannot be renamed)
  - Auto-suffix if target name already exists
  - Updates both entry and folder metadata

- **Delete Operation**: Delete key with confirmation
  - Confirmation modal shows entry name and type
  - Cascade delete for folders (entire subtree removed recursively)
  - Root folder protection (cannot delete Home/Desktop/Documents)
  - Navigate to parent if deleting current folder
  - Selection index clamping after delete

- **Modal Components**: Reusable PHASE_U pattern
  - TextInputModal: Enter to confirm, Escape to cancel, live validation
  - ConfirmModal: Shows cascade warning for folder deletes
  - Auto-focus input, pre-select text for quick editing

- **Keyboard Priority & Guards** (Stage 3 Polish):
  - Modal open blocks all Files shortcuts (F2, Delete, Cmd+N, arrow keys)
  - Escape priority: closes modal first, then window on second press
  - "Open in Playground" (Cmd+Enter) suppressed during modal
  - Selection frozen while modal active

- **UX Polish**:
  - Organized shortcut hints in footer
  - Navigation shortcuts (↑↓, Enter, Alt+←→) grouped on left
  - Operation shortcuts (Ctrl/Cmd+N, F2, Del) grouped on right
  - Clear visual grouping for discoverability

- **Testing**: Exhaustive coverage with 18 operation tests
  - Create folder/file via keyboard shortcuts
  - Rename with F2 (including root protection)
  - Delete with confirmation (including cascade, root protection)
  - Auto-suffix for duplicate names
  - Empty name rejection
  - Selection index clamping after delete
  - Navigate to parent when deleting current folder
  - Per-window state independence
  - Modal keyboard guards (arrow keys, shortcuts blocked)
  - Escape priority (modal → window)
  - "Open in Playground" blocked during modal
  - 288 total tests passing, zero warnings

- **Filesystem Model** (Stage 1):
  - Pure mutation functions in `packages/rb-apps/src/apps/files/fsModel.ts`
  - Type definitions in `packages/rb-apps/src/apps/files/fsTypes.ts`
  - 48 unit tests for filesystem primitives
  - Deterministic behavior, immutable updates

## PHASE_V - Files Workflow Polish (2025-12-17)

### Files App Navigation Enhancements

- **Breadcrumb Navigation**: Visual path indicator in Files app
  - Displays current folder path (e.g., Home / Documents / Reports)
  - Clickable breadcrumb segments for quick navigation
  - Always reflects currentFolderId
  - Updates immediately on folder changes

- **Back/Forward History**: Browser-style navigation for Files
  - Per-window history stacks (backStack, forwardStack)
  - Back button (Alt+Left): Navigate to previous folder
  - Forward button (Alt+Right): Navigate forward in history
  - New navigation clears forward stack (proper branching behavior)
  - History is independent per Files window instance

- **Open With Workflow**: Enhanced file interaction
  - "Open in Playground" button visible for file entries
  - Keyboard shortcut: Cmd/Ctrl+Enter opens selected file in Logic Playground
  - Uses existing intent dispatch (no new infrastructure)
  - Folder selection correctly ignored (no-op behavior)

- **UI Polish**: Professional file manager feel
  - Back/Forward buttons with disabled states
  - Breadcrumb path with separators and hover states
  - Keyboard shortcuts displayed in footer bar
  - All features keyboard-accessible

- **Testing**: Comprehensive test coverage
  - 31 total Files tests (all passing)
  - Breadcrumb render and navigation tests
  - History stack behavior (push, pop, clear) tests
  - Open With intent dispatch tests
  - Edge case coverage (empty stacks, folder vs file handling)
  - All 222 tests passing with zero warnings

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
