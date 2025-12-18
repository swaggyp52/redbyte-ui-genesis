# RedByte OS Genesis - Changelog

## PHASE_AB - File Association Manager UI (2025-12-18)

### Goal
Provide keyboard-first UI to view and edit file associations, with reset/import/export capabilities for power users and deterministic failure-safe operations.

### Key Changes
- **File Associations Panel** (Settings app):
  - Keyboard-first navigation: Arrow keys navigate, Enter edits, Delete clears
  - Shows all associations in stable alphabetical order by extension
  - Displays extension, target name, and [DEFAULT] marker for each association
  - Hosted in Settings app sidebar (new "File Associations" section)

- **Store Helpers**:
  - `listAssociations()`: Returns all associations in stable alphabetical order
  - `resetAll()`: Clears all associations and persists empty state
  - `exportJson()`: Returns canonical JSON with stable key ordering
  - `importJson(jsonString)`: Validates schema, normalizes extensions, filters unknown targetIds
  - Import is atomic (all-or-nothing) and failure-safe (invalid JSON → no-op)

- **Keyboard Shortcuts**:
  - **Arrow Up/Down**: Navigate association rows
  - **Enter**: Edit default target (opens Target Picker Modal with eligible targets only)
  - **Delete/Backspace**: Clear mapping for selected extension
  - **R**: Reset all mappings (opens Reset Confirmation Modal)
  - **E**: Export (opens Export Modal with canonical JSON, readonly textarea)
  - **I**: Import (opens Import Modal with editable textarea)

- **Modals**:
  - Target Picker: Shows only eligible apps from FILE_ACTION_TARGETS for each extension
  - Reset Confirmation: Enter confirms, Escape cancels
  - Export: Readonly JSON textarea, Escape closes
  - Import: Editable JSON textarea, Enter applies, validates schema, filters unknown targetIds
  - Invalid JSON shows toast "Invalid JSON format", keeps modal open
  - Unknown targetIds shows toast "Filtered unknown apps: ..." and applies valid mappings

### Testing (346 tests passing, 0 warnings)
- **Store Helper Tests** (19 new tests):
  - listAssociations stable alphabetical ordering
  - resetAll clears all mappings and persists
  - exportJson canonical JSON with sorted keys
  - exportJson deterministic output across calls
  - importJson validates schema (invalid JSON, missing fields, wrong types)
  - importJson normalizes extensions (`.TXT` → `txt`)
  - importJson filters unknown targetIds
  - importJson atomic replacement (all-or-nothing)
  - importJson persists to localStorage
- **Regression**: All PHASE_AA tests still pass (no regressions)

### Files Changed
- `AI_STATE.md` - PHASE_AB contract added
- `packages/rb-apps/src/stores/fileAssociationsStore.ts` - Added listAssociations/resetAll/exportJson/importJson
- `packages/rb-apps/src/stores/__tests__/fileAssociationsStore.test.ts` - 19 new store helper tests
- `packages/rb-apps/src/apps/settings/FileAssociationsPanel.tsx` - New keyboard-first manager panel
- `packages/rb-apps/src/apps/SettingsApp.tsx` - Added "File Associations" sidebar section

### UX Impact
- **Before**: No UI to view/edit file associations (store API only)
- **After**: Full keyboard-first manager in Settings app
- **Example workflow**:
  1. Open Settings → File Associations section
  2. Arrow keys navigate existing associations
  3. Press Enter on `.txt` association → Target Picker shows Text Viewer (eligible), Logic Playground (ineligible)
  4. Select new target → association updated immediately
  5. Press R → confirm reset → all associations cleared
  6. Press E → copy canonical JSON for backup
  7. Press I → paste JSON → validates and applies atomically

---

## PHASE_AA - File Associations + Deterministic Default Target Resolution (2025-12-18)

### Goal
Make Files feel like a daily-driver app by implementing persistent default target associations per file type, eliminating modal friction for repeated open-with actions.

### Key Changes
- **File Associations Store**: Persistent default target preferences per file type
  - Extension normalization (lowercase, no leading dot): `.TXT` → `txt`
  - `getDefaultTarget(resourceType, extension)` → targetId | null
  - `setDefaultTarget(resourceType, extension, targetId)` → void
  - `clearDefaultTarget(resourceType, extension)` → void
  - localStorage persistence (rb:file-associations key)
  - Failure-safe corrupted data handling

- **Deterministic Default Resolution**: Pure function with fallback
  - `resolveDefaultTarget(resourceType, extension, eligibleTargets[])` → targetId
  - Returns saved default if exists and is in eligibleTargets
  - Falls back to first eligible target if no default or invalid default
  - Throws if eligibleTargets empty (caller must guard with isFileActionEligible)
  - Deterministic: always returns first eligible when multiple targets available

- **Files Default-Open Behavior**: Cmd/Ctrl+Enter uses default target
  - Extracts extension from filename (`Notes.txt` → `txt`)
  - Calls `resolveDefaultTarget()` to get targetId
  - Dispatches open-with intent with resolved target
  - Guards: only files (not folders), only eligible targets
  - No modal friction for repeated file type actions

- **Open With Modal Enhancements**: D/Shift+D keyboard actions
  - **D key**: Set selected target as default for file type (closes modal)
  - **Shift+D key**: Clear default for file type (keeps modal open)
  - **[DEFAULT] marker**: Displayed next to saved default target
  - Modal receives resourceType and extension props
  - Updated keyboard hints footer
  - Input/textarea guard for D/Shift+D keys

### Testing (327 tests passing, 0 warnings)
- **Store Tests** (24 new tests):
  - Extension normalization (`.txt` → `txt`, `TXT` → `txt`, `.RBLOGIC` → `rblogic`)
  - Get/set/clear operations
  - Multiple file types with different defaults
  - File vs folder defaults (separate namespaces)
  - localStorage persistence on set/clear
  - Corrupted JSON handling
  - Invalid schema handling
- **Resolver Tests**:
  - Returns saved default if eligible
  - Falls back to first eligible if no default
  - Falls back if saved default not in eligible list
  - Throws if eligibleTargets empty
  - Deterministic fallback (always first eligible)
- **Integration Tests**:
  - Updated PHASE_X test: Notes.txt → text-viewer (was logic-playground)
  - All PHASE_X/Y/Z tests still pass (no regressions)

### Files Changed
- `AI_STATE.md` - PHASE_AA contract added
- `packages/rb-apps/src/stores/fileAssociationsStore.ts` - New store implementation
- `packages/rb-apps/src/stores/__tests__/fileAssociationsStore.test.ts` - 24 comprehensive tests
- `packages/rb-apps/src/index.ts` - Export fileAssociationsStore
- `packages/rb-apps/src/apps/FilesApp.tsx` - Cmd/Ctrl+Enter default routing + modal props
- `packages/rb-apps/src/apps/files/modals.tsx` - D/Shift+D actions + [DEFAULT] marker
- `packages/rb-apps/src/__tests__/files-operations.test.tsx` - Updated test expectations

### UX Impact
- **Before**: Every file open requires modal confirmation (even for same file type)
- **After**: First file type requires modal → set default → future files open directly
- **Example workflow**:
  1. Select `Notes.txt` → Cmd/Ctrl+Shift+Enter → Open With modal
  2. Arrow to Text Viewer → D key → set as default (modal closes, file opens)
  3. Select `README.md` → Cmd/Ctrl+Enter → opens directly in Text Viewer (no modal)
  4. Select `circuit.rblogic` → Cmd/Ctrl+Enter → opens in Logic Playground (different default)

---

## PHASE_Z - Multi-Target Open With + Deterministic Focus (2025-12-18)

### Goal
Expand open-with system to support multiple target apps with deterministic eligibility based on file type, and eliminate setTimeout hacks from focus behavior.

### Key Changes
- **FILE_ACTION_TARGETS Expansion**: Now supports 2 real targets with eligibility predicates
  - Logic Playground: `.rblogic` files only
  - Text Viewer: `.txt` and `.md` files
  - Eligibility predicates are pure functions: `(resourceType, resourceName) → boolean`

- **TextViewerApp**: New app for viewing text files
  - Handles open-with intent with resourceId payload
  - Supports `.txt` and `.md` file types
  - Deterministic focus using requestAnimationFrame (no setTimeout)
  - Placeholder content for demo purposes

- **Deterministic Focus**: Removed setTimeout hacks from LogicPlaygroundApp
  - Replaced `setTimeout(() => ref.current?.focus(), 100)` with `requestAnimationFrame(() => ref.current?.focus())`
  - Focus behavior now deterministic and testable without fake timers
  - Single frame delay instead of arbitrary 100ms timeout

- **Open With Modal**: Now filters targets by eligibility
  - Modal only shows eligible targets for selected file
  - Folders show no targets (ineligible)
  - Unknown file types show "No available targets" message

### Testing (303 tests passing, 0 warnings)
- **Eligibility Tests**: Logic Playground vs Text Viewer eligibility for different file types
- **Registry Tests**: Verified >=2 targets with deterministic isEligible predicates
- **Focus Tests**: No setTimeout usage, testable without vi.advanceTimersByTime
- **Integration Tests**: PHASE_X/Y tests updated to use circuit.rblogic from Home

### Files Changed
- `packages/rb-apps/src/apps/files/fileActionTargets.ts` - Added isEligible predicates
- `packages/rb-apps/src/apps/TextViewerApp.tsx` - New text viewer app
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx` - Replaced setTimeout with requestAnimationFrame
- `packages/rb-apps/src/index.ts` - Registered TextViewerApp
- `packages/rb-apps/src/apps/files/fsModel.ts` - Added circuit.rblogic to Home
- `packages/rb-apps/src/__tests__/files-operations.test.tsx` - Added 9 PHASE_Z tests
- `packages/rb-apps/src/apps/files/__tests__/fsModel.test.ts` - Updated for new Home entry
- `packages/rb-apps/src/__tests__/files.test.tsx` - Updated PHASE_V test for new structure

---

## PHASE_Y - Open-With Payload + Target Consumption (2025-12-18)

### Logic Playground: File Loading from Intent

Completed the "Open With" workflow by enabling Logic Playground to load files from Files app via intent payload routing.

- **ResourceId Handling**: Logic Playground receives `resourceId` from open-with intent
  - Three-tier matching strategy: exact ID match → name match → create new circuit
  - Synchronous file loading, no async operations
  - Creates new empty circuit if resourceId not found in filesStore

- **Focus Behavior**: Canvas area automatically focused after loading file
  - Added `canvasAreaRef` with `tabIndex={-1}` for programmatic focus
  - 100ms setTimeout for reliable focus after DOM update
  - User can immediately start interacting with circuit

- **Architectural Bridge**: resourceId connects Files metadata with Playground content
  - Files app: metadata-only filesystem (`fsModel`)
  - Logic Playground: circuit content storage (`filesStore`)
  - resourceId serves as lookup key between the two systems

- **Failure-Safe Design**:
  - Unknown resourceId → create new circuit (no crash)
  - Folder resourceType → no-op (file-only guard preserved)
  - Toast notification on circuit creation for user feedback

- **Testing**: 3 new PHASE_Y tests (298 total passing)
  - Payload routing verification (resourceId correctness)
  - Different files dispatch different resourceIds
  - Folder guard enforcement (no intent for folders)

- **Implementation Notes**:
  - useEffect hook in LogicPlaygroundApp handles resourceId prop
  - Name matching for flexibility (e.g., "notes" matches "notes.txt")
  - Per-window isolation preserved (each Playground instance independent)

## PHASE_X - Cross-App File Actions (2025-12-18)

### Files App: Open With Modal

Extended Files from operations to cross-app file routing via generic "Open With..." modal and intent system.

- **FILE_ACTION_TARGETS Registry**: Single source of truth for file action targets
  - `packages/rb-apps/src/apps/files/fileActionTargets.ts`
  - FileActionTarget interface: id, name, appId, supportedTypes
  - Helper functions: getFileActionTargets(), isFileActionEligible(), getDefaultFileActionTarget()
  - Initial target: Logic Playground (file-only)
  - Future targets: Text Viewer, Image Viewer (commented placeholders)

- **OpenWithModal Component**: PHASE_U modal pattern with keyboard navigation
  - `packages/rb-apps/src/apps/files/modals.tsx`
  - Arrow keys navigate targets, Enter selects, Escape cancels
  - Visual selection indicator (cyan highlight)
  - Auto-focus on mount, keyboard-first UX
  - Shows "No available targets" if targets array empty

- **Keyboard Shortcuts**:
  - **Cmd/Ctrl+Shift+Enter**: Opens "Open With..." modal for selected file
  - **Cmd/Ctrl+Enter**: Direct action to Logic Playground (default, no modal)
  - Both shortcuts no-op for folders (file-only eligibility)

- **Modal Guards** (PHASE_W standard):
  - "Open With..." modal blocks all Files shortcuts when open
  - Selection frozen while modal active
  - Escape priority preserved: modal first, then window

- **Intent Routing**:
  - Reuses existing `open-with` intent type from PHASE_V (no new types)
  - Shell dispatcher already supports generic targetAppId routing
  - Unknown targets fail gracefully via openWindow() (no crash)

- **Footer Update**: Added Ctrl/Cmd+Shift+Enter hint for discoverability

- **System Search**: Not implemented (requires context-awareness that static intents don't support)
  - Added comment in searchRegistry.ts explaining limitation
  - Recommended workflow: Use Cmd/Ctrl+Shift+Enter directly in Files

- **Testing**: 8 new PHASE_X tests (295 total passing)
  - Cmd/Ctrl+Shift+Enter opens modal for files
  - Cmd/Ctrl+Shift+Enter no-op for folders
  - Modal blocks Files shortcuts
  - Modal keyboard navigation (Arrow keys, Enter, Escape)
  - Intent dispatched with correct payload (targetAppId, resourceId)
  - Cmd/Ctrl+Enter direct action (no modal)
  - PHASE_W modal guards preserved

- **Architecture Notes**:
  - Zero async, synchronous intent routing
  - Per-window context (actions only affect focused Files window)
  - Failure-safe (unknown target → no-op)
  - Extensible (add new targets to FILE_ACTION_TARGETS array)

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
