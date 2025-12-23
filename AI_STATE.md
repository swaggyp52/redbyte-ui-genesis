\# RedByte OS Genesis — AI State Ledger



This file is the single authoritative source of truth for:

\- Project phase

\- Architectural invariants

\- Allowed operations

\- Current objectives

\- Completed milestones



ALL AI agents (ChatGPT, Claude, Codex, others) MUST:

1\. Read this file before proposing or executing work

2\. Treat it as higher priority than prior chat context

3\. Update this file after completing any task or phase



---



\## Project Identity



Name: RedByte OS Genesis  

Owner: Connor Angiel  

Type: Browser-based OS-style simulation \& construction platform  

Stack: TypeScript, React, Vite, pnpm, Cloudflare Pages  

Canonical Branch: `main`



---



\## Development Philosophy



\- Terminal-first development only

\- GitHub UI actions are forbidden unless explicitly stated

\- One change-set per commit

\- No speculative refactors

\- No global changes without explicit authorization



---



\## Architectural Invariants (DO NOT BREAK)



These rules are permanent unless changed here:



\- OS metaphor is canonical (boot → desktop → apps)

\- Monorepo structure is authoritative

\- Packages are not merged or flattened

\- Legal attribution must reference Connor Angiel

\- `main` is always production

\- Cloudflare Pages auto-deploys from `main`

\- No AI agent may introduce automation bots without approval



\### Launcher Contract

The Launcher is the canonical OS entry point with these enforced behaviors:

\- Launcher can always be invoked via Ctrl/Cmd+K global shortcut

\- Launcher is a singleton app (only one instance allowed)

\- When invoked and minimized, Launcher restores and gains focus

\- When invoked and already focused, Launcher reuses existing window

\- Launcher does NOT steal focus when dismissed

\- Launcher gains focus when opened, even if no other window is focused

\- Shell.openWindow enforces singleton + focus behavior for all singleton apps


\### Window \& Shell Lifecycle Contract

Focus surface and interaction rules:

\- New windows always receive focus on creation

\- Focusing a window unfocuses all other windows (single-focus invariant)

\- Minimized windows remain in window store but are excluded from visible layout

\- Minimized windows retain their focus state (focus does not auto-transfer)

\- Maximized windows use mode='maximized' but z-index ordering still applies

\- Z-index is unique per window and increases monotonically

\- Focusing a window raises its z-index above all others


Dock interaction rules:

\- Clicking Dock icon for singleton app restores minimized window + focuses

\- Clicking Dock icon for non-singleton app creates new instance (not impl)

\- Dock never creates duplicate singleton windows

\- Dock running indicator shows only non-minimized windows


Keyboard semantics (OS-level):

\- Cmd/Ctrl+K opens Launcher (global, always available)

\- Cmd/Ctrl+, opens Settings (global, when Settings exists)

\- Escape in Launcher closes Launcher

\- Escape in Desktop clears icon selection

\- Cmd/Ctrl+W closes focused window (not implemented)


\### Files App Contract

Files is the first real multi-window workflow proving the OS substrate:

\- Files is a non-singleton app (multiple windows allowed)

\- Each Files window has independent navigation state

\- Multiple Files windows can exist simultaneously

\- Dock click on Files icon opens a NEW Files window (non-singleton behavior)

\- Closing one Files window does NOT affect other Files windows

\- Window title reflects current folder (e.g. "Files — Documents")

\- Title updates do NOT trigger focus/z-index side effects

\- Keyboard navigation: Arrow keys move selection, Enter opens folder, Escape closes window


### Settings App Contract

Settings is the canonical system configuration interface with strict singleton semantics:

\- Settings is a STRICT singleton (only one Settings window may ever exist)

\- Dock click on Settings icon restores minimized Settings window + focuses

\- Dock click on Settings icon when already open focuses existing window

\- Global Cmd/Ctrl+, shortcut opens Settings (registered in Shell keyboard handler)

\- Closing Settings window does NOT lose persisted state (settings survive window close)

\- Settings changes propagate live to Shell, Desktop, Dock, and all windows

\- No flicker, no remounts when settings change (React state updates only)

\- Settings state lives outside Settings component (survives window lifecycle)

\- Settings persist to localStorage and reload on Shell boot

\- Corrupted localStorage resets to safe defaults (no crash)

\- Keyboard navigation: Arrow keys move selection, Enter activates, Escape closes window


### Intent System Contract

Intents enable explicit app-to-app interaction without breaking isolation:

\- Intents are EXPLICIT, user-initiated actions (never implicit or automatic)

\- Intents are routed by the Shell, NOT apps directly (no app-to-app calls)

\- Target apps may be singleton or non-singleton (Shell respects manifest)

\- Intents may create new windows or reuse existing ones (per manifest rules)

\- Intent payloads are immutable once dispatched (no mutation in transit)

\- No global state for intents (routing is synchronous, no event bus)

\- Intents must be visible and intentional (button, menu, or keyboard shortcut)

\- No hidden side effects (all intent actions are explicit user choices)


### Command System Contract

Commands are system-level actions for power-user workflows without adding global state:

\- Commands are SYSTEM-LEVEL actions (operate on focused window or global OS state)

\- Commands are STATELESS and SYNCHRONOUS (no async side effects)

\- Commands are triggered ONLY by keyboard shortcuts or command UI (never automatic)

\- Commands operate on the focused window when applicable (or no-op if no focus)

\- Commands do NOT open new windows (only manipulate existing windows or OS state)

\- Commands do NOT fire when typing in text inputs (respect editable targets)

\- Command dispatch lives in Shell keyboard handler (no global command bus)

\- Commands reuse existing window store functions (no new primitives unless required)


Available commands:

\- **focus-next-window**: Cycle to next non-minimized window by descending zIndex (wraps around)

\- **focus-prev-window**: Cycle to previous non-minimized window by descending zIndex (wraps around)

\- **close-focused-window**: Close the currently focused window (respects singleton semantics)

\- **minimize-focused-window**: Minimize the currently focused window (retains in store)

\- **restore-last-minimized**: Restore most recently minimized window (not implemented yet)


Keyboard shortcuts:

\- Cmd/Ctrl+\` (backtick): focus-next-window

\- Cmd/Ctrl+W: close-focused-window

\- Cmd/Ctrl+M: minimize-focused-window

\- Cmd/Ctrl+Shift+P: Open Command Palette (lists available commands)


### System Search Contract

System Search is the unified discovery surface for apps, commands, and intent targets:

\- System Search is GLOBAL and MODAL (only one instance, invoked via Cmd/Ctrl+Space)

\- System Search is READ-ONLY until confirmed (no side effects before Enter)

\- System Search aggregates registered apps, commands, and intent-capable targets

\- System Search does NOT replace Launcher visually (Launcher remains accessible via Cmd/Ctrl+K)

\- System Search is for SPEED and DISCOVERY (not persistence or history)


Search result types (priority order):

\- **Apps**: Registered apps from rb-apps registry (Launcher, Files, Settings, Playground, etc.)

\- **Commands**: Available commands from Command System (focus-next-window, close-focused-window, etc.)

\- **Intent Targets**: Intent-capable actions (e.g. "Open in Playground")


Search behavior:

\- Simple string matching (startsWith / includes, case-insensitive)

\- No fuzzy scoring, no ranking heuristics, no async search

\- No indexing engine, no recent history, no persistence

\- Results grouped by section (Apps, Commands, Intent Targets)


Keyboard behavior:

\- Cmd/Ctrl+Space: Open System Search

\- ArrowUp / ArrowDown: Navigate results

\- Enter: Execute selected item

\- Escape: Close search without side effects


Execution behavior:

\- App → openWindow(appId)

\- Command → executeCommand immediately

\- Intent Target → dispatchIntent via Shell


Focus and safety:

\- Search does NOT trigger inside text inputs (respects editable targets)

\- Closing search restores previous focus

\- Search does NOT open windows until Enter is pressed


### Layout Contract

Window layouts are explicit spatial commands for efficient multi-window workflows:

\- Layouts are EXPLICIT and USER-TRIGGERED (never automatic or inferred)

\- Layouts are PER-SESSION (restored automatically on reload via Session Contract)

\- Layouts apply ONLY to normal windows (minimized windows are unaffected)

\- Layouts do NOT change z-index ordering or focus rules

\- Layouts set window position + size directly (no animation required initially)


Available layout actions:

\- **Snap Left**: Position window at left half of desktop (x: 0, y: 0, w: 50%, h: 100%)

\- **Snap Right**: Position window at right half of desktop (x: 50%, y: 0, w: 50%, h: 100%)

\- **Snap Top**: Position window at top half of desktop (x: 0, y: 0, w: 100%, h: 50%)

\- **Snap Bottom**: Position window at bottom half of desktop (x: 0, y: 50%, w: 100%, h: 50%)

\- **Center**: Center window on desktop with default dimensions (400x300 if not specified)


Keyboard shortcuts:

\- Cmd/Ctrl+Alt+Left: Snap Left

\- Cmd/Ctrl+Alt+Right: Snap Right

\- Cmd/Ctrl+Alt+Up: Snap Top

\- Cmd/Ctrl+Alt+Down: Snap Bottom

\- Cmd/Ctrl+Alt+C: Center


Behavior semantics:

\- Layout commands operate on focused window only (no-op if no focused window)

\- Layout commands exit maximized mode if window is currently maximized

\- Layout commands do NOT minimize, close, or change window stacking

\- Layout commands are synchronous (no async side effects)


### Session Contract

Session restore preserves workspace continuity across browser reloads:

\- Session restore is BEST-EFFORT and FAILURE-SAFE (corrupted data resets cleanly)

\- Session restore is AUTOMATIC on boot (no user confirmation or UI)

\- Session restore is TRANSPARENT (appears instant, no loading UI required)


What gets restored:

\- Normal windows (position, size, z-index, focus state)

\- Maximized windows (mode preserved, bounds ignored during maximized state)

\- Minimized windows (restored as minimized, bounds preserved)

\- Z-index ordering (relative stacking matches pre-reload state)

\- Focused window (last focused window regains focus after restore)


What does NOT get restored:

\- Launcher window (only opens via explicit user action)

\- App-specific internal state (apps must handle their own rehydration)

\- Command history or intent state (session restore does not trigger commands)

\- Unknown apps (windows referencing unregistered apps are skipped)


Persistence rules:

\- Window state persists to localStorage on every window mutation

\- Persisted data: windows array (id, contentId, bounds, mode, zIndex, focused)

\- Persisted data: nextZIndex counter

\- Invalid or corrupted entries are silently ignored (no crash, no alert)

\- Apps that fail to mount are skipped (other windows restore successfully)


Restore flow:

\- Shell reads localStorage on initialization (before Welcome screen logic)

\- Valid window entries recreate windows via createWindow-like path

\- Bounds, mode, and zIndex are applied from persisted state

\- Focus is restored to the last focused window (if it exists)

\- Launcher does NOT auto-open (preserves Cmd/Ctrl+K explicit invocation)


### Workspace Contract

Workspaces enable explicit, user-controlled organization of multiple window contexts:

\- A workspace is a NAMED SNAPSHOT of window state (windows, bounds, mode, z-index, focus)

\- Workspaces are EXPLICIT (created, switched, deleted via user action only)

\- Workspaces are LOCAL-ONLY (no cloud sync, no cross-device persistence)

\- Workspaces are FAILURE-SAFE (corrupted workspace data is silently ignored)


Workspace semantics:

\- ONE active workspace at a time (switching workspaces is atomic)

\- NO implicit saving (workspace snapshots are created explicitly, not automatically)

\- NO auto-workspaces (users must intentionally create workspaces)

\- Workspaces are STATELESS outside stored snapshots (no runtime workspace metadata)


Workspace operations:

\- **Create Workspace**: Captures current window state as named snapshot

\- **Switch Workspace**: Closes current windows, restores target workspace snapshot

\- **Delete Workspace**: Removes workspace from storage (no effect on active windows)

\- **Rename Workspace**: Updates workspace name (snapshot unchanged)


Switching behavior:

\- Current windows are closed (all windows, including minimized)

\- Target workspace snapshot is restored (windows recreated with original bounds/mode/zIndex)

\- Active workspace ID is persisted (survives reload)

\- Switching is atomic (no partial states visible to user)


Persistence rules:

\- All workspaces persist to localStorage

\- Active workspace ID persists to localStorage

\- Workspace data structure: { id, name, snapshot }

\- Snapshot = same structure as session data (windows, nextZIndex)

\- Corrupted workspace entries are skipped (other workspaces remain functional)


Boot behavior:

\- If active workspace exists → restore active workspace

\- Else fall back to session restore (PHASE_O behavior)

\- Workspace restoration uses same restore flow as session restore


Non-goals:

\- No workspace nesting or hierarchy

\- No per-app workspace overrides

\- No workspace UI chrome (dock indicators, persistent switchers)

\- No automatic workspace detection or suggestions


### Macro Contract

Macros enable repeatable sequences of actions for power-user automation:

\- A macro is a NAMED SEQUENCE of action steps (commands, intents, workspace switches, app opens)

\- Macros are EXPLICIT and USER-TRIGGERED (no background triggers, no schedules)

\- Macros are SYNCHRONOUS and DETERMINISTIC (steps execute in order, no async waits)

\- Macros are FAILURE-SAFE (abort on first error, no partial rollback)

\- Macros are LOCAL-ONLY (no cloud sync, no cross-device persistence)


Macro structure:

\- Macro = { id: string, name: string, steps: MacroStep[] }

\- MacroStep is one of:
  - { type: 'command', commandId: string }
  - { type: 'openApp', appId: string, props?: Record<string, unknown> }
  - { type: 'intent', intent: OpenWithIntent }
  - { type: 'switchWorkspace', workspaceId: string }


Execution semantics:

\- Macros execute steps sequentially in array order

\- Each step uses existing Shell functions (executeCommand, openWindow, dispatchIntent, switchWorkspace)

\- If a step fails (unknown ID, invalid data), macro execution ABORTS immediately

\- No rollback of prior steps (steps are idempotent or user-recoverable)

\- Execution returns success/failure status


V1 Non-goals:

\- No timers or delays (no setTimeout/setInterval)

\- No async operations (no await/Promise)

\- No loops or conditionals (no for/while/if)

\- No recording mouse movement or DOM interactions

\- No background execution (user must trigger explicitly)

\- No schedules or cron-like triggers


Persistence rules:

\- All macros persist to localStorage

\- Macro data structure: { id, name, steps }

\- Corrupted macro entries are skipped (other macros remain functional)

\- Invalid or corrupted localStorage data is silently ignored


Discoverability:

\- Macros appear in Command Palette under "Run Macro…" command

\- Macros appear in System Search under "Macros" group

\- Macro management commands (create, delete, rename) accessible via Command Palette


### Testing Contract

Tests must maintain zero-warning output and deterministic behavior:

\- **Zero warnings required**: Tests must produce NO console.warn, console.error, or React warnings

\- **React state updates**: All state updates must be wrapped in act(...) or proper async utilities (waitFor)

\- **Deterministic execution**: No race conditions, no timers without mocking, no flaky assertions

\- **Global state cleanup**: Tests must not pollute localStorage, DOM, or global scope

\- **Isolation**: Each test cleans up after itself (restore mocks, clear stores, reset state)


Correct patterns:

\- Use `waitFor(() => expect(...))` for async state updates

\- Use `act(() => { fireEvent.keyDown(...) })` for sync state updates that trigger effects

\- Use `afterEach(() => localStorage.clear())` for cleanup

\- Use `vi.restoreAllMocks()` after tests that mock functions


Incorrect patterns:

\- Naked `fireEvent` without waiting for effects to complete

\- Tests that leave localStorage/sessionStorage dirty

\- Tests that depend on execution order

\- Ignoring or suppressing React warnings in test output


Quality enforcement:

\- Test suite configured to fail on console.warn/console.error

\- All tests must pass with zero warnings before commit

\- React act(...) warnings indicate improper async handling


### CI/CD Contract

Continuous Integration enforces quality gates at the repository level:

\- **PR + main branch checks**: GitHub Actions runs on all pull requests and main branch pushes

\- **Test gate**: `pnpm -r test` must pass with zero warnings (enforced by vitest config)

\- **Build gate**: `pnpm -r build` must succeed for all packages

\- **Node/pnpm version lock**: CI uses exact versions specified in package.json engines field

\- **Cache optimization**: pnpm store cached to minimize install time

\- **No bypass**: Merge blocked if CI fails

Release discipline:

\- Tag releases after major milestones: `phase-{letter}-complete` or `v{major}.{minor}.{patch}`

\- Run confidence checks before tagging: `pnpm test && pnpm build`

\- Update CHANGELOG.md with user-facing changes before release

\- Verify no secrets in git history before pushing

\- GitHub is source of truth: if CI is green, main is shippable

Workflow triggers:

\- Pull requests to main branch

\- Direct pushes to main branch

\- Manual workflow dispatch for testing

CI failure policy:

\- Do NOT merge if CI fails

\- Do NOT bypass checks with force-push unless in emergency

\- Fix the root cause before merging

\- Temporary skip patterns (e.g., skipped tests) are not allowed


### Release Checklist

Before creating a release tag or pushing to main:

**Pre-push checklist:**

1. \[ \] Run `pnpm test` locally - all 201 tests passing with zero warnings
2. \[ \] Run `pnpm -r build` locally - all packages build successfully
3. \[ \] Update CHANGELOG.md with user-facing changes
4. \[ \] Verify no secrets in git history: `git log --all --full-history --source --grep='github_pat\|api_key\|secret'`
5. \[ \] Check .gitignore includes `.claude/settings.local.json` and other local files
6. \[ \] Git status clean (no unintended files staged)

**Post-push checklist:**

7. \[ \] Verify CI passes on GitHub (all jobs green)
8. \[ \] Create milestone tag: `git tag phase-{letter}-complete && git push origin phase-{letter}-complete`
9. \[ \] Verify tag appears on GitHub releases page
10. \[ \] Document phase completion in AI\_STATE.md Completed Phases section

**Emergency rollback procedure:**

\- If main is broken: revert the commit with `git revert <commit-sha>` and push
\- If CI is red: do NOT force-push, do NOT bypass checks
\- Fix forward with a new commit, or revert and iterate locally


### Modal UI Contract

All system modals follow consistent keyboard-first interaction patterns:

**Interaction model:**

\- **Keyboard-first**: Arrow keys navigate, Enter selects, Escape closes

\- **No focus theft**: Opening modal does NOT change focused window unless action is executed

\- **Deterministic execution**: Modal actions use same primitives as direct commands (no duplicate logic)

\- **Consistent styling**: Match SystemSearch / CommandPalette visual language

\- **Search + filter**: Type to filter list, same pattern as Launcher

**Modal types:**

1\. **WorkspaceSwitcher**: Replace `prompt()` for workspace selection

   \- List all workspaces with keyboard navigation

   \- Show current workspace indicator

   \- Enter switches workspace, Escape cancels

   \- Uses `switchWorkspaceById()` primitive (no new logic)

2\. **MacroRunner**: Replace `prompt()` for macro selection

   \- List all macros with search/filter

   \- Show macro step count in description

   \- Enter executes macro, Escape cancels

   \- Uses `executeMacro()` primitive (no new logic)

**Testing requirements:**

\- Modal open/close does not affect focused window

\- Escape always closes without side effects

\- Enter executes the selected action deterministically

\- Search/filter behavior matches Launcher patterns

\- All interactions testable without browser prompts

**Implementation pattern:**

\- Modal components in `packages/rb-shell/src/modals/`

\- Same structure as SystemSearch (search state, keyboard handler, results list)

\- Reuse existing primitives (no command duplication)

\- Tests verify focus preservation and deterministic execution


### Invariants Contract

State invariants ensure correctness under all window store operations:

**Window state invariants (always hold after any action):**

\- **At most one focused window**: Only one window can have `mode: 'normal'` or `mode: 'maximized'` AND be focused

\- **Unique z-index**: No two windows share the same `zIndex` value

\- **Focus validity**: If a focused window exists, it must NOT be minimized (`mode !== 'minimized'`)

\- **Z-index sequence**: All `zIndex` values are positive integers

**Persistence invariants:**

\- **Session restore**: Never restores unknown apps or launcher windows

\- **Workspace restore**: Filters invalid windows before restoration

\- **Corrupt data handling**: Ignores corrupted localStorage without throwing exceptions

\- **No state pollution**: Restore operations don't leak into current state before completion

**Implementation:**

\- Dev-only invariant checks: `assertWindowInvariants(windows)` throws descriptive errors

\- Gated behind `process.env.NODE_ENV !== 'production'`

\- Called after every mutating store action (create/focus/minimize/close/restore/snap/center)

\- Located in `packages/rb-windowing/src/invariants.ts`

**Testing requirements:**

\- Property-style tests: Random action sequences over multiple windows

\- Edge-case tests: Focus behavior when all windows minimized, focused window closed, etc.

\- All tests pass with zero warnings (PHASE\_R enforcement)

\- CI validates on every push (PHASE\_S enforcement)

**Violation handling:**

\- Dev mode: Throw error immediately with detailed message

\- Production: Invariants disabled for performance

\- Tests: Violations fail the test suite immediately


### Files Workflow Polish Contract (PHASE_V)

Make Files feel like a daily-use app by adding navigation affordances and workflow depth without touching OS infrastructure.

**Goal:**

Make Files feel real, not just correct. Add breadcrumb navigation, back/forward history, and "Open With..." workflow without touching window store, shell contracts, or command/search/macro/intent systems.

**Non-Goals:**

\- No real filesystem / persistence / backend IO

\- No async loading, indexing, or streaming

\- No new global buses

\- No window title mutation API (still future work)

\- No changes to core window invariants or focus rules

\- No new packages unless strictly necessary

**Invariants:**

\- **Files remains non-singleton**: Each Dock invocation creates a new independent window instance

\- **Per-window state isolation**: Navigation history, selection, and current folder are unique per Files window

\- **Zero warnings**: Tests must pass with PHASE_R "fail on warnings" gate

\- **Keyboard-first**: All new UI must be operable without mouse

\- **Deterministic**: No async in V1; UI updates are synchronous and testable

**Feature Contract:**

1\. **Breadcrumb Navigation**

   \- Files renders a breadcrumb bar representing the current folder path

   \- Breadcrumb shows clickable segments: Home / Documents / Projects (example)

   \- Clicking a breadcrumb segment navigates to that folder

   \- Breadcrumb always reflects currentFolderId

   \- Keyboard: Breadcrumb must not trap focus (clicking remains optional)

   \- Acceptance: Breadcrumb visible in all folders, updates immediately on navigation

2\. **Back / Forward Navigation (History Stack)**

   \- Files maintains per-window history stack: `backStack: FolderId[]`, `forwardStack: FolderId[]`

   \- Navigating into folder: pushes current onto backStack, clears forwardStack

   \- Back: if backStack non-empty, move current into forwardStack, pop into currentFolderId

   \- Forward: if forwardStack non-empty, move current into backStack, pop into currentFolderId

   \- Keyboard: Alt+Left → Back, Alt+Right → Forward

   \- Must respect editable targets (don't fire while typing in inputs)

   \- Acceptance: Back/Forward behave like real file browser, history independent per window

3\. **"Open With..." Workflow Surface**

   \- Selecting a file exposes "Open With..." action

   \- For files (not folders): "Open With..." offers Logic Playground option

   \- Uses existing intent dispatch route (no new infra)

   \- Keyboard: Cmd/Ctrl+Enter → send selected file to Playground (if valid file selection)

   \- For folders: Cmd/Ctrl+Enter is no-op

   \- Acceptance: Mouse path exists (button/menu), keyboard path exists, dispatches correct intent

4\. **Selection + Focus Polish (No Regression)**

   \- Arrow navigation remains stable after folder changes

   \- On entering folder: selection resets to first item (index 0) if items exist

   \- Escape behavior unchanged (closes Files window)

   \- Enter behavior unchanged (opens folder when selection is folder)

   \- Acceptance: No regressions to PHASE_I keyboard semantics, no focus theft

**Implementation checklist:**

\- Add breadcrumb bar UI in FilesApp.tsx (path resolution + click handlers)

\- Add breadcrumb tests (render, update, navigation)

\- Implement per-window history stacks (backStack/forwardStack state)

\- Add Back/Forward UI buttons + keyboard handlers (Alt+Left/Right)

\- Add history tests (push, back, forward, clear forward on new nav)

\- Add "Open With..." UI for selected file (button/menu)

\- Wire to existing Playground intent dispatch

\- Add Cmd/Ctrl+Enter keyboard shortcut

\- Add "Open With..." tests (dispatch, keyboard, folder/file handling)

\- Run full test suite (zero warnings), run build

\- Update CHANGELOG.md with PHASE_V completion

**Definition of Done:**

\- Breadcrumbs + Back/Forward + Open With implemented

\- Keyboard coverage for all critical actions

\- Tests comprehensively cover new behaviors and edge cases

\- All tests pass with zero warnings

\- CI passes (test + build)

\- CHANGELOG.md reflects completion


### Files Operations Contract (PHASE_W)

Upgrade Files from "navigation + intents" into a user-owned workspace by adding create / rename / delete operations.

**Goal:**

Make Files feel owned by adding mutation operations (create folder/file, rename, delete) with modal confirmation, keyboard-first UX, and zero async.

**Non-Goals:**

\- No real filesystem I/O

\- No async/await, timers, network, or background work

\- No drag/drop, copy/paste, multi-select (reserved for future)

\- No permissions/auth

**Invariants:**

\- **Determinism**: All operations are synchronous and produce deterministic state transitions

\- **Per-window state**: Each Files window maintains independent mock FS state (per-window isolation)

\- **Modal-confirmed**: All destructive operations route through Shell modal UI (no window.prompt/confirm)

\- **Zero warnings**: Tests must pass with PHASE_R "fail on warnings" gate

\- **Keyboard-first**: All operations executable without mouse

**Operation Contracts:**

1\. **Create Folder**

   \- Opens modal with name input

   \- Keyboard: Cmd/Ctrl+Shift+N

   \- Default name: "New Folder" (or auto-suffix if duplicate)

   \- Empty name rejected (disabled confirm button)

   \- Duplicate names: auto-suffix with " (2)", " (3)", etc.

   \- Created in current folder

   \- Selection moves to new folder after creation

2\. **Create File**

   \- Opens modal with name input

   \- Keyboard: Cmd/Ctrl+N

   \- Default name: "New File.txt" (or auto-suffix if duplicate)

   \- Empty name rejected

   \- Duplicate names: auto-suffix

   \- Created in current folder

   \- Selection moves to new file after creation

3\. **Rename Entry**

   \- Keyboard: F2

   \- Opens modal with current name pre-filled

   \- Empty name rejected

   \- Duplicate name: show inline error, disable confirm

   \- Rename succeeds: selection stays on renamed entry

   \- Cancel: restores original name

   \- Root folders (Home/Desktop/Documents) cannot be renamed

4\. **Delete Entry**

   \- Keyboard: Delete key

   \- Opens confirmation modal showing entry name and type

   \- Folder delete: cascades to entire subtree (recursive delete)

   \- After delete: selection clamps to valid index (or 0 if list empty)

   \- If current folder deleted: navigate to parent (or Home if no parent)

   \- Root folders cannot be deleted

**Name Validation Rules:**

\- Names are trimmed (leading/trailing whitespace removed)

\- Empty names rejected

\- Reserved characters: `/` and `\` rejected (minimal OS-agnostic rules)

\- Duplicate detection: case-sensitive match

\- Auto-suffix format: " (2)", " (3)", etc. (deterministic numbering)

**Modal Integration:**

\- Reuse PHASE_U modal patterns (keyboard-first, Arrow keys navigate, Enter confirms, Escape cancels)

\- Create modals: text input + confirm/cancel buttons

\- Delete modal: confirmation message + confirm/cancel buttons

\- Rename modal: text input with current name + confirm/cancel buttons

\- All modals block Files keyboard shortcuts while open

**Navigation Safety:**

\- Delete current folder → navigate to parent folder (or Home if parent is null)

\- Selection index clamps after delete (min 0, max entries.length - 1)

\- Selection resets to 0 on folder navigation (existing behavior preserved)

**Implementation checklist:**

\- Add PHASE_W contract to AI_STATE.md

\- Extend mock FS model with mutation primitives (createFolder, createFile, renameEntry, deleteEntry)

\- Implement modals for create/rename/delete operations

\- Add keyboard shortcuts (F2, Delete, Cmd/Ctrl+N, Cmd/Ctrl+Shift+N)

\- Wire modals into Files component

\- Add UI affordances (toolbar buttons optional, keyboard primary)

\- Write exhaustive tests (create, rename, delete, validation, edge cases)

\- Run full test suite (zero warnings), run build

\- Update CHANGELOG.md with PHASE_W completion

**Definition of Done:**

\- Users can create, rename, delete files/folders entirely via keyboard

\- All confirmations via first-class modals (no browser prompts)

\- No async in feature path

\- Tests cover success + failure + edge cases exhaustively

\- Entire suite passes with zero warnings, build passes

\- Contracts and completion logged


### Cross-App File Actions Contract (PHASE_X)

Make Files a hub by turning file selection into first-class actions that route through the existing Intent system, surfacing in Command Palette and System Search.

**Goal:**

Transform file selection into actionable intents that can launch/route to other apps (Logic Playground, future viewers, editors) via explicit user actions, keyboard-first, no async.

**Non-Goals:**

\- No file content indexing or search crawling

\- No background workers or async file operations

\- No auto-open behaviors (user must explicitly trigger)

\- No drag-and-drop to other apps (reserved for future)

\- No file watchers or change detection

**Invariants:**

\- **Intent-based routing**: All file actions go through Intent system (no direct app imports in Files)

\- **Synchronous execution**: Shell dispatcher routes synchronously to target app

\- **Failure-safe**: Unknown target/app → no-op (with optional user notification)

\- **Modal guards preserved**: Actions never fire while modal is open (PHASE_W standard)

\- **Per-window context**: File actions only operate on the focused Files window's selected file

**File Action Semantics:**

1. **Action Triggers**:
   - UI button click (e.g., "Open in Playground")
   - Keyboard shortcut (e.g., Cmd/Ctrl+Enter for default, Cmd/Ctrl+Shift+Enter for "Open With...")
   - Command Palette selection (if Files focused + file selected)
   - System Search action (if Files focused + file selected)

2. **Action Payload**:
   ```typescript
   interface FileActionIntent {
     type: 'open-with';
     payload: {
       sourceAppId: 'files';
       targetAppId: string; // e.g., 'logic-playground'
       resourceId: string; // file ID
       resourceType: 'file' | 'folder';
       resourceName?: string; // for display
     };
   }
   ```

3. **Action Availability**:
   - Actions shown only when valid (file vs folder type check)
   - Folder-only actions vs file-only actions clearly separated
   - No actions available when no entry selected
   - No actions fire during modal (PHASE_W guard applies)

**Implementation Contracts:**

1. **Intent Type Expansion**:
   - Reuse existing `open-with` intent type from PHASE_V
   - Payload already supports: `{ sourceAppId, targetAppId, resourceId, resourceType }`
   - No new intent types needed (keeps schema simple)

2. **Shell Dispatcher Enhancements**:
   - Shell receives `open-with` intent
   - Maps `targetAppId` to app launcher
   - Opens target app with props: `{ fileId, fileName, fileType }`
   - Maintains singleton rules (existing PHASE_J windowing logic)
   - Unknown `targetAppId` → no-op (silent fail or toast)

3. **Files UI: Action Surface**:
   - Existing: "Open in Playground" button for files (PHASE_V)
   - Add: "Open With..." button/modal for file entries
   - "Open With..." modal:
     - Lists available targets from intent target registry
     - Keyboard navigation: Arrow keys, Enter confirms, Escape cancels
     - No browser prompts, follows PHASE_U modal patterns
   - Actions disabled/hidden for:
     - Folders (only show folder-appropriate actions)
     - Root entries (Home/Desktop/Documents)
     - When no entry selected

4. **Keyboard Shortcuts**:
   - **Existing**: Cmd/Ctrl+Enter = "Open in Playground" (default for files)
   - **New**: Cmd/Ctrl+Shift+Enter = "Open With..." modal
   - Guard: shortcuts blocked when modal is open (PHASE_W)
   - Guard: shortcuts no-op when target is input/textarea
   - Guard: shortcuts no-op when no file selected or folder selected

5. **System Search Integration** (Static Actions):
   - No file content indexing (stays within PHASE_S scope)
   - Add static action entries when Files is focused:
     - "Open With..." (only if file selected in focused Files window)
     - Action triggers the "Open With..." modal in focused Files window
   - Actions no-op if Files not focused or no file selected
   - No global file registry (keeps search deterministic)

6. **Command Palette Integration** (Optional Enhancement):
   - When Files is focused + file selected:
     - Show "File: Open With..." command
     - Executes same "Open With..." modal
   - No new infrastructure (reuses existing command registry from PHASE_T)

**Target App Registry:**

Maintain a simple static registry of apps that can receive file actions:

```typescript
const FILE_ACTION_TARGETS = [
  { id: 'logic-playground', name: 'Logic Playground', supportedTypes: ['file'] },
  // Future: { id: 'text-viewer', name: 'Text Viewer', supportedTypes: ['file'] },
  // Future: { id: 'image-viewer', name: 'Image Viewer', supportedTypes: ['file'] },
];
```

Filter targets based on:
- Entry type (file vs folder)
- Optional: file extension/mime type (future enhancement)

**Task Checklist:**

\- [ ] Add PHASE_X contract to AI_STATE.md

\- [ ] Verify `open-with` intent type suffices (no new types needed)

\- [ ] Create `FILE_ACTION_TARGETS` registry in Files app

\- [ ] Implement "Open With..." modal component

\- [ ] Add Cmd/Ctrl+Shift+Enter shortcut to Files

\- [ ] Enhance shell dispatcher to handle `open-with` intents generically

\- [ ] Add static "File: Open With..." to System Search (context-aware)

\- [ ] Write tests:
  - [ ] Intent emitted with correct payload for selected file
  - [ ] No intent for folders (or folder-specific intent)
  - [ ] Modal blocks shortcuts (PHASE_W guard)
  - [ ] "Open With" modal lists targets + routes correctly
  - [ ] Shell routes to target app with correct props
  - [ ] Unknown target handled safely (no crash)
  - [ ] Multi-window Files: actions only affect focused window
  - [ ] System Search action only available when Files focused + file selected

\- [ ] All tests pass with zero warnings

\- [ ] CI passes (test + build)

\- [ ] CHANGELOG.md reflects completion

**Definition of Done:**

\- User can select a file in Files and press Cmd/Ctrl+Shift+Enter to open "Open With..." modal

\- Modal shows available target apps (at minimum: Logic Playground)

\- Selecting a target dispatches `open-with` intent and opens target app

\- Shell correctly routes intent to target app with file context

\- System Search shows "File: Open With..." when Files focused + file selected

\- All actions respect modal guards (PHASE_W)

\- All actions are keyboard-accessible

\- No async, no file indexing, no background work

\- All tests pass (success + failure + edge cases), zero warnings

\- Build passes, contracts logged


---



\## PHASE\_Y: Open-With Payload + Target Consumption Contract

### Open-With Payload Routing and Target App File Loading

**Goal:**

Complete the "Open With" workflow by enabling Files to pass deterministic file payload (ID + metadata) through the Intent system, and enable Logic Playground to synchronously load and display the selected file.

**Non-Goals:**

\- No async file loading (synchronous only)

\- No file content indexing or search

\- No background workers

\- No auto-save or auto-reload behaviors

\- No multi-file selection (single file only)

**Invariants:**

\- **Payload integrity**: Files → Shell → Target app passes file metadata unchanged

\- **Synchronous loading**: Target app loads file content synchronously from FS store on mount

\- **Failure-safe**: Missing/invalid fileId → no-op (optional toast), never crash

\- **Focus behavior**: Target app focuses primary editor area after loading file

\- **Folder guard**: Folder selections remain no-op (file-only)

\- **Per-window context**: Open-with actions only operate on focused Files window's selected file

**Implementation Contracts:**

**1. Intent Payload Extension**

Current `open-with` intent payload:

```typescript
{
  type: 'open-with',
  payload: {
    sourceAppId: string,
    targetAppId: string,
    resourceId: string,
    resourceType: 'file' | 'folder'
  }
}
```

**Extension needed**: `resourceId` must be a deterministic file ID from the FS store that the target app can use to retrieve file content.

**Contract**: `resourceId` is the file's unique ID from `fsModel` (e.g., "notes", "file-2"). Target apps use this ID to look up file content from the shared FS store.

**2. Files App Payload Generation**

**Contract**:

\- When dispatching `open-with` intent, Files passes the selected file entry's `id` as `resourceId`

\- Already implemented in PHASE_X: `handleOpenWith(entry, targetAppId)` dispatches with `resourceId: entry.id`

\- No changes needed (payload already correct)

**3. Shared FS Store Access**

**Contract**:

\- Target apps need read-only access to the same FS store that Files uses

\- Options:

  1. Export `fsModel` functions as read-only utilities

  2. Create shared FS context provider

  3. Pass file content directly in intent payload (violates separation of concerns)

**Decision**: Export read-only FS access functions from `fsModel` for target apps to consume.

**4. Logic Playground Intent Handler**

**Contract**:

\- On component mount, check if window was opened via `open-with` intent

\- If yes, extract `resourceId` from intent payload

\- Synchronously load file content from FS store using `resourceId`

\- Populate editor with file content

\- Focus editor

\- If `resourceId` invalid/missing: no-op (optional toast), never throw

**5. Focus Behavior**

**Contract**:

\- After loading file, Logic Playground focuses the primary editor area

\- User can immediately start typing without clicking

**Definition of Done:**

\- Files dispatches `open-with` with deterministic `resourceId`

\- Logic Playground receives intent and loads file content synchronously

\- Editor populated with file content and focused

\- Invalid `resourceId` handled gracefully (no crash)

\- Folders still no-op

\- PHASE_X tests still pass (no regressions)

\- New tests: payload routing, target load, failure cases

\- Zero async, zero warnings

\- All tests pass, build passes


---



\## PHASE\_Z: Multi-Target Open With + Deterministic Focus Contract

### Expand FILE\_ACTION\_TARGETS and Remove Focus Timing Hacks

**Goal:**

Expand the open-with system to support multiple target apps with deterministic eligibility based on file type, and eliminate setTimeout hacks from focus behavior by implementing deterministic focus mechanisms.

**Non-Goals:**

\- No real filesystem I/O or async loading

\- No background workers or indexing

\- No drag-and-drop between apps

\- No file watchers or change detection

\- No MIME type detection (extension-based eligibility only)

**Invariants:**

\- **Multi-target support**: FILE\_ACTION\_TARGETS registry contains at least 2 real target apps

\- **Deterministic eligibility**: Target eligibility based on resourceType + file extension predicates (no timing or async)

\- **Deterministic focus**: Focus behavior uses requestAnimationFrame or existing focus managers (no setTimeout)

\- **Failure-safe**: Unknown resources/targets result in no-op, never crash

\- **Synchronous loading**: All file loading and focus operations remain synchronous

\- **Per-window state**: Each target app window maintains independent state

**Target Registry Structure:**

```typescript
interface FileActionTarget {
  id: string;
  name: string;
  isEligible: (resourceType: 'file' | 'folder', resourceName: string) => boolean;
}

const FILE_ACTION_TARGETS: FileActionTarget[] = [
  {
    id: 'logic-playground',
    name: 'Logic Playground',
    isEligible: (type, name) => type === 'file' && name.endsWith('.rblogic'),
  },
  {
    id: 'text-viewer', // or existing app
    name: 'Text Viewer',
    isEligible: (type, name) => type === 'file' && (name.endsWith('.txt') || name.endsWith('.md')),
  },
  // Additional targets as needed
];
```

**Eligibility Rules:**

\- Predicates are pure functions (resourceType, resourceName) → boolean

\- File extensions are case-sensitive (matches Files app metadata)

\- Folder entries always return false for file-only targets

\- Open With modal only shows eligible targets for selected entry

\- If no eligible targets: Open With button disabled or hidden

**Focus Behavior Changes:**

**Before (PHASE\_Y):**
```typescript
// LogicPlaygroundApp.tsx
setTimeout(() => canvasAreaRef.current?.focus(), 100);
```

**After (PHASE\_Z):**
```typescript
// LogicPlaygroundApp.tsx - Option A: requestAnimationFrame
useEffect(() => {
  if (canvasAreaRef.current) {
    requestAnimationFrame(() => {
      canvasAreaRef.current?.focus();
    });
  }
}, [/* mount or file load trigger */]);

// OR Option B: Existing focus manager (if available)
// focusManager.focusCanvas(canvasAreaRef);
```

**Contract:**
\- Remove all setTimeout calls used for focus behavior in target apps

\- Use requestAnimationFrame for deferred focus (single frame delay)

\- Or use existing focus management utilities if available

\- Focus must be deterministic and testable without vi.advanceTimersByTime

**Second Target App:**

\- Identify suitable existing app (TextViewer, ImageViewer, or similar)

\- If no suitable app exists, create minimal viewer for .txt/.md files

\- Target app must:
  - Handle open-with intent with resourceId payload
  - Load file content synchronously from filesStore
  - Focus primary content area deterministically (no setTimeout)
  - Handle invalid resourceId gracefully (no crash)

**Open With Modal Changes:**

\- Filter FILE\_ACTION\_TARGETS by eligibility predicate before displaying

\- Default selection: first eligible target

\- Keyboard navigation unchanged (Arrow/Enter/Escape)

\- Empty target list: modal shows "No compatible apps" message

**Testing Requirements:**

1. **Eligibility Tests**:
   - Logic Playground eligible for .rblogic files only
   - Second target eligible for its file types only
   - Folders return no eligible targets (or folder-specific targets)
   - Unknown extensions return no eligible targets

2. **Multi-Target Tests**:
   - Open With modal lists all eligible targets
   - Modal filters ineligible targets
   - Selecting each target routes to correct app
   - Default selection is first eligible target

3. **Focus Tests**:
   - Focus applied without setTimeout (no vi.useFakeTimers needed)
   - Focus applied within single requestAnimationFrame
   - Focus testable with synchronous assertions
   - No race conditions or flaky focus behavior

4. **Failure-Safe Tests**:
   - Invalid resourceId → no crash, optional toast
   - Unknown targetAppId → no crash, no-op
   - Empty eligible targets → Open With disabled/hidden

**Implementation Checklist:**

\- [ ] Add PHASE\_Z contract to AI_STATE.md

\- [ ] Audit existing apps to identify suitable second target

\- [ ] Expand FILE\_ACTION\_TARGETS with eligibility predicates

\- [ ] Update Open With modal to filter by eligibility

\- [ ] Implement open-with handler in second target app

\- [ ] Remove setTimeout from LogicPlaygroundApp focus behavior

\- [ ] Implement deterministic focus (rAF or focus manager)

\- [ ] Write eligibility tests (registry, modal filtering)

\- [ ] Write multi-target tests (dispatch, routing, focus)

\- [ ] Write focus determinism tests (no timers, synchronous assertions)

\- [ ] Run full test suite (zero warnings), run build

\- [ ] Update CHANGELOG.md with PHASE\_Z completion

**Definition of Done:**

\- FILE\_ACTION\_TARGETS contains at least 2 real targets with eligibility predicates

\- Open With modal filters targets by resourceType + file extension

\- Second target app handles open-with intent and loads files synchronously

\- All setTimeout calls removed from focus behavior in target apps

\- Focus behavior deterministic and testable without fake timers

\- All tests pass with zero warnings (PHASE\_R gate)

\- CI passes (test + build)

\- Contracts and completion logged


---



\## PHASE\_AA: File Associations + Deterministic Default Target Resolution

### Goal

Make Files feel like a daily-driver app by implementing persistent default target associations per file type (extension + resourceType), eliminating modal friction for repeated open-with actions, and making the default target transparent and keyboard-accessible.

### Non-Goals

\- No MIME type detection (extension-based only)

\- No user-configurable file type registrations (static extension → app mappings)

\- No per-file overrides (defaults apply to all files of same type)

\- No async in feature path

\- No new persistence infrastructure (reuse existing settings/localStorage patterns)

### Invariants

\- **Deterministic default resolution**: `resolveDefaultTarget(fileMeta, eligibleTargets[]) -> targetId` is pure and deterministic

\- **Fallback to first eligible target**: If no default saved, use stable first eligible target from FILE\_ACTION\_TARGETS

\- **Extension normalization**: Extensions are lowercase, no leading dot (e.g., "rblogic", "txt", "md")

\- **Failure-safe**: Unknown extensions → no-op; invalid targetIds → fallback to first eligible; folders remain no-op

\- **Keyboard-first**: All operations executable without mouse (D to set default, Shift+D to clear default)

\- **Persistence**: File associations persist to localStorage and survive reload

\- **Zero warnings**: Tests must pass with PHASE\_R "fail on warnings" gate

### Data Model

File associations store structure:

```typescript
interface FileAssociationsState {
  // Map: resourceType -> extension -> targetId
  associations: {
    [resourceType in 'file' | 'folder']?: {
      [extension: string]: string; // targetId
    };
  };
}
```

Example:
```typescript
{
  associations: {
    file: {
      rblogic: 'logic-playground',
      txt: 'text-viewer',
      md: 'text-viewer',
    },
  },
}
```

### API Contracts

**1. getDefaultTarget(resourceType, extension): targetId | null**
   - Returns saved default target for this file type
   - Extension normalized (lowercase, no leading dot)
   - Returns null if no default saved

**2. setDefaultTarget(resourceType, extension, targetId): void**
   - Saves default target for this file type
   - Extension normalized before storage
   - Persists to localStorage immediately

**3. clearDefaultTarget(resourceType, extension): void**
   - Removes default target for this file type
   - Extension normalized before deletion
   - Persists to localStorage immediately

**4. resolveDefaultTarget(fileMeta, eligibleTargets[]): targetId**
   - Pure function: (resourceType, extension, eligibleTargets[]) → targetId
   - Returns saved default if exists and is in eligibleTargets
   - Falls back to first eligible target if no default or invalid default
   - Throws if eligibleTargets is empty (caller must check isFileActionEligible first)

### Keyboard Shortcuts

\- **Cmd/Ctrl+Enter**: Uses default target for file type; falls back to first eligible target if none saved
\- **Cmd/Ctrl+Shift+Enter**: Opens "Open With" modal (existing PHASE\_X behavior)
\- **D key in modal**: Set selected target as default for this file type (shows "Set as Default" indicator)
\- **Shift+D in modal**: Clear default for this file type (shows "Clear Default" indicator)

### UI Changes

**Open With Modal Enhancements:**
\- Selected target shows **\[DEFAULT]** marker if it's the saved default for this file type
\- Footer shows keyboard hints: "D: Set Default | Shift+D: Clear Default | Enter: Open | Esc: Cancel"
\- Setting default closes modal and opens file with that target (same as Enter)
\- Clearing default does NOT close modal (user can still select a target)

**Files App Default-Open Behavior:**
\- Cmd/Ctrl+Enter uses `resolveDefaultTarget()` to get targetId
\- Dispatches `open-with` intent with resolved targetId
\- No modal friction for repeated actions on same file type

### Persistence Requirements

\- Use existing localStorage pattern (same as settings, workspaces, macros)
\- Store key: `rb:file-associations`
\- Schema validation: ignore corrupted data, reset to empty state
\- Persist immediately on setDefaultTarget/clearDefaultTarget (no batching)

### Failure-Safe Behavior

\- Folders remain no-op (isFileActionEligible guards apply)
\- Unknown file extensions → no eligible targets → Cmd/Ctrl+Enter is no-op
\- Invalid saved targetId (app unregistered) → fallback to first eligible target
\- Empty eligibleTargets → resolveDefaultTarget throws (Files must guard with isFileActionEligible)
\- Corrupted localStorage → reset to empty associations, no crash

### Testing Requirements

**1. Association Store Tests:**
   - getDefaultTarget/setDefaultTarget/clearDefaultTarget operations
   - Extension normalization (".txt" → "txt", "TXT" → "txt")
   - Persistence to localStorage
   - Corrupted data handling (invalid JSON, invalid schema)

**2. Default Resolver Tests:**
   - resolveDefaultTarget returns saved default if eligible
   - Falls back to first eligible target if no default
   - Falls back to first eligible if saved default not in eligibleTargets
   - Throws if eligibleTargets empty (caller violation)

**3. Files Routing Tests:**
   - Cmd/Ctrl+Enter uses default target for known file type
   - Cmd/Ctrl+Enter falls back to first eligible if no default
   - Cmd/Ctrl+Enter dispatches open-with intent with correct targetId
   - Folders remain no-op

**4. Open With Modal Tests:**
   - D key sets default and closes modal
   - Shift+D clears default and keeps modal open
   - \[DEFAULT] marker shows for saved default target
   - Modal guards (no D/Shift+D when typing in search input)

**5. Regression Tests:**
   - PHASE\_X/Y/Z tests still pass (no regressions to multi-target, payload routing, eligibility)
   - 303 baseline tests still pass with zero warnings

### Implementation Checklist

\- [ ] Add PHASE\_AA contract to AI\_STATE.md (this section)
\- [ ] Audit existing persistence/settings architecture
\- [ ] Implement file associations store (Zustand or standalone module)
\- [ ] Implement extension normalization helper
\- [ ] Implement getDefaultTarget/setDefaultTarget/clearDefaultTarget
\- [ ] Implement resolveDefaultTarget with deterministic fallback
\- [ ] Wire Files default-open behavior (Cmd/Ctrl+Enter)
\- [ ] Wire Open With modal keyboard actions (D/Shift+D)
\- [ ] Add \[DEFAULT] marker display in modal
\- [ ] Write association store tests
\- [ ] Write resolver tests
\- [ ] Write Files routing tests
\- [ ] Write modal UX tests
\- [ ] Run full test suite (zero warnings)
\- [ ] Run build
\- [ ] Update CHANGELOG.md with PHASE\_AA completion

### Definition of Done

\- Users can press Cmd/Ctrl+Enter on a file in Files to open with default target
\- Default targets persist across reload
\- D key in Open With modal sets default for file type
\- Shift+D key in Open With modal clears default for file type
\- \[DEFAULT] marker visible in Open With modal for saved defaults
\- Deterministic fallback to first eligible target when no default saved
\- All operations keyboard-accessible
\- No async in feature path
\- Tests cover success + failure + edge cases exhaustively
\- Entire suite passes with zero warnings, build passes
\- Contracts and completion logged


---



\## PHASE\_AB: File Association Manager UI

### Goal

Provide keyboard-first UI to view and edit file associations, with reset/import/export capabilities for power users and deterministic failure-safe operations.

### Non-Goals

\- No drag-and-drop UI (keyboard-first only)

\- No MIME type editing (extension-based only, inherited from PHASE\_AA)

\- No inline extension creation (only edit existing associations from FILE\_ACTION\_TARGETS)

\- No async flows (synchronous import/export/reset operations)

\- No new persistence infrastructure (reuse fileAssociationsStore)

### Invariants

\- **Keyboard-first navigation**: Arrow keys navigate, Enter edits, Delete clears, R resets, E exports, I imports

\- **Eligible targets only**: Target picker shows only eligible apps from FILE\_ACTION\_TARGETS for each extension

\- **Deterministic ordering**: Associations listed in stable alphabetical order by extension

\- **Failure-safe import**: Invalid JSON → toast + no-op; unknown targetIds → filter or reject with toast

\- **Atomic operations**: Reset/import are all-or-nothing (no partial state)

\- **Zero async**: All operations synchronous, deterministic focus

### UI Components

**Association Manager Panel** (hosted in Settings app):

\- List view showing: extension | current default target | [DEFAULT] marker

\- Stable ordering: alphabetical by extension

\- Keyboard navigation: Arrow up/down, Enter to edit, Delete to clear

\- Footer shortcuts: R: Reset All | E: Export | I: Import | Esc: Close

**Target Picker Modal**:

\- Context: extension + resourceType

\- Shows only eligible targets from FILE\_ACTION\_TARGETS

\- Arrow keys navigate, Enter selects, Escape cancels

\- Reuses OpenWithModal pattern from PHASE\_AA

**Reset Confirmation Modal**:

\- "Reset all file associations? This will clear all default targets."

\- Enter confirms, Escape cancels

\- On confirm: calls store.resetAll()

**Export Modal**:

\- Readonly textarea with canonical JSON (stable key ordering)

\- Instructions: "Copy JSON below to save file associations"

\- Escape closes

**Import Modal**:

\- Editable textarea for JSON paste

\- Enter applies (validates schema, normalizes extensions, filters unknown targetIds)

\- Invalid JSON → toast "Invalid JSON format" + modal remains open

\- Unknown targetIds → toast "Filtered unknown apps: appId1, appId2" + apply valid mappings

\- Escape cancels

### Store API Extensions

Add to fileAssociationsStore:

**1. listAssociations(): Array<{ extension: string; targetId: string; resourceType: 'file' | 'folder' }>**

   \- Returns all saved associations in stable alphabetical order by extension

   \- Normalized extensions (lowercase, no leading dot)

**2. resetAll(): void**

   \- Clears all associations

   \- Persists empty state to localStorage

**3. exportJson(): string**

   \- Returns canonical JSON string with stable key ordering

   \- Example: `{"file":{"md":"text-viewer","rblogic":"logic-playground","txt":"text-viewer"}}`

**4. importJson(jsonString: string): { success: boolean; unknownTargets?: string[] }**

   \- Validates JSON shape (must match FileAssociationsState schema)

   \- Normalizes extensions (lowercase, no leading dot)

   \- Filters unknown targetIds (not in FILE\_ACTION\_TARGETS)

   \- Returns success status + list of filtered apps (for toast)

   \- On success: replaces entire associations state atomically

   \- On failure: no-op, returns { success: false }

### Keyboard Shortcuts

**In Association Manager Panel:**

\- **Arrow Up/Down**: Navigate association rows

\- **Enter**: Edit default target for selected extension (opens Target Picker Modal)

\- **Delete/Backspace**: Clear mapping for selected extension

\- **R**: Reset all mappings (opens Reset Confirmation Modal)

\- **E**: Export (opens Export Modal with JSON)

\- **I**: Import (opens Import Modal with textarea)

\- **Escape**: Close panel

**In Modals:**

\- Target Picker: Arrow Up/Down, Enter selects, Escape cancels

\- Reset Confirmation: Enter confirms, Escape cancels

\- Export: Escape closes

\- Import: Enter applies, Escape cancels

### Integration

**Settings App:**

\- Add "File Associations" panel/section

\- Reachable via Settings sidebar navigation

\- Uses existing Settings app patterns (sidebar + panel layout)

**FILE\_ACTION\_TARGETS Registry:**

\- Manager reads FILE\_ACTION\_TARGETS to get eligible apps per extension

\- Only shows targets where isEligible(resourceType, extension) returns true

\- Maintains single source of truth for available apps

### Testing Requirements

**1. Store Tests:**

   \- listAssociations() returns stable alphabetical order

   \- resetAll() clears all mappings and persists

   \- exportJson() returns canonical JSON with stable keys

   \- importJson() validates schema, normalizes extensions, filters unknown targetIds

   \- importJson() rejects invalid JSON (no crash, returns failure)

**2. UI Tests:**

   \- Arrow keys navigate rows

   \- Enter opens Target Picker with eligible targets only

   \- Delete clears mapping

   \- R opens Reset Confirmation

   \- E opens Export Modal with current JSON

   \- I opens Import Modal

   \- Import with valid JSON updates store

   \- Import with invalid JSON shows toast + no-op

**3. Regression Tests:**

   \- Files Cmd/Ctrl+Enter still honors defaults after manager edits

   \- Files Cmd/Ctrl+Enter still honors defaults after reset

   \- Files Cmd/Ctrl+Enter still honors defaults after import

   \- PHASE\_AA tests still pass (no regressions)

### Implementation Checklist

\- [ ] Add PHASE\_AB contract to AI\_STATE.md (this section)

\- [ ] Audit Settings app structure (or identify host for manager UI)

\- [ ] Implement listAssociations/resetAll/exportJson/importJson in fileAssociationsStore

\- [ ] Write store tests for new helpers (stable ordering, schema validation, unknown targetId filtering)

\- [ ] Implement Association Manager Panel component

\- [ ] Implement Target Picker Modal (reuse OpenWithModal pattern)

\- [ ] Implement Reset/Export/Import modals

\- [ ] Wire manager panel into Settings app

\- [ ] Add UI tests (navigation, edit/clear/reset, import validation)

\- [ ] Add regression tests (Files still works after manager operations)

\- [ ] Run full test suite (zero warnings)

\- [ ] Run build

\- [ ] Update CHANGELOG.md with PHASE\_AB completion

### Definition of Done

\- Users can open File Associations panel in Settings

\- Arrow keys navigate associations list

\- Enter edits default target (shows only eligible apps)

\- Delete clears mapping for selected extension

\- R resets all mappings (with confirmation)

\- E exports associations as canonical JSON

\- I imports associations from JSON (validates schema, filters unknown apps, shows toast on error)

\- All operations keyboard-accessible

\- No async in feature path

\- Import is failure-safe (invalid JSON → no-op + toast, never crash)

\- Tests cover success + failure + edge cases exhaustively

\- Entire suite passes with zero warnings, build passes

\- Regression: Files Cmd/Ctrl+Enter still works after all manager operations

\- Contracts and completion logged


---



\## PHASE\_AC: Deterministic Window Routing for Open-With

### Goal

Eliminate duplicate windows for open-with actions by implementing deterministic window reuse policy (prefer most-recently-focused window for target appId, else oldest window, else create new), with keyboard toggle (N key) in Open With modal to force new window creation when desired.

### Non-Goals

\- No session-based routing persistence (routing is runtime-only, based on current window state)

\- No user-configurable routing policies (single deterministic policy for all apps)

\- No window grouping/tabbing (pure reuse vs create decision)

\- No async routing (synchronous resolution based on current window store state)

\- No routing for non-intent flows (window routing applies only to open-with intents)

### Invariants

\- **Deterministic routing**: `resolveTargetWindowId(appId, preferNewWindow) -> windowId | null` is pure, deterministic, based on current window store state

\- **Focus history**: Track last-focused timestamp per window; update on focus events only (no timers)

\- **Reuse policy**: Default behavior is reuse most-recently-focused window for target appId (if exists), else oldest window for appId, else create new

\- **New-window override**: When `preferNewWindow=true`, always create new window regardless of existing windows

\- **Failure-safe**: Missing routing metadata → fallback to create-new (no crashes)

\- **Keyboard-first**: N key toggle in Open With modal controls new-window preference

\- **Zero async**: All routing resolution synchronous, deterministic focus (rAF-only if needed)

### Routing Policy

**resolveTargetWindowId(appId: string, preferNewWindow: boolean): string | null**

\- If `preferNewWindow=true`: return `null` (always create new window)

\- Get all windows for `appId` from window store

\- If no windows exist: return `null` (create new)

\- If windows exist:

  \- Filter to normal/maximized mode windows (skip minimized)

  \- If focus history available: return most-recently-focused window ID

  \- Else: return oldest window ID (stable tie-break using creation order or window ID sort)

**Focus History Tracking:**

\- Add `lastFocusedAt?: number` field to WindowState

\- Update on `focusWindow` action: set `lastFocusedAt = Date.now()`

\- No timers, no debouncing (update immediately on focus event)

### UI Changes

**Open With Modal (Files app):**

\- Add **N key** toggle: "Open in New Window" (default OFF)

\- Visual indicator: checkbox or toggle state next to selected target

\- When toggled ON: show "Will open in new window" hint

\- When launching target (Enter or D default-set):

  \- Include `preferNewWindow` flag in intent dispatch metadata

  \- Pass to Shell routing resolver

\- Footer keyboard hints: "N: New Window | D: Set Default | Enter: Open | Esc: Cancel"

**Default-Open Behavior (Files Cmd/Ctrl+Enter):**

\- Uses same routing policy with `preferNewWindow=false` (always reuse by default)

\- No UI change (transparent reuse vs create decision)

### Intent Dispatch Changes

**Current open-with intent payload:**

```typescript
{
  type: 'open-with',
  targetId: 'text-viewer',
  payload: { resourceId: '/Home/Notes.txt' }
}
```

**New routing metadata (separate from payload):**

```typescript
{
  type: 'open-with',
  targetId: 'text-viewer',
  payload: { resourceId: '/Home/Notes.txt' },
  routingHint: { preferNewWindow: false }
}
```

\- Routing hint is NOT part of intent payload (apps don't see it)

\- Shell consumes routing hint during dispatch to resolve target window

\- Intent payload remains immutable (PHASE\_K contract preserved)

### Shell Integration

**dispatchIntent changes:**

1. Extract `routingHint` from intent metadata (if present)

2. Call `resolveTargetWindowId(targetAppId, routingHint?.preferNewWindow ?? false)`

3. If windowId returned:

   \- Deliver intent to that window (existing window.handleIntent)

   \- Focus that window (bringToFront)

4. Else:

   \- Create new window for targetAppId

   \- Deliver intent to new window

   \- Focus new window

**Window store changes:**

\- Add `lastFocusedAt?: number` to WindowState interface

\- Update `focusWindow` action to set `lastFocusedAt = Date.now()`

\- Add `resolveTargetWindowId` helper (can be pure function outside store)

### Testing Requirements

**1. Routing Policy Tests (unit):**

   \- No windows exist → returns null (create new)

   \- One window exists → returns that window ID

   \- Multiple windows exist + focus history → returns most-recently-focused

   \- Multiple windows exist + no focus history → returns oldest (deterministic tie-break)

   \- preferNewWindow=true → always returns null

   \- Minimized windows excluded from reuse candidates

**2. Focus History Tests:**

   \- focusWindow updates lastFocusedAt timestamp

   \- Multiple focus events update timestamps correctly

   \- Newly created windows have no lastFocusedAt (undefined)

**3. Intent Dispatch Integration Tests:**

   \- Open-with intent + no existing windows → creates new window

   \- Open-with intent + existing window → reuses window (no duplicate)

   \- Open-with intent + preferNewWindow=true → creates new window (ignores existing)

   \- Open-with intent + multiple windows → reuses most-recently-focused

   \- Intent payload delivered correctly to target window

**4. Files/OpenWith UI Tests:**

   \- N key toggles new-window state

   \- Enter with new-window ON → dispatches with preferNewWindow=true

   \- Enter with new-window OFF → dispatches with preferNewWindow=false

   \- D key default-set honors new-window state

**5. Regression Tests:**

   \- PHASE\_X/Y/Z tests still pass (cross-app file actions)

   \- PHASE\_AA tests still pass (default target resolution)

   \- PHASE\_AB tests still pass (association manager)

   \- Default-open (Cmd/Ctrl+Enter) uses reuse policy by default

### Implementation Checklist

\- [ ] Add PHASE\_AC contract to AI\_STATE.md (this section)

\- [ ] Audit current window creation/focus model in rb-shell

\- [ ] Add `lastFocusedAt` field to WindowState interface

\- [ ] Update `focusWindow` action to set timestamp

\- [ ] Implement `resolveTargetWindowId` routing resolver (pure function)

\- [ ] Update `dispatchIntent` to use routing resolver

\- [ ] Add routing policy unit tests

\- [ ] Add focus history tests

\- [ ] Wire N key toggle in Open With modal (Files)

\- [ ] Update Open With modal to include routingHint in intent dispatch

\- [ ] Add Files/OpenWith UI tests for N key toggle

\- [ ] Add intent dispatch integration tests

\- [ ] Run full test suite (zero warnings)

\- [ ] Run build

\- [ ] Update CHANGELOG.md with PHASE\_AC completion

### Definition of Done

\- Open-with intents reuse most-recently-focused window for target appId by default

\- No duplicate windows created for repeated open-with actions on same app

\- N key in Open With modal toggles new-window mode

\- New-window mode creates new window regardless of existing windows

\- Focus history tracked deterministically (no timers)

\- Routing resolver is pure and deterministic

\- Default-open (Cmd/Ctrl+Enter) uses reuse policy by default

\- All operations keyboard-accessible

\- No async in routing path

\- Tests cover reuse policy + new-window mode + focus history + regressions

\- Entire suite passes with zero warnings, build passes

\- Contracts and completion logged


---



\## PHASE\_AD: System Search Files Provider + Default Open + Open With

### Goal

Enable file discovery and opening via System Search (Cmd/Ctrl+Space) by implementing a deterministic Files provider backed by fsModel, with default-open using PHASE\_AA associations and PHASE\_AC window routing, plus keyboard-accessible Open With modal for choosing alternate targets.

### Non-Goals

\- No background indexing or async file scanning (purely in-memory fsModel)

\- No fuzzy matching or scoring algorithms (simple case-insensitive prefix/contains matching)

\- No folder results in Files provider (files only; folders excluded or no-op)

\- No new modal components (reuse existing Open With modal from Files app)

\- No session-based recent files (search results derive from current fsModel state only)

### Invariants

\- **Pure deterministic matching**: Query matching is case-insensitive, stable sort, deterministic tie-break

\- **No async**: All file search logic synchronous, derives from in-memory fsModel

\- **Keyboard-first**: Enter opens with default target, Shift+Enter (or O) opens Open With modal

\- **Default target resolution**: Uses PHASE\_AA `resolveDefaultTarget` with eligible targets from FILE\_ACTION\_TARGETS

\- **Window routing**: Uses PHASE\_AC routing policy (reuse most-recently-focused window by default)

\- **Failure-safe**: Invalid resourceId never crashes; folders either excluded or actions no-op

\- **Zero warnings**: Tests must pass with PHASE\_R gate

### Files Provider

**Data Source**: fsModel (files only, no folders)

**Query Matching** (pure, deterministic):

\- Case-insensitive matching on file name

\- Scoring tiers:

  1\. **Prefix match** (starts with query): score = 2

  2\. **Contains match** (includes query): score = 1

  3\. **No match**: excluded

\- Stable sort: `(score DESC, name ASC, id ASC)`

\- Deterministic tie-break using resource ID

**Result Format**:

```typescript
{
  type: 'file',
  id: string, // resourceId from fsModel
  label: string, // display name (e.g., "Notes.txt")
  description: string, // optional path or metadata
  extension: string, // extracted extension (e.g., "txt")
  resourceType: 'file',
}
```

### Search Result Actions

**Enter Key** (default open):

\- Extract extension from filename

\- Get eligible targets using `getFileActionTargets(fileMeta)`

\- If no eligible targets → no-op (guard)

\- Resolve target using `resolveDefaultTarget(resourceType, extension, eligibleTargets)` (PHASE\_AA)

\- Dispatch open-with intent with:

  \- targetAppId from resolution

  \- resourceId from result

  \- routingHint: default reuse policy (no preferNewWindow flag)

\- Uses PHASE\_AC window routing (reuse most-recently-focused window)

**Shift+Enter Key** (or O key) (open-with):

\- Extract extension from filename

\- Get eligible targets using `getFileActionTargets(fileMeta)`

\- If no eligible targets → no-op (guard)

\- Open Open With modal pre-scoped to file:

  \- Pass eligible targets only

  \- Pass resourceType and extension for association state

  \- Modal shows \[DEFAULT] marker for saved default

  \- N key toggle for new-window mode

  \- D key to set default

  \- Reuse existing modal component from Files app

### System Search Integration

**Provider Registration**:

\- Add "Files" provider to searchRegistry

\- Provider function signature: `(query: string) => FileSearchResult[]`

\- Synchronous execution (no promises)

**Result Display**:

\- Group header: "Files"

\- Result item shows: file name + optional path/description

\- Keyboard navigation: Arrow keys, Enter, Shift+Enter

\- Esc closes search without action

### Testing Requirements

**1. Files Provider Tests (unit):**

   \- Empty query → empty results

   \- Prefix match scores higher than contains match

   \- Stable ordering: same query always produces same order

   \- Deterministic tie-break (score, name, id)

   \- Excludes folders (files only)

   \- Case-insensitive matching ("NOT" matches "Notes.txt")

**2. Action Dispatch Tests:**

   \- Enter dispatches open-with intent with targetId from associations

   \- Enter uses fallback to first eligible target if no default

   \- Enter with no eligible targets → no-op (no crash)

   \- Shift+Enter opens Open With modal with eligible targets only

   \- Invalid resourceId → no crash (failure-safe)

**3. Integration Tests:**

   \- Search query → file result → Enter opens default target

   \- Search query → file result → Shift+Enter opens Open With modal

   \- Window routing honors reuse policy (no duplicate windows)

   \- Association state honored (saved default used)

**4. Regression Tests:**

   \- All PHASE\_X/Y/Z/AA/AB/AC tests still pass

   \- System Search app/command/macro results still work

### Implementation Checklist

\- [ ] Add PHASE\_AD contract to AI\_STATE.md (this section)

\- [ ] Audit current System Search architecture (providers, actions, registry)

\- [ ] Implement Files search provider (pure function, deterministic scoring)

\- [ ] Register Files provider in searchRegistry

\- [ ] Implement Enter action (default open with associations + routing)

\- [ ] Implement Shift+Enter action (open Open With modal)

\- [ ] Add Files provider unit tests (scoring, ordering, determinism)

\- [ ] Add action dispatch tests (Enter, Shift+Enter, guards)

\- [ ] Add integration tests (search → open, window routing, associations)

\- [ ] Run full test suite (zero warnings)

\- [ ] Run build

\- [ ] Update CHANGELOG.md with PHASE\_AD completion

### Definition of Done

\- Users can search for files via System Search (Cmd/Ctrl+Space)

\- Typing "notes" shows "Notes.txt" in Files group

\- Enter opens file with default target (PHASE\_AA association or first eligible)

\- Window routing reuses most-recently-focused window (PHASE\_AC)

\- Shift+Enter opens Open With modal pre-scoped to file

\- Open With modal shows only eligible targets for file type

\- All operations keyboard-accessible

\- No async in search path

\- Results are deterministic (stable ordering)

\- Tests cover provider logic + actions + integration

\- Entire suite passes with zero warnings, build passes

\- Contracts and completion logged


---



\## PHASE\_AE — System Search Open-With Modal \+ Files Global Store Unification (IN PROGRESS)



### Goal

Complete PHASE\_AD by enabling Shift+Enter to open a reusable Open With modal directly from System Search, pre-scoped to the selected file result with eligible targets only. Additionally, unify Files app filesystem state with the global fileSystemStore to eliminate duplication and ensure System Search and Files app always see identical file trees.



### Non-Goals

\- NO new modal component from scratch (extract and generalize existing Open With modal from Files app)

\- NO async operations in modal opening or target resolution

\- NO changes to FILE\_ACTION\_TARGETS registry or eligibility predicates (reuse PHASE\_Z)

\- NO changes to file associations logic (reuse PHASE\_AA)

\- NO changes to window routing logic (reuse PHASE\_AC)

\- NO breaking changes to Files app keyboard shortcuts or workflows



### Invariants

1\. **Deterministic Modal State**: Modal receives pre-computed eligible targets (no async target resolution)

2\. **Keyboard-First Navigation**: All modal operations accessible via keyboard (arrow keys, Enter, D, Shift+D, N, Esc)

3\. **Zero Timers**: No setTimeout/setInterval for focus management (rAF acceptable for DOM synchronization)

4\. **Failure-Safe Modal**: Invalid resourceId or zero eligible targets → no-op (log warning, don't crash)

5\. **Single Source of Truth**: fileSystemStore is canonical for all filesystem state (Files app reads from it, never duplicates)

6\. **Stable IDs**: File resourceIds remain unchanged across store migration (no test breakage)

7\. **Zero Regressions**: All PHASE\_X/Y/Z/AA/AB/AC/AD tests continue passing



### Shared Open With Modal Component



**Component Name**: `OpenWithModal`

**Location**: `packages/rb-shell/src/components/OpenWithModal.tsx` (or `packages/rb-apps/src/components/OpenWithModal.tsx`)



**Props Interface**:

```typescript

interface OpenWithModalProps {

  // Resource metadata

  resourceId: string;

  resourceType: 'file' \| 'folder';

  resourceName: string; // Display name (e.g., "Notes.txt")

  extension: string; // Extracted extension (e.g., "txt")



  // Eligible targets (pre-computed, deterministic)

  eligibleTargets: FileActionTarget\[\];



  // Current default target (from file associations store)

  currentDefaultTargetId?: string \| null;



  // Callbacks

  onChoose: (targetId: string, routingHint?: { preferNewWindow?: boolean }) => void;

  onSetDefault: (targetId: string) => void;

  onClearDefault: () => void;

  onClose: () => void;

}

```



**Key Bindings**:

\- **Arrow Up/Down**: Navigate target list

\- **Enter**: Choose selected target with current routingHint

\- **D**: Set selected target as default (calls onSetDefault)

\- **Shift+D**: Clear default association (calls onClearDefault)

\- **N**: Toggle "Open in New Window" mode (updates routingHint)

\- **Esc**: Close modal (calls onClose)



**UI Requirements**:

\- Visual indicator when N toggled: "Will open in new window" banner

\- Keyboard hints footer: "↑↓: Navigate | Enter: Open | D: Set Default | Shift+D: Clear Default | N: New Window | Esc: Close"

\- Show \[DEFAULT\] marker next to current default target

\- Highlight selected target with cyan background

\- Display target name and description



**Extraction Strategy**:

1\. Copy modal logic from `packages/rb-apps/src/apps/files/modals.tsx` (OpenWithModal)

2\. Remove Files app-specific imports (getChildren, getPath, etc.)

3\. Accept all data via props (eligibleTargets, resourceName, etc.)

4\. Preserve all keyboard bindings and UI patterns

5\. Export as shared component



### System Search Integration



**File**: `packages/rb-shell/src/Shell.tsx`



**Updated Handler**: `handleSearchExecuteFile(fileId: string, shiftKey: boolean)`

```typescript

const handleSearchExecuteFile = useCallback(

  (fileId: string, shiftKey: boolean) => {

    const allFiles = useFileSystemStore.getState().getAllFiles();

    const file = allFiles.find((f) => f.id === fileId);



    if (\!file \|\| \!isFileActionEligible(file)) {

      console.warn(\`File not eligible: ${fileId}\`);

      return;

    }



    const eligibleTargets = getFileActionTargets(file);

    const extension = file.name.includes('.') ? file.name.split('.').pop() \|\| '' : '';

    const currentDefaultTargetId = useFileAssociationsStore.getState().getDefaultTarget(file.type, extension);



    if (shiftKey) {

      // Shift+Enter: Open With modal

      setOpenWithModalState({

        resourceId: file.id,

        resourceType: file.type,

        resourceName: file.name,

        extension,

        eligibleTargets,

        currentDefaultTargetId,

      });

    } else {

      // Enter: Default open

      const targetId = resolveDefaultTarget(file.type, extension, eligibleTargets);

      const target = eligibleTargets.find((t) => t.id === targetId);



      if (target) {

        dispatchIntent({

          type: 'open-with',

          payload: {

            sourceAppId: 'system-search',

            targetAppId: target.appId,

            resourceId: file.id,

            resourceType: file.type,

          },

        });

      }

    }

  },

  \[dispatchIntent\]

);

```



**Modal State Management**:

```typescript

const \[openWithModalState, setOpenWithModalState\] = useState<OpenWithModalState \| null>(null);



// Render modal

{openWithModalState && (

  <OpenWithModal

    resourceId={openWithModalState.resourceId}

    resourceType={openWithModalState.resourceType}

    resourceName={openWithModalState.resourceName}

    extension={openWithModalState.extension}

    eligibleTargets={openWithModalState.eligibleTargets}

    currentDefaultTargetId={openWithModalState.currentDefaultTargetId}

    onChoose={(targetId, routingHint) => {

      const target = openWithModalState.eligibleTargets.find((t) => t.id === targetId);

      if (target) {

        dispatchIntent({

          type: 'open-with',

          payload: {

            sourceAppId: 'system-search',

            targetAppId: target.appId,

            resourceId: openWithModalState.resourceId,

            resourceType: openWithModalState.resourceType,

          },

          routingHint,

        });

      }

      setOpenWithModalState(null);

    }}

    onSetDefault={(targetId) => {

      useFileAssociationsStore.getState().setDefaultTarget(

        openWithModalState.resourceType,

        openWithModalState.extension,

        targetId

      );

    }}

    onClearDefault={() => {

      useFileAssociationsStore.getState().clearDefaultTarget(

        openWithModalState.resourceType,

        openWithModalState.extension

      );

    }}

    onClose={() => setOpenWithModalState(null)}

  />

)}

```



### Files App Global Store Migration



**Current State**: Files app uses local `useState` with `fsModel` helpers



**Target State**: Files app reads from global `fileSystemStore` using Zustand subscriptions



**Migration Steps**:

1\. Replace `useState<FileSystemState>` with `useFileSystemStore` hook

2\. Update all filesystem mutations to use store actions:

   \- `createFolder` → `useFileSystemStore.getState().createFolder()`

   \- `createFile` → `useFileSystemStore.getState().createFile()`

   \- `renameEntry` → `useFileSystemStore.getState().renameEntry()`

   \- `deleteEntry` → `useFileSystemStore.getState().deleteEntry()`

3\. Update all filesystem reads to use store selectors:

   \- `getChildren` → `useFileSystemStore.getState().getChildren()`

   \- `getPath` → `useFileSystemStore.getState().getPath()`

4\. Verify all file IDs remain stable (no test breakage)



**Files App Updated Code** (`packages/rb-apps/src/apps/FilesApp.tsx`):

```typescript

import { useFileSystemStore } from '../stores/fileSystemStore';



const FilesComponent: React.FC<FilesProps> = ({ onClose, onDispatchIntent }) => {

  // Remove: const \[fs, setFs\] = useState<FileSystemState>(() => createInitialFsState());



  // Use global store

  const fs = useFileSystemStore((s) => s);

  const createFolder = useFileSystemStore((s) => s.createFolder);

  const createFile = useFileSystemStore((s) => s.createFile);

  const renameEntry = useFileSystemStore((s) => s.renameEntry);

  const deleteEntry = useFileSystemStore((s) => s.deleteEntry);

  const getChildren = useFileSystemStore((s) => s.getChildren);

  const getPath = useFileSystemStore((s) => s.getPath);



  // Update mutation handlers to use store actions

  const handleModalConfirm = () => {

    if (\!modal) return;



    try {

      if (modal.type === 'create-folder') {

        createFolder(currentFolderId, modalValue);

        setModal(null);

      } else if (modal.type === 'create-file') {

        createFile(currentFolderId, modalValue);

        setModal(null);

      }

      // ... etc

    } catch (error) {

      if (error instanceof Error) {

        setModalError(error.message);

      }

    }

  };



  // Use store selectors for reads

  const entries = getChildren(currentFolderId);

  const breadcrumbPath = getPath(currentFolderId);



  // Rest of component unchanged

};

```



### Testing Strategy



**New Tests** (`packages/rb-shell/src/\_\_tests\_\_/open-with-modal.test.tsx`):

1\. **Modal Rendering**:

   \- Renders with eligible targets only

   \- Shows \[DEFAULT\] marker for current default

   \- Displays resource name in title



2\. **Keyboard Navigation**:

   \- Arrow keys navigate target list

   \- Enter calls onChoose with selected target

   \- N toggles preferNewWindow state

   \- D calls onSetDefault

   \- Shift+D calls onClearDefault

   \- Esc calls onClose



3\. **Integration with System Search**:

   \- Shift+Enter on file result opens modal

   \- Modal shows correct eligible targets

   \- Choosing target dispatches OpenWithIntent

   \- routingHint propagates correctly



**Regression Tests**:

\- All PHASE\_X/Y/Z/AA/AB/AC/AD tests continue passing

\- Files app workflows unchanged (create, rename, delete, open-with)

\- System Search file provider determinism unchanged



### Implementation Checklist



\- \[ \] Extract OpenWithModal from Files app to shared component

\- \[ \] Update Files app to import shared OpenWithModal

\- \[ \] Add openWithModalState to Shell.tsx

\- \[ \] Update handleSearchExecuteFile to open modal on Shift+Enter

\- \[ \] Implement onChoose/onSetDefault/onClearDefault callbacks

\- \[ \] Migrate Files app to use global fileSystemStore

\- \[ \] Verify file IDs remain stable across migration

\- \[ \] Add open-with-modal.test.tsx (keyboard + integration tests)

\- \[ \] Run full test suite (expect 380+ tests passing)

\- \[ \] Run build

\- \[ \] Update CHANGELOG.md with PHASE\_AE completion



### Definition of Done



\- Users can press Shift+Enter on file result in System Search

\- Open With modal appears with eligible targets only

\- Arrow keys navigate, Enter opens, N toggles new window

\- D sets default, Shift+D clears default

\- Choosing target opens file with PHASE\_AC routing

\- Files app uses global fileSystemStore (no local fs state)

\- System Search and Files app see identical file tree

\- All operations keyboard-accessible

\- No async in modal opening path

\- Tests cover modal keyboard bindings + integration

\- Entire suite passes with zero warnings, build passes

\- Contracts and completion logged



---



\## PHASE\_AF — Deterministic Filesystem Persistence \+ Import/Export/Reset (IN PROGRESS)



### Goal

Enable the global `fileSystemStore` to persist deterministically to localStorage, surviving page reloads while maintaining failure-safe behavior. Provide helpers (`exportJson`, `importJson`, `resetAll`) for user-controlled filesystem snapshot management.



### Non-Goals

- NO async operations in persistence (no IndexedDB, no background indexing)

- NO server synchronization or cloud storage

- NO automatic conflict resolution between tabs (last-write-wins on localStorage)

- NO versioned history or undo/redo persistence (only current state snapshot)

- NO encryption or compression of localStorage payload



### Invariants

1. **Deterministic Serialization**: `exportJson()` produces stable, canonical JSON (consistent ordering of object keys and array elements)

2. **Sync-Only Persistence**: All localStorage operations are synchronous (no Promises, no async/await)

3. **Failure-Safe Loading**: Corrupted or invalid localStorage data falls back to default seed from `createInitialFsState()` without crashing

4. **Atomic State Replacement**: `importJson(json)` validates schema, then replaces entire store state in single `set()` call (no partial updates)

5. **Schema Validation**: Persistence envelope has version field; loading checks minimal shape before deserializing

6. **Reset Clears Storage**: `resetAll()` removes localStorage key and resets store to default seed

7. **No Infinite Loops**: Persistence subscription does not trigger on loads (only on mutations)



### Persistence Envelope



```typescript
interface FileSystemPersistenceEnvelope {
  version: 1;
  state: FileSystemState; // From fsModel
}
```



**Storage Key**: `rb:file-system`



### fileSystemStore Updates



**Current State** (from PHASE\_AE):
- Global Zustand store with actions: `createFolder`, `createFile`, `renameEntry`, `deleteEntry`
- Getters: `getChildren`, `getPath`, `getAllFiles`, etc.
- Used by both Files app and System Search for single source of truth



**Target State** (PHASE\_AF):
- Store loads from localStorage on initialization (with fallback to seed on corruption)
- Store subscribes to state changes and persists to localStorage after every mutation
- Three new actions:
  - `exportJson()`: Returns canonical JSON string (stable ordering for snapshots/diffs)
  - `importJson(json: string)`: Validates schema, replaces state atomically, persists
  - `resetAll()`: Clears localStorage, resets to `createInitialFsState()`



### Implementation Steps



1. **Add Persistence Helpers** (`packages/rb-apps/src/stores/fileSystemStore.ts`):
   ```typescript
   // Deterministic serialization (stable key/array ordering)
   function serializeState(state: FileSystemState): string {
     // Sort folder entries by id, sort folder keys, stable JSON.stringify
   }

   // Load with corruption fallback
   function loadPersistedState(): FileSystemState | null {
     try {
       const raw = localStorage.getItem('rb:file-system');
       if (!raw) return null;
       const envelope = JSON.parse(raw);
       if (envelope.version !== 1) return null;
       if (!envelope.state || typeof envelope.state !== 'object') return null;
       // Validate minimal shape (has folders, roots, nextId)
       return envelope.state;
     } catch {
       return null; // Corruption -> fallback to seed
     }
   }

   // Save to localStorage (sync)
   function persistState(state: FileSystemState): void {
     const envelope: FileSystemPersistenceEnvelope = { version: 1, state };
     const json = serializeState(envelope);
     localStorage.setItem('rb:file-system', json);
   }
   ```

2. **Update Store Initialization**:
   ```typescript
   export const useFileSystemStore = create<FileSystemStore>((set, get) => {
     const persistedState = loadPersistedState();
     const initialState = persistedState || createInitialFsState();

     return {
       ...initialState,

       // Existing actions wrap mutations + persist
       createFolder: (parentId, name) => {
         const fs = get();
         const newFs = fsCreateFolder(parentId, name, fs);
         set(newFs);
         persistState(newFs);
       },

       // exportJson/importJson/resetAll actions
       exportJson: () => {
         const state = get();
         return serializeState({ version: 1, state });
       },

       importJson: (json: string) => {
         const envelope = JSON.parse(json);
         if (envelope.version !== 1) throw new Error('Invalid version');
         // Validate schema
         set(envelope.state);
         persistState(envelope.state);
       },

       resetAll: () => {
         localStorage.removeItem('rb:file-system');
         const seed = createInitialFsState();
         set(seed);
       },
     };
   });
   ```

3. **Test Isolation Updates** (`packages/rb-apps/src/__tests__/files-operations.test.tsx` and `packages/rb-shell/src/__tests__/file-search.test.ts`):
   - Update `beforeEach` to also call `localStorage.removeItem('rb:file-system')` before resetting store
   - Ensures tests don't inherit persisted state from previous runs

4. **Testing Strategy**:
   - **Persistence Roundtrip**: Create file, reload page, verify file still exists
   - **Corruption Fallback**: Set invalid JSON in localStorage, reload, verify default seed loads
   - **Deterministic Export**: Export twice, verify identical JSON strings
   - **Import Validation**: Reject invalid version, invalid shape, malformed JSON
   - **Reset All**: Verify localStorage cleared and default seed restored
   - **Regression**: All existing Files + System Search tests still pass (369 tests)



### Definition of Done

- [x] fileSystemStore persists to `rb:file-system` localStorage key after every mutation
- [x] fileSystemStore loads from localStorage on init with corruption fallback
- [x] `exportJson()` produces deterministic canonical JSON
- [x] `importJson(json)` validates schema and replaces state atomically
- [x] `resetAll()` clears localStorage and resets to default seed
- [x] Tests cover persistence roundtrip, corruption handling, deterministic export
- [x] All 369+ tests pass with zero warnings
- [x] Build passes
- [x] Contracts and completion logged



---



\## PHASE\_AG — Settings "Filesystem Data" Panel \+ Safe Factory Reset



### Goal

Expose the fileSystemStore's new persistence helpers (`exportJson`, `importJson`, `resetAll`) via a keyboard-first Settings panel. Provide optional "Factory Reset" functionality that clears both filesystem and file associations to restore a pristine OS state.



### Non-Goals

- NO async file downloads or clipboard API usage (browser security limitations)

- NO automatic export scheduling or cloud sync

- NO filesystem versioning or snapshot history UI

- NO import conflict resolution UI (invalid JSON → no-op + toast)

- NO Settings panel reorganization beyond adding "Filesystem Data"



### Invariants

1. **Keyboard-First UI**: All operations accessible via single-key shortcuts (E/I/R) with visual feedback

2. **Deterministic Focus**: Focus management uses `requestAnimationFrame` (no timers); predictable tab order

3. **Never Crash on Invalid Input**: `importJson` validation errors display toast notification, preserve existing state

4. **Confirmation for Destructive Actions**: Reset and Factory Reset require explicit modal confirmation with clear warnings

5. **Deterministic Export Output**: Export displays canonical JSON from `fileSystemStore.exportJson()` (stable ordering)

6. **Atomic Factory Reset**: Factory Reset calls both `fileSystemStore.resetAll()` and `fileAssociationsStore.resetAll()` sequentially

7. **Test Coverage for Regressions**: Verify Files app and System Search still work after reset operations



### Current State

- `fileSystemStore` has `exportJson()`, `importJson(json)`, `resetAll()` actions (PHASE\_AF)

- `fileAssociationsStore` has `resetAll()` action (PHASE\_AB)

- Settings app has "File Associations" panel with keyboard navigation (PHASE\_AB)

- No UI exposure of filesystem persistence helpers yet



**Target State** (PHASE\_AG):

- Settings has new panel: "Filesystem Data" (alongside "File Associations")

- Panel exposes three operations:

  - **E**: Export filesystem JSON (readonly textarea with deterministic output)

  - **I**: Import filesystem JSON (textarea input; Enter applies; invalid → toast + no-op)

  - **R**: Reset filesystem (confirmation modal; restores default seed + clears `rb:file-system`)

- Optional "Factory Reset" button/action that:

  - Shows confirmation modal with explicit warning

  - Resets both fileSystemStore and fileAssociationsStore

  - Clears both `rb:file-system` and `rb:file-associations` localStorage keys



### Implementation Steps



1. **Audit SettingsApp Structure** (`packages/rb-apps/src/apps/SettingsApp.tsx`):

   - Understand existing panel system ("File Associations" panel)

   - Identify navigation pattern (keyboard shortcuts for panel switching)

   - Review modal system (ConfirmModal usage for destructive actions)



2. **Add "Filesystem Data" Panel**:

   ```typescript
   // Add new panel type
   type SettingsPanel = 'general' | 'file-associations' | 'filesystem-data';

   // Panel content component
   const FilesystemDataPanel: React.FC = () => {
     const { exportJson, importJson, resetAll } = useFileSystemStore();
     const [mode, setMode] = useState<'export' | 'import'>('export');
     const [importValue, setImportValue] = useState('');
     const [showResetModal, setShowResetModal] = useState(false);

     // E: Show export mode
     // I: Show import mode
     // R: Show reset confirmation modal

     return (
       <div>
         {mode === 'export' && (
           <textarea readOnly value={exportJson()} />
         )}
         {mode === 'import' && (
           <textarea
             value={importValue}
             onChange={(e) => setImportValue(e.target.value)}
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 try {
                   importJson(importValue);
                   showToast('Filesystem imported successfully');
                 } catch (error) {
                   showToast(`Import failed: ${error.message}`);
                 }
               }
             }}
           />
         )}
       </div>
     );
   };
   ```



3. **Add Factory Reset (Optional)**:

   ```typescript
   const handleFactoryReset = () => {
     // Confirmation modal with explicit warning
     setShowFactoryResetModal(true);
   };

   const confirmFactoryReset = () => {
     useFileSystemStore.getState().resetAll();
     useFileAssociationsStore.getState().resetAll();
     showToast('Factory reset complete - all data cleared');
     setShowFactoryResetModal(false);
   };
   ```



4. **Add Keyboard Shortcuts** (within Filesystem Data panel):

   - **E**: Switch to export mode, display readonly canonical JSON

   - **I**: Switch to import mode, focus import textarea

   - **R**: Open reset confirmation modal

   - **Escape**: Close modals



5. **Add Tests** (`packages/rb-apps/src/__tests__/filesystem-settings-panel.test.tsx`):

   ```typescript
   describe('PHASE_AG: Filesystem Data Settings Panel', () => {
     describe('Panel Navigation', () => {
       it('should display Filesystem Data panel when selected');
       it('should switch to export mode on E key');
       it('should switch to import mode on I key');
     });

     describe('Export Functionality', () => {
       it('should display deterministic JSON in export mode');
       it('should update export output when filesystem changes');
     });

     describe('Import Functionality', () => {
       it('should apply valid JSON on Enter');
       it('should show toast and preserve state on invalid JSON');
       it('should show toast and preserve state on schema validation error');
     });

     describe('Reset Functionality', () => {
       it('should show confirmation modal on R key');
       it('should reset filesystem and clear localStorage on confirm');
       it('should close modal on cancel without changes');
     });

     describe('Factory Reset', () => {
       it('should show confirmation modal with explicit warning');
       it('should reset both filesystem and file associations on confirm');
       it('should clear both localStorage keys');
     });

     describe('Regression: Files App + System Search', () => {
       it('should maintain Files app functionality after reset');
       it('should maintain System Search file provider after reset');
     });
   });
   ```



### Testing Strategy

1. **Panel Navigation**: Verify panel appears in Settings, keyboard shortcuts work

2. **Export Mode**: Verify readonly textarea displays canonical JSON from `exportJson()`

3. **Import Mode**: Verify valid JSON applies successfully, invalid JSON shows toast without crashing

4. **Reset Confirmation**: Verify modal appears, confirm resets filesystem, cancel preserves state

5. **Factory Reset**: Verify both stores reset, both localStorage keys cleared

6. **Regression**: Verify Files app and System Search still work after all reset operations

7. **Deterministic Focus**: Verify tab order and focus management after mode switches



### Definition of Done

1. Settings app has "Filesystem Data" panel with E/I/R keyboard shortcuts

2. Export mode displays readonly canonical JSON from `fileSystemStore.exportJson()`

3. Import mode accepts JSON input; Enter applies valid JSON; invalid JSON shows toast + no-op

4. Reset shows confirmation modal; confirm clears `rb:file-system` and resets to seed

5. Optional Factory Reset implemented (if included in scope) with both stores cleared

6. All operations tested (export, import validation, reset, factory reset, regression)

7. `pnpm lint`, `pnpm typecheck`, `pnpm build` pass with zero warnings

8. All tests pass (including new filesystem-settings-panel tests and existing suite)

9. Manual smoke test: export filesystem, modify, import, verify state restored

10. Manual smoke test: reset filesystem, verify Files app and System Search work

11. Manual smoke test: factory reset, verify both filesystem and file associations cleared

12. Contracts and completion logged in AI\_STATE.md and CHANGELOG.md



---



\## PHASE\_AH — Factory Reset with Hardened Confirmation



### Goal

Add a hardened Factory Reset action to Settings that clears BOTH persisted stores (fileSystemStore + fileAssociationsStore) with a type-to-confirm gate to prevent accidental data loss. Ensure keyboard-first UX, deterministic focus, and comprehensive test coverage.



### Non-Goals

- NO "soft" confirmation (simple Yes/No button) - must require typing "RESET"

- NO async operations (all localStorage clearing synchronous)

- NO partial reset (must clear both stores atomically or show error)

- NO undo/redo for factory reset (permanent destructive operation)

- NO UI reorganization beyond adding Factory Reset to Filesystem Data panel



### Invariants

1. **Type-to-Confirm Gate**: Modal requires exact text input "RESET" before Enter key confirms (case-sensitive)

2. **Keyboard-First**: Enter only works when gate satisfied; Esc always cancels; autofocus input on modal open

3. **Atomic Dual-Store Reset**: Calls both `fileSystemStore.resetAll()` and `fileAssociationsStore.resetAll()` in deterministic order

4. **Deterministic Focus**: Modal open/close uses `requestAnimationFrame()` for focus management (no timers)

5. **Clear Warning Copy**: Modal explicitly states "This will permanently delete all files, folders, and file associations"

6. **Never Crash**: If either store reset fails, show error toast and preserve state (don't leave system in partial-reset state)

7. **localStorage Keys Cleared**: Both `rb:file-system` and `rb:file-associations` removed after reset



### Current State

- `fileSystemStore.resetAll()` exists (PHASE\_AF) - clears `rb:file-system` and resets to seed

- `fileAssociationsStore.resetAll()` exists (PHASE\_AB) - clears `rb:file-associations`

- Filesystem Data panel has E/I/R shortcuts (PHASE\_AG) but no Factory Reset

- No UI for clearing both stores simultaneously



**Target State** (PHASE\_AH):

- Filesystem Data panel has "Factory Reset" button/action (F key shortcut)

- F key opens modal with:

  - Warning text: "Factory Reset will permanently delete all files, folders, and file associations"

  - Input field with placeholder "Type RESET to confirm"

  - Autofocus on input (via rAF)

  - Enter button disabled until input === "RESET"

  - Enter confirms and executes reset

  - Esc cancels without changes

- Factory Reset action:

  - Calls `fileAssociationsStore.resetAll()`

  - Calls `fileSystemStore.resetAll()`

  - Verifies both localStorage keys cleared

  - Shows success toast

  - Closes modal and returns focus to panel



### Implementation Steps



1. **Update FilesystemDataPanel** (`packages/rb-apps/src/apps/settings/FilesystemDataPanel.tsx`):

   ```typescript
   // Add factory-reset modal type
   type ModalType = 'export' | 'import' | 'reset-confirm' | 'factory-reset';

   // Add F key handler
   if (event.key === 'f' || event.key === 'F') {
     event.preventDefault();
     setModal({ type: 'factory-reset' });
     setFactoryResetInput('');
   }

   // Factory Reset modal component
   {modal && modal.type === 'factory-reset' && (
     <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
       <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-96 p-4">
         <h3 className="text-lg font-semibold text-white mb-4">Factory Reset?</h3>
         <p className="text-slate-300 text-sm mb-4">
           This will permanently delete all files, folders, and file associations.
           This action cannot be undone.
         </p>

         <div className="mb-4">
           <label className="block text-sm text-slate-400 mb-2">
             Type <strong>RESET</strong> to confirm:
           </label>
           <input
             ref={factoryResetInputRef}
             value={factoryResetInput}
             onChange={(e) => setFactoryResetInput(e.target.value)}
             placeholder="Type RESET"
             className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
           />
         </div>

         <div className="flex justify-end gap-2">
           <button onClick={() => setModal(null)}>Cancel</button>
           <button
             disabled={factoryResetInput !== 'RESET'}
             onClick={handleFactoryReset}
             className={factoryResetInput === 'RESET' ? 'bg-red-600' : 'bg-slate-700'}
           >
             Factory Reset
           </button>
         </div>
       </div>
     </div>
   )}
   ```



2. **Implement Factory Reset Action**:

   ```typescript
   const handleFactoryReset = () => {
     try {
       // Reset in deterministic order
       useFileAssociationsStore.getState().resetAll();
       useFileSystemStore.getState().resetAll();

       // Verify both keys cleared
       if (typeof window !== 'undefined') {
         const fsKey = localStorage.getItem('rb:file-system');
         const assocKey = localStorage.getItem('rb:file-associations');
         if (fsKey || assocKey) {
           throw new Error('Factory reset incomplete - localStorage keys not cleared');
         }
       }

       onShowToast?.('Factory reset complete - all data cleared');
       setModal(null);
       requestAnimationFrame(() => {
         containerRef.current?.focus();
       });
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error';
       onShowToast?.(`Factory reset failed: ${message}`);
     }
   };
   ```



3. **Add Tests** (`packages/rb-apps/src/__tests__/filesystem-settings-panel.test.tsx`):

   ```typescript
   describe('Factory Reset', () => {
     it('should open factory reset modal on F key');
     it('should disable confirm button until RESET typed');
     it('should enable confirm button when RESET typed (case-sensitive)');
     it('should reject confirm when input is "reset" (lowercase)');
     it('should clear both localStorage keys on confirm');
     it('should reset both fileSystemStore and fileAssociationsStore');
     it('should show success toast after factory reset');
     it('should close modal and return focus after success');
     it('should show error toast if reset fails');
     it('should preserve state if reset fails');
     it('should cancel on Escape without changes');
   });
   ```



### Testing Strategy

1. **Gate Behavior**: Verify Enter disabled until exact "RESET" typed

2. **Dual-Store Clearing**: Verify both localStorage keys cleared and both stores reset to defaults

3. **Focus Management**: Verify autofocus on input, focus return on close

4. **Error Handling**: Verify error toast if reset fails, state preserved

5. **Regression**: Verify existing E/I/R operations still work after adding F key



### Definition of Done

1. Filesystem Data panel has Factory Reset action accessible via F key

2. Modal requires typing exact "RESET" (case-sensitive) before confirming

3. Factory Reset clears both `rb:file-system` and `rb:file-associations` localStorage keys

4. Factory Reset calls both `fileSystemStore.resetAll()` and `fileAssociationsStore.resetAll()`

5. Success toast shown after factory reset completes

6. Error toast shown if factory reset fails (state preserved)

7. Autofocus on input using `requestAnimationFrame()`

8. Enter confirms only when gate satisfied; Esc cancels always

9. All tests pass (existing 397 + new factory reset tests)

10. `pnpm lint`, `pnpm typecheck`, `pnpm build` pass with zero warnings

11. Manual smoke test: F key -> type RESET -> Enter -> verify both stores cleared

12. Contracts and completion logged in AI\_STATE.md and CHANGELOG.md



\## PHASE\_AI — Deterministic Session Restore (Window Layout Persistence + Safe Reset)



### Goal

Persist window manager state deterministically to localStorage and restore it on boot with a safe reset action in Settings. Ensure window layout (open windows, z-order, focus state, geometry) survives page reloads without corrupting or crashing, with fallback to default seed on corruption.



### Non-Goals

- NO async persistence (all localStorage operations synchronous)

- NO complex animation or transition state persistence

- NO minimized window geometry tracking (only minimized flag)

- NO export/import UI for window layouts (just persist+restore+reset)

- NO migration from previous layout versions (version mismatch → fallback to default)

- NO partial hydration (either full restore or fallback, never hybrid)



### Invariants

1. **Deterministic Serialization**: Window layout JSON is canonical - stable key ordering, stable window array ordering (by windowId ascending)

2. **Sync-Only Persistence**: All localStorage operations synchronous (no promises, no async/await)

3. **Schema Validation**: Envelope version check on load; wrong version → fallback to default seed (never crash)

4. **Corruption Fallback**: JSON parse error or missing keys → fallback to default seed (never crash)

5. **Deterministic Restore Order**: Windows created in stable order (windowId ascending), then focused window applied

6. **Focus Restoration**: If persisted focused windowId exists and not minimized → focus it; else focus oldest non-minimized window

7. **Factory Reset Integration**: Factory Reset (PHASE\_AH) clears `rb:window-layout` alongside `rb:file-system` and `rb:file-associations`

8. **Session Reset in Settings**: New "Session" panel with R key to reset window layout (confirm modal, clears key, restores default window set)



### Current State

- Window manager state exists in rb-shell (windows array, z-order, focused windowId)

- `lastFocusedAt` timestamps tracked per window (PHASE\_AC)

- No persistence of window layout - page reload loses all open windows

- Factory Reset (PHASE\_AH) clears `rb:file-system` and `rb:file-associations` but not window layout



**Target State** (PHASE\_AI):

- Window manager state persisted to `rb:window-layout` localStorage key

- Envelope: `{ version: 1, state: WindowManagerPersistedState }`

- Persisted state includes: windows (appId, windowId, minimized, geometry), z-order, focusedWindowId, lastFocusedAt timestamps

- On boot: load, validate schema, hydrate store with persisted windows

- If corrupted/wrong version: fallback to default seed (e.g., one Files window)

- Deterministic restore: create windows in windowId order, apply focus to persisted focused window if valid

- Factory Reset clears `rb:window-layout` key

- Settings "Session" panel with R key to reset session layout



### Implementation Steps



1. **Define Persistence Schema** (`packages/rb-windowing/src/types.ts` or `packages/rb-shell/src/types.ts`):

   ```typescript
   interface WindowPersisted {
     appId: string;
     windowId: string;
     minimized: boolean;
     geometry?: { x: number; y: number; width: number; height: number };
     lastFocusedAt?: number;
   }

   interface WindowManagerPersistedState {
     windows: WindowPersisted[];
     focusedWindowId: string | null;
   }

   interface WindowLayoutEnvelope {
     version: 1;
     state: WindowManagerPersistedState;
   }
   ```



2. **Implement Serialization** (`packages/rb-windowing/src/sessionRestore.ts` or inline in store):

   ```typescript
   const STORAGE_KEY = 'rb:window-layout';

   function serializeLayout(envelope: WindowLayoutEnvelope): string {
     // Sort windows by windowId for deterministic output
     const sortedWindows = [...envelope.state.windows].sort((a, b) => a.windowId.localeCompare(b.windowId));
     const sortedState: WindowManagerPersistedState = {
       windows: sortedWindows,
       focusedWindowId: envelope.state.focusedWindowId,
     };
     const sortedEnvelope: WindowLayoutEnvelope = {
       version: envelope.version,
       state: sortedState,
     };
     return JSON.stringify(sortedEnvelope);
   }

   function loadPersistedLayout(): WindowManagerPersistedState | null {
     if (typeof window === 'undefined') return null;

     try {
       const raw = localStorage.getItem(STORAGE_KEY);
       if (!raw) return null;

       const envelope = JSON.parse(raw) as WindowLayoutEnvelope;

       // Validate envelope
       if (envelope.version !== 1) return null;
       if (!envelope.state || typeof envelope.state !== 'object') return null;
       if (!Array.isArray(envelope.state.windows)) return null;

       return envelope.state;
     } catch {
       // JSON parse error -> fallback
       return null;
     }
   }

   function persistLayout(state: WindowManagerPersistedState): void {
     if (typeof window === 'undefined') return;

     const envelope: WindowLayoutEnvelope = {
       version: 1,
       state,
     };

     const json = serializeLayout(envelope);
     localStorage.setItem(STORAGE_KEY, json);
   }
   ```



3. **Hydrate Store on Boot** (rb-windowing or rb-shell store initializer):

   ```typescript
   // In store initializer (e.g., useWindowStore)
   const persistedLayout = loadPersistedLayout();
   const initialState = persistedLayout
     ? hydrateFromPersisted(persistedLayout)
     : createDefaultWindowSet();

   // hydrateFromPersisted: convert WindowPersisted[] to WindowState[]
   function hydrateFromPersisted(persisted: WindowManagerPersistedState): WindowManagerState {
     // Create windows in windowId order
     const windows: WindowState[] = persisted.windows
       .sort((a, b) => a.windowId.localeCompare(b.windowId))
       .map((w) => ({
         ...w,
         zIndex: 0, // Will be set by z-order logic
         // ... other WindowState fields
       }));

     // Determine focused window
     let focusedId = persisted.focusedWindowId;
     if (focusedId && !windows.find((w) => w.windowId === focusedId && !w.minimized)) {
       // Fallback: oldest non-minimized window
       const eligible = windows.filter((w) => !w.minimized).sort((a, b) => a.windowId.localeCompare(b.windowId));
       focusedId = eligible[0]?.windowId || null;
     }

     return {
       windows,
       focusedWindowId: focusedId,
       // ... other WindowManagerState fields
     };
   }
   ```



4. **Persist on Mutations** (wrap window manager actions):

   ```typescript
   // After createWindow, closeWindow, minimizeWindow, focusWindow, etc.
   const newState = { ...state, windows: updatedWindows };
   set(newState);
   persistLayout(toPersisted(newState));

   function toPersisted(state: WindowManagerState): WindowManagerPersistedState {
     return {
       windows: state.windows.map((w) => ({
         appId: w.appId,
         windowId: w.windowId,
         minimized: w.minimized,
         geometry: w.geometry,
         lastFocusedAt: w.lastFocusedAt,
       })),
       focusedWindowId: state.focusedWindowId,
     };
   }
   ```



5. **Update Factory Reset** (`packages/rb-apps/src/apps/settings/FilesystemDataPanel.tsx`):

   ```typescript
   const handleFactoryReset = () => {
     try {
       // Reset in deterministic order
       useFileAssociationsStore.getState().resetAll();
       useFileSystemStore.getState().resetAll();

       // Explicitly clear localStorage keys
       if (typeof window !== 'undefined') {
         localStorage.removeItem('rb:file-associations');
         localStorage.removeItem('rb:file-system');
         localStorage.removeItem('rb:window-layout'); // NEW
       }

       // Verify all keys cleared
       if (typeof window !== 'undefined') {
         const fsKey = localStorage.getItem('rb:file-system');
         const assocKey = localStorage.getItem('rb:file-associations');
         const layoutKey = localStorage.getItem('rb:window-layout'); // NEW
         if (fsKey || assocKey || layoutKey) {
           throw new Error('Factory reset incomplete - localStorage keys not cleared');
         }
       }

       onShowToast?.('Factory reset complete - all data cleared');
       setModal(null);
       requestAnimationFrame(() => {
         containerRef.current?.focus();
       });
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Unknown error';
       onShowToast?.(`Factory reset failed: ${message}`);
     }
   };
   ```



6. **Add Settings "Session" Panel** (`packages/rb-apps/src/apps/settings/SessionPanel.tsx`):

   ```typescript
   export const SessionPanel: React.FC<SessionPanelProps> = ({ onShowToast }) => {
     const [modal, setModal] = useState<'reset-confirm' | null>(null);
     const containerRef = useRef<HTMLDivElement>(null);

     const handleKeyDown = (event: React.KeyboardEvent) => {
       if (modal) return; // Modal handles own keys

       if (event.key === 'r' || event.key === 'R') {
         event.preventDefault();
         setModal('reset-confirm');
       }
     };

     const handleResetSession = () => {
       if (typeof window !== 'undefined') {
         localStorage.removeItem('rb:window-layout');
       }

       onShowToast?.('Session layout reset - reload to apply');
       setModal(null);
       requestAnimationFrame(() => {
         containerRef.current?.focus();
       });
     };

     return (
       <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}>
         <h3>Session Management</h3>
         <p>Your window layout is automatically saved. Use actions below to reset.</p>

         <div>
           <kbd>R</kbd> Reset Session Layout
         </div>

         {modal === 'reset-confirm' && (
           <div className="modal">
             <h3>Reset Session Layout?</h3>
             <p>This will clear all open windows. Reload the page to apply.</p>
             <button onClick={() => setModal(null)}>Cancel</button>
             <button onClick={handleResetSession}>Reset Session</button>
           </div>
         )}
       </div>
     );
   };
   ```



7. **Integrate Session Panel into Settings** (`packages/rb-apps/src/apps/SettingsApp.tsx`):

   ```typescript
   type SettingsSection = 'appearance' | 'system' | 'files' | 'filesystem' | 'session';

   // Add sidebar button
   <button onClick={() => setSelectedSection('session')}>
     Session
   </button>

   // Add panel routing
   {selectedSection === 'session' && <SessionPanel onShowToast={onShowToast} />}
   ```



8. **Add Tests** (`packages/rb-windowing/src/__tests__/session-restore.test.ts`):

   ```typescript
   describe('Window Layout Persistence', () => {
     it('should persist window layout to localStorage on mutation');
     it('should restore persisted layout on store init');
     it('should produce deterministic JSON (stable window order)');
     it('should fall back to default on corrupted JSON');
     it('should fall back to default on version mismatch');
     it('should restore focused window deterministically');
     it('should focus oldest non-minimized if persisted focused is minimized');
     it('should handle empty persisted state');
   });

   describe('Factory Reset Integration', () => {
     it('should clear rb:window-layout alongside other keys');
   });

   describe('Session Reset', () => {
     it('should open reset modal on R key');
     it('should clear rb:window-layout on confirm');
     it('should show toast after reset');
   });
   ```



### Testing Strategy

1. **Persistence Roundtrip**: Create windows, persist, reload, verify restored state matches

2. **Deterministic Serialization**: Run export twice, verify JSON identical

3. **Corruption Fallback**: Inject invalid JSON, verify fallback to default seed without crash

4. **Focus Restoration**: Persist focused window, reload, verify same window focused

5. **Minimized Window Handling**: Persist minimized windows, verify excluded from focus selection

6. **Factory Reset Integration**: Verify `rb:window-layout` cleared alongside other keys

7. **Session Reset**: Verify R key clears layout, toast shown



### Definition of Done

1. Window layout persisted to `rb:window-layout` localStorage key with versioned envelope

2. On boot: load, validate schema, hydrate store with persisted windows

3. Corrupted JSON or version mismatch → fallback to default seed (never crash)

4. Deterministic restore: windows created in windowId order, focus applied deterministically

5. Factory Reset clears `rb:window-layout` key alongside other keys

6. Settings "Session" panel with R key to reset session layout

7. All tests pass (existing 409 + new session restore tests)

8. `pnpm lint`, `pnpm typecheck`, `pnpm build` pass with zero warnings

9. Manual smoke test: open windows -> reload -> layout restored; Settings -> Session -> Reset clears layout

10. Contracts and completion logged in AI\_STATE.md and CHANGELOG.md



---



\## Current Phase



Phase ID: PHASE\_PERF\_0

Phase Name: Live Preview Performance + Bundle Hygiene

Status: COMPLETED



---



\## PHASE\_RELEASE\_0: Live Preview RC (Release Hardening + Deploy Wiring)



### Goal



Prepare a stable, deployable live preview for redbyteapps.dev with clear "Preview" labeling, version metadata, crash safety, deployment documentation, and a tagged anchor point for paused development.



### Non-Goals



- NO marketing polish or landing page content

- NO analytics/monitoring (can be added post-launch if desired)

- NO performance optimization beyond current baseline

- NO new features (this is purely release hardening)

- NO multi-environment config (single production preview only)



### Invariants



1. **Cold Load Stability**: App boots reliably from empty localStorage with no console errors (warnings OK if intentional).

2. **Preview Badge**: Visible "PREVIEW" label in Shell chrome so visitors understand scope.

3. **Version Metadata**: Build-time version string (from package.json + git sha) surfaced in UI footer or Settings.

4. **Crash Boundary**: Top-level error boundary prevents white-screen; shows reload + factory reset hint.

5. **Deterministic Persistence Keys**: `rb:file-system`, `rb:file-associations`, `rb:window-layout` remain stable across deployments.

6. **Deployment Documentation**: DEPLOYMENT.md with build steps, SPA fallback config, cache guidance, rollback procedure, and smoke checklist.

7. **Tagged Anchor**: Annotated git tag (`v0.1.0-preview`) as deployable snapshot and natural resting point.

8. **No Timers or Async in Release Metadata**: Version display and crash boundary must be sync-only.



### Current State



**Build System** (Vite-based monorepo):

- pnpm workspace with 23 packages

- Build command: `pnpm -w build`

- Test suite: 433 tests passing

- Output directory: likely `apps/playground/dist` or similar (needs verification)



**Persistence Keys**:

- `rb:file-system` → filesystem state

- `rb:file-associations` → file associations

- `rb:window-layout` → window manager session



**Existing Safety**:

- Factory Reset in Settings → Filesystem Data (clears all 3 keys)

- Session Reset in Settings → Session (clears window layout only)

- Deterministic boot flow with corruption fallback



**Missing for Live Preview**:

- No visible version string or preview badge

- No top-level error boundary

- No DEPLOYMENT.md with smoke checklist

- No SPA fallback config verified



### Target State



**Shell Chrome**:

- Footer or header displays: "RedByte OS - PREVIEW v0.1.0 (abcdef1)"

- Or minimal: "PREVIEW" badge pill visible at all times



**Error Boundary** ([packages/rb-shell/src/ErrorBoundary.tsx](packages/rb-shell/src/ErrorBoundary.tsx)):

- Wraps `<Shell>` in root render

- On crash: displays minimal UI with:

  - "Something went wrong" message

  - Reload button (window.location.reload())

  - Factory Reset hint ("Settings → Filesystem Data → F → type RESET")

- No timers; no async; deterministic recovery path



**Version Metadata** ([packages/rb-shell/src/version.ts](packages/rb-shell/src/version.ts)):

- Export constant: `export const VERSION = "0.1.0-preview"`

- Export constant: `export const GIT_SHA = "abcdef1"` (injected at build via env)

- Export constant: `export const BUILD_DATE = "2025-12-19"` (optional; only if deterministic)

- Used in Shell footer/status and Settings → About



**Deployment Documentation** ([DEPLOYMENT.md](DEPLOYMENT.md)):

- Build command: `pnpm -w build`

- Output directory: `apps/playground/dist` (or actual path)

- SPA fallback: configure host to return `index.html` for all routes

- Cache: `index.html` short cache, static assets long cache

- Rollback: redeploy previous tag or build artifact

- Smoke checklist:

  1. Cold load → UI renders (no console errors)

  2. System Search → find README.md → Enter opens Text Viewer

  3. Shift+Enter → Open With modal works

  4. Create file → reload → persists

  5. Open 2 windows → reload → layout restores

  6. Factory Reset (type RESET) clears everything + seed restore



### Implementation Steps



1. **Add version metadata**:

   - Create `packages/rb-shell/src/version.ts` with VERSION, GIT\_SHA, BUILD\_DATE constants

   - Inject GIT\_SHA via Vite env define (fallback "dev")

   - Display in Shell footer or Settings → About



2. **Add preview badge**:

   - Add "PREVIEW" pill or text to Shell header/footer (always visible)

   - Style: subtle but clear (e.g., yellow/amber badge)



3. **Add error boundary**:

   - Create `packages/rb-shell/src/ErrorBoundary.tsx` class component

   - Wrap Shell in root render (`apps/playground/src/main.tsx` or similar)

   - On crash: show reload button + factory reset hint



4. **Create DEPLOYMENT.md**:

   - Provider-agnostic instructions

   - Include build steps, SPA fallback, cache, rollback, smoke checklist



5. **Verify build config**:

   - Ensure Vite config has correct base path (root domain)

   - Ensure SPA fallback guidance aligns with typical hosts (Netlify/Vercel/CF Pages)

   - Add `_redirects` or equivalent if missing



6. **Run quality gates**:

   - `pnpm -w lint`

   - `pnpm -w typecheck`

   - `pnpm -w test`

   - `pnpm -w build`



7. **Commit, tag, merge**:

   - Single commit: "chore(release): add preview metadata, crash boundary, and deployment docs"

   - Annotated tag: `v0.1.0-preview`

   - FF-merge to main

   - Push tag



### Testing



**Unit Tests** (no new tests required; existing 433 tests validate baseline):

- Existing tests verify core functionality remains stable



**Smoke Checklist** (manual, post-deploy):

1. Cold load renders UI (no console errors)

2. System Search → README.md → Enter opens Text Viewer

3. Shift+Enter → Open With modal works

4. Create file → reload → persists

5. Open 2 windows → reload → layout restores

6. Factory Reset (type RESET) clears everything



### Definition of Done



- ✅ Version metadata displayed in UI (Shell footer or Settings)

- ✅ "PREVIEW" badge visible in Shell chrome

- ✅ Error boundary wraps Shell; crash shows reload + factory reset hint

- ✅ DEPLOYMENT.md exists with build steps, SPA fallback, rollback, smoke checklist

- ✅ Build config verified for production deployment

- ✅ All quality gates passing (lint, typecheck, test, build)

- ✅ Commit + tag `v0.1.0-preview` pushed to origin/main

- ✅ Natural resting point: main is green, deployable, pauseable



---



\## PHASE\_PERF\_0: Live Preview Performance + Bundle Hygiene



### Goal



Reduce initial JS payload and eliminate Vite build warning about chunks larger than 500 kB through strategic code splitting and lazy loading, while preserving all deterministic keyboard-first invariants and maintaining zero regressions.



### Non-Goals



- NO runtime performance tuning (this is build-time bundle optimization only)

- NO algorithmic changes to existing features

- NO removal of features or functionality

- NO changes to user-visible behavior (purely internal optimization)

- NO external monitoring/analytics (can be added separately)



### Invariants



1. **Cold Load Stability**: App boots reliably from empty localStorage with no console errors (same as PHASE\_RELEASE\_0).

2. **PREVIEW Badge + Version**: Footer shows PREVIEW badge and version string unchanged.

3. **Windowing Determinism**: Window management, keyboard shortcuts, focus transfer remain deterministic (no regressions to PHASE\_AJ).

4. **Macro Execution**: System Search + Command Palette + macros work identically.

5. **Bundle Warning**: Vite build warning for >500kB chunks is eliminated OR reduced to smallest practical count with explicit justification.

6. **Quality Gates**: All tests (433/433), typecheck, lint, and build remain green.

7. **No Lazy-Loading Regressions**: Any lazy-loaded UI surfaces must render deterministically without flash/delay perceptible to users.

8. **Deployment Pipeline**: GitHub Actions CI/CD continues to work unchanged.



### Current State



**Build Output** (baseline):

- Single monolithic bundle: `index-T25MHOsF.js` (1,233.11 kB minified, 338.97 kB gzipped)

- Vite warning: "Some chunks are larger than 500 kB after minification"

- Build command: `pnpm -w build`

- Output: `apps/playground/dist/`



**Dependencies** (potential heavy imports):

- React + React DOM (vendor)

- Zustand (state management)

- @radix-ui/\* (UI primitives - if present)

- RedByte packages: rb-shell, rb-apps, rb-windowing, rb-theme, rb-icons, rb-utils

- Three.js / @react-three/\* (3D logic - if present)



**Current Load Behavior**:

- All code loaded eagerly on initial page load

- No code splitting or dynamic imports

- Shell imports all modals/surfaces synchronously



### Target State



**Build Output**:

- Vendor chunk: React, React DOM, Zustand separated from app code

- RedByte app chunk: rb-apps split from rb-shell (if size justifies)

- Main shell chunk: reduced to <500 kB

- Lazy-loaded surfaces: non-critical modals loaded on demand

- Vite build warning eliminated OR explicitly justified with thresholds



**Load Behavior**:

- Critical path (Shell, Desktop, Dock) loads immediately

- Non-critical surfaces (Settings panels, heavy modals) lazy-load on first use

- No perceptible flash or delay (Suspense boundaries with minimal fallbacks)



### Implementation Steps



1. **Audit current bundle composition**:

   - Build with Vite and analyze chunk sizes

   - Identify heaviest imports (React, vendor libs, RedByte packages)



2. **Add Rollup manual chunks to Vite config**:

   - Split React + ReactDOM into `vendor` chunk

   - Split Zustand into `state` chunk

   - Split RedByte packages into logical chunks (e.g., `rb-apps`, `rb-shell`)

   - Use deterministic naming (no runtime env fetches)



3. **Lazy-load non-critical Shell surfaces**:

   - Convert heavy modal imports to `React.lazy()`

   - Add `<Suspense>` boundaries with minimal fallback UI

   - Ensure keyboard workflows remain deterministic



4. **Verify bundle size reduction**:

   - Rebuild and confirm Vite warning eliminated

   - Check that main chunk is <500 kB

   - Verify total payload hasn't increased significantly



5. **Run quality gates**:

   - `pnpm -w typecheck`

   - `pnpm -w lint`

   - `pnpm -w test` (expect 433/433)

   - `pnpm -w build` (no warnings)



6. **Commit with discipline**:

   - Commit 1: Vite config chunking strategy

   - Commit 2: Shell lazy-loading (if implemented)

   - Commit 3: AI\_STATE.md update



### Testing Strategy



**Automated**:

- All existing 433 tests must pass (no regressions)

- Typecheck and lint must remain clean

- Build must complete without >500kB warning



**Manual Smoke**:

- Cold load from empty localStorage

- All keyboard shortcuts work (Ctrl+K, Ctrl+Space, Ctrl+Tab, Ctrl+W, etc.)

- Window Switcher (Ctrl+Tab) renders without delay

- Settings modal loads on first Ctrl+, press

- No console errors or warnings



### Definition of Done



- ✅ Vite build warning eliminated (no chunks >500 kB) OR explicitly justified

- ✅ Main chunk reduced to <500 kB minified

- ✅ All quality gates green (typecheck, lint, test, build)

- ✅ Manual smoke test passed (keyboard workflows unchanged)

- ✅ AI\_STATE.md updated with PHASE\_PERF\_0 status

- ✅ Commits follow discipline (one logical change per commit)

- ✅ No regressions to PREVIEW badge, version string, error boundary



**Completion Note (2025-12-23):**

Bundle optimization successfully completed. Monolithic 1.23 MB chunk split into 10 strategic chunks:
- Cold load payload reduced ~62% (excluding lazy-loaded vendor-3d)
- All chunks except vendor-3d (Three.js) under 500 KB
- Total payload slightly smaller (1.195 MB vs 1.233 MB baseline)
- Vite warning eliminated via chunkSizeWarningLimit: 750 with justification
- All automated quality gates passing (typecheck, lint, test 433/433, build)

Chunks created:
- vendor-react (301 KB), vendor-3d (726 KB, lazy), vendor-state (2.7 KB)
- app-files (18 KB), app-settings (27 KB), app-logic (36 KB)
- rb-shell (50 KB), rb-apps (37 KB), rb-windowing (4.2 KB), index (1.2 KB)

Branch: perf/phase-perf-0-bundle-hygiene
Commits: 06d84095, 788f19a8



---



\## PHASE\_AJ: Keyboard-First Window Switcher (MRU) + Deterministic Focus Transfer



### Goal



Add a global keyboard-first Window Switcher overlay that displays open windows in MRU (Most Recently Used) order, enabling deterministic window navigation and focus transfer without timers or async operations.



### Non-Goals



- NO mouse-only interaction (keyboard-first; mouse hover/click is optional enhancement)

- NO async focus operations (rAF allowed for deterministic focus handoff only)

- NO timers for auto-dismiss or delay

- NO window thumbnails or previews (text list only)

- NO filtering or search within switcher (just MRU ordering)

- NO customizable keybindings (Ctrl+Tab hardcoded for now)



### Invariants



1. **Deterministic MRU Ordering**: Windows sorted by `lastFocusedAt` DESC, tie-break by `windowId` ASC (stable sort).

2. **Keyboard-Only Navigation**: Tab / Shift+Tab cycles selection; ArrowUp/Down optional; Enter confirms; Esc cancels.

3. **Minimized Window Handling**: Minimized windows appear in list with badge; selecting minimized window restores it deterministically before focusing.

4. **Focus Transfer Without Timers**: Focus changes occur synchronously or via rAF only (no setTimeout/setInterval).

5. **Overlay Z-Order**: Switcher stacks consistently above all windows and modals (deterministic z-index).

6. **No State Persistence**: Switcher state (selected index, open/closed) is ephemeral (not persisted to localStorage).

7. **Cancel Restores Previous Focus**: Esc closes switcher and returns focus to previously focused window.

8. **Single Instance**: Only one switcher overlay can be open at a time.



### Current State



**Windowing Store** ([packages/rb-windowing/src/store.ts](packages/rb-windowing/src/store.ts)):

- Windows have `lastFocusedAt` timestamp (persisted via PHASE\_AI)

- `focusWindow(id)` updates `lastFocusedAt` and `focused` flag

- `restoreWindow(id)` un-minimizes a minimized window

- `getFocusedWindow()` returns currently focused window



**Global Keybindings** ([packages/rb-shell/src/Shell.tsx](packages/rb-shell/src/Shell.tsx)):

- Ctrl+Space → System Search

- Ctrl+Shift+P → Command Palette

- Ctrl+K → Launcher

- Ctrl+, → Settings

- Ctrl+` → Focus Next Window (cycling)

- Ctrl+W → Close Focused Window

- Ctrl+M → Minimize Focused Window



**NO** existing Ctrl+Tab or Alt+Tab binding.



### Target State



**New Component: WindowSwitcher** ([packages/rb-shell/src/WindowSwitcher.tsx](packages/rb-shell/src/WindowSwitcher.tsx)):

- Props: `windows`, `onSelect`, `onCancel`

- Local state: `selectedIndex`, `previousFocusedWindowId`

- Renders: list of windows in MRU order with app name, window title, minimized badge

- Keys: Tab/Shift+Tab cycles; ArrowUp/Down optional; Enter selects; Esc cancels



**Shell Integration** ([packages/rb-shell/src/Shell.tsx](packages/rb-shell/src/Shell.tsx)):

- Add state: `windowSwitcherOpen: boolean`, `windowSwitcherPreviousFocus: string | null`

- Ctrl+Tab keybinding opens switcher (stores previous focused window ID)

- On select: if minimized → `restoreWindow(id)` then `focusWindow(id)`; else `focusWindow(id)` directly

- On cancel: `focusWindow(previousFocusedWindowId)` if valid, close switcher



**MRU Ordering Logic**:

```typescript

const mrUWindows = [...windows]

  .filter(w => w.mode !== 'minimized' || true) // Include minimized

  .sort((a, b) => {

    // Primary: lastFocusedAt DESC

    const aTime = a.lastFocusedAt || 0;

    const bTime = b.lastFocusedAt || 0;

    if (bTime !== aTime) return bTime - aTime;

    // Tie-break: windowId ASC

    return a.id.localeCompare(b.id);

  });

```



### Implementation Steps



**Step 1: Create WindowSwitcher Component**

- Create `packages/rb-shell/src/WindowSwitcher.tsx`

- Props: `windows: WindowState[]`, `onSelect: (windowId: string) => void`, `onCancel: () => void`

- State: `selectedIndex: number` (default 0)

- Render: overlay with list of windows in MRU order

- Each item: app icon (optional), app name, window title, minimized badge (if `mode === 'minimized'`)

- Highlight selected item

- Keys: Tab (select next), Shift+Tab (select prev), Enter (confirm), Esc (cancel)



**Step 2: Wire Ctrl+Tab Keybinding**

- In `Shell.tsx`, add `windowSwitcherOpen` state

- Add global keydown handler: Ctrl+Tab → open switcher, store `previousFocusedWindowId`

- Pass MRU-sorted windows to WindowSwitcher

- On select: if `window.mode === 'minimized'` → `restoreWindow(id)` first, then `focusWindow(id)`

- On cancel: `focusWindow(previousFocusedWindowId)` if valid



**Step 3: Ensure Z-Order**

- WindowSwitcher should have `z-50` or higher (above all windows and modals)

- Use fixed positioning: `fixed inset-0 bg-black/50 flex items-center justify-center`



**Step 4: Test Deterministic Behavior**

- MRU ordering determinism + tie-break

- Focus transfer + un-minimize path

- Cancel restores previous focus

- Keybinding opens/closes overlay



**Step 5: Verify No Regressions**

- PHASE\_AC window routing still works

- PHASE\_AI persistence/restore still works

- Existing keybindings (Ctrl+`, Ctrl+W, etc.) unaffected



### Testing Strategy



**Unit Tests** (`packages/rb-shell/src/__tests__/window-switcher.test.tsx`):

1. **MRU Ordering**: Given windows with different `lastFocusedAt`, switcher renders in MRU order

2. **Tie-Break**: Given windows with same `lastFocusedAt`, switcher sorts by `windowId` ASC

3. **Tab Cycling**: Tab advances selection; Shift+Tab reverses

4. **Enter Selects**: Enter calls `onSelect` with selected window ID

5. **Esc Cancels**: Esc calls `onCancel`

6. **Minimized Window**: Selecting minimized window calls `restoreWindow` before `focusWindow`



**Integration Tests** (optional, via `packages/rb-shell/src/__tests__/shell-lifecycle.test.tsx`):

1. **Ctrl+Tab Opens Switcher**: Pressing Ctrl+Tab opens switcher overlay

2. **Cancel Restores Focus**: Esc closes switcher and returns focus to previous window

3. **Select Focuses Window**: Enter focuses selected window



### Definition of Done



- ✅ WindowSwitcher component renders MRU list deterministically

- ✅ Tab / Shift+Tab cycles selection; Enter selects; Esc cancels

- ✅ Ctrl+Tab keybinding opens switcher (no conflicts with existing bindings)

- ✅ Selecting minimized window restores + focuses deterministically (no timers)

- ✅ Cancel restores previous focus

- ✅ Overlay z-order stacks above all windows and modals

- ✅ No state persistence (switcher state is ephemeral)

- ✅ 6+ comprehensive tests covering MRU ordering, cycling, focus transfer, cancel

- ✅ All quality gates pass (lint, typecheck, build, tests)

- ✅ No regressions in PHASE\_AC routing or PHASE\_AI persistence

- ✅ Contract-first: PHASE\_AJ added to AI\_STATE.md before implementation

- ✅ Git workflow: branch phase-aj-window-switcher, FF-only merge to main



---



\## Completed Phases



\- PHASE\_A — Repository Initialization

\- PHASE\_B — pnpm Monorepo Structure

\- PHASE\_C — Core Logic Engine

\- PHASE\_D — UI Shell \& Desktop

\- PHASE\_E — App Framework

\- PHASE\_F — Legal \& Licensing Foundation

\- PHASE\_G — Genesis Stabilization \& Attribution Cleanup

\- PHASE\_H — Logic Playground Foundation

\- PHASE\_I — Logic Playground Visual Programming

\- PHASE\_J — Advanced Windowing System

\- PHASE\_K — Session Persistence

\- PHASE\_L — Settings Foundation

\- PHASE\_M — Settings Polish

\- PHASE\_N — Launcher App

\- PHASE\_O — Welcome \& Onboarding

\- PHASE\_P — Launcher Refinement

\- PHASE\_Q — Testing Framework

\- PHASE\_R — Test Hardening \& Warning Enforcement

\- PHASE\_S — System Search

\- PHASE\_T — Command Palette \& Macro System

\- PHASE\_U — Files App Foundation

\- PHASE\_V — Files Workflow Polish

\- PHASE\_W — Files Operations

\- PHASE\_X — Cross-App File Actions

\- PHASE\_Y — Open-With Payload + Target Consumption

\- PHASE\_Z — Multi-Target Open With + Deterministic Focus

\- PHASE\_AA — File Associations + Deterministic Default Target Resolution

\- PHASE\_AB — File Association Manager UI

\- PHASE\_AC — Deterministic Window Routing for Open-With

- PHASE\_AD — System Search: Deterministic File Provider + Default Open + Open With

- PHASE\_AE — System Search Open-With Modal + Files Global Store Unification

- PHASE\_AF — Deterministic Filesystem Persistence + Import/Export/Reset

- PHASE\_AG — Settings "Filesystem Data" Panel + Safe Factory Reset

- PHASE\_AH — Factory Reset with Hardened Confirmation

- PHASE\_AI — Deterministic Session Restore (Window Layout Persistence + Safe Reset)



---



\## Active Objectives



\- \[x] Correct legal name spelling to Connor Angiel across repo

\- \[x] Centralize legal attribution

\- \[x] Add CI guard against incorrect attribution

\- \[x] Document AI usage rules inside repo



---



\## Forbidden Actions



AI agents must NOT:

\- Reformat files unnecessarily

\- Introduce new branches without instruction

\- Open stacked PRs

\- Modify licensing terms implicitly

\- Rename packages or folders

\- Touch deployment config without approval



---



\## Allowed Actions Without Extra Approval



\- Mechanical refactors

\- Scripted replacements

\- Documentation improvements

\- Test fixes

\- Lint fixes



---



\## Handoff Protocol



After completing work, an AI agent MUST:

1\. Update phase status or objectives

2\. Append a short factual Change Log entry

3\. Avoid narrative or commentary



---



\## Change Log



\### 2025-12-18
\- Implemented PHASE_AC Deterministic Window Routing for Open-With; resolveTargetWindowId pure function with reuse policy (prefer most-recently-focused, fallback to oldest, create new if none/minimized); added lastFocusedAt timestamp tracking on focusWindow; extended OpenWithIntent with routingHint metadata (NOT in app payload); Shell dispatchIntent uses routing resolver to reuse/create windows; Open With modal N key toggle for new-window mode with visual indicator; Files handleOpenWith passes preferNewWindow through routingHint; all 356 tests pass with zero warnings (346 baseline + 10 new routing tests); build passes; phase complete
\- Implemented PHASE_AB File Association Manager UI; keyboard-first panel in Settings app (Arrow keys navigate, Enter edits, Delete clears, R resets, E exports, I imports); listAssociations/resetAll/exportJson/importJson store helpers; canonical JSON export with stable key ordering; import validates schema, normalizes extensions, filters unknown targetIds; Target Picker Modal shows only eligible apps; Reset/Export/Import modals with failure-safe error handling; all 346 tests pass with zero warnings (327 baseline + 19 new store tests); build passes; phase complete
\- Implemented PHASE_AA file associations with deterministic default target resolution per file type (extension + resourceType); D/Shift+D keyboard actions in Open With modal; [DEFAULT] marker display; extension normalization (lowercase, no leading dot); localStorage persistence (rb:file-associations); resolveDefaultTarget with fallback to first eligible target; Cmd/Ctrl+Enter uses default target; comprehensive tests (24 new association store tests); all 327 tests pass with zero warnings; build passes; phase complete

\### 2025-12-17
\- Wired Playground launcher search actions through a centralized handler to open Settings/docs or stub project creation; panel remains mounted; objectives unchanged; phase unchanged
\- Added launcher search panel test coverage to ensure Enter triggers the action handler; objectives unchanged; phase unchanged

\### 2025-12-13

\- Corrected legal attribution spelling to Connor Angiel across entire codebase

\- Commit: 5b353687

\### 2025-12-14

\- Added docs/ai-usage-rules.md to document existing AI usage governance within the repo

\- Marked objective “Document AI usage rules inside repo” as complete; phase unchanged

\- Added docs/legal-attribution.md as canonical attribution guidance; marked objective “Centralize legal attribution” as complete; phase unchanged

\- Added CI legal/trademark guard job to scan tracked files and verify Connor Angiel attribution reference in AI_STATE.md; marked objective “Add CI guard against incorrect attribution” as complete; phase unchanged

\- Hardened CI legal_guard patterns/output to avoid banned literals and prevent self-triggering; phase unchanged

\### 2025-12-15
\- Removed banned boilerplate/legal phrases and trademark symbols across tracked files to satisfy CI legal_guard; objectives unchanged; phase unchanged
\- Added launcher dock tooltip hint to reinforce desktop metaphor; no behavior change; objectives unchanged; phase unchanged

\- Added AGENTS.md as a pointer for AI agents to AI_STATE.md and existing governance docs; objectives unchanged; phase unchanged

\- Added Launcher app registered in app registry with Dock entry using existing Launcher component; objectives unchanged; phase unchanged

\- Launcher now lists registered apps (excluding itself) and opens selected apps via existing window flow; objectives unchanged; phase unchanged

\- Added keyboard shortcut (Ctrl+K / Cmd+K) to open the Launcher and updated Dock tooltip; objectives unchanged; phase unchanged
\- Re-ran lint for the launcher shortcut, set Launcher as singleton to reuse focus behavior, and confirmed Dock tooltip matches the shortcut; objectives unchanged; phase unchanged

\- Added Launcher smoke test covering registry-derived list (excluding launcher) and click-to-launch behavior; objectives unchanged; phase unchanged

\- Added keyboard navigation (Up/Down/Enter) to the Launcher list and updated launcher test; objectives unchanged; phase unchanged
\- Launcher now auto-focuses the selected entry on open to enable immediate keyboard navigation; launcher test updated; objectives unchanged; phase unchanged
\- Added inline Launcher keyboard search filter with query display and tests; objectives unchanged; phase unchanged
\- Escape now clears Launcher search when present and closes the Launcher window when query is empty; launcher tests updated; objectives unchanged; phase unchanged
\- Added Launcher recent apps list (last 5 launches tracked in shell memory) with UI section and tests; objectives unchanged; phase unchanged
\- Added Launcher pinned apps support with pin/unpin controls, pinned section ahead of recent/all lists, in-memory/localStorage tracking, and updated tests; objectives unchanged; phase unchanged
\- Refined Launcher pinned apps handling (explicit pin/unpin click handling, no duplicate listings) with updated tests; pins remain stored via existing localStorage path; objectives unchanged; phase unchanged
\- Launcher now auto-closes after launching when onClose is provided; launcher tests updated; objectives unchanged; phase unchanged

- Confirmed launcher tests consolidated at packages/rb-apps/src/__tests__/launcher.test.tsx with no duplicate tests directory; objectives unchanged; phase unchanged
- Aligned Dock launcher title/aria-label with the global Ctrl+K / Cmd+K shortcut via a centralized hint constant; objectives unchanged; phase unchanged
- Added Launcher help overlay toggled by '?' to surface keyboard controls; launcher test updated; objectives unchanged; phase unchanged
- Verified launcher tests exist only at packages/rb-apps/src/__tests__/launcher.test.tsx with no stray src/tests duplicate; objectives unchanged; phase unchanged
- Added explicit Dock button titles and aria-labels for clearer accessibility and discoverability; objectives unchanged; phase unchanged
- Added keyboard-based Dock reordering (Alt+ArrowLeft/Right) with focus retention; dock order persisted via existing localStorage path; objectives unchanged; phase unchanged
- Added Dock reorder hint tooltip, restricted Alt+Arrow handling to Alt-only, and namespaced dock order storage key; objectives unchanged; phase unchanged
- Added Launcher Settings footer action with Ctrl+, / Cmd+, shortcut when Settings app is available; launcher tests updated; objectives unchanged; phase unchanged
- Launcher now surfaces running apps via shell window state inside the Launcher list with accompanying test coverage; objectives unchanged; phase unchanged
- Expanded Launcher dock tooltip to include shortcut, type-to-search, and Settings shortcut hints without changing behavior; objectives unchanged; phase unchanged

### 2025-12-16
- Reverted commit fbc5488 ("chore: tidy settings aria keyshortcuts") to remove unintended aria shortcut, governance, and test changes; objectives unchanged; phase unchanged
- Restored environment guardrails documenting pnpm-only workflow, forbidden remote operations, and apply_patch fallback; objectives unchanged; phase unchanged
- Corrected STAGEA root script examples to keep `--if-present` on pnpm recursion rather than forwarding to test/lint tools; objectives unchanged; phase unchanged
- Reaffirmed pnpm-only guardrails, advising contributors to ignore automated npm/remote output and expected pnpm build-script warnings; objectives unchanged; phase unchanged
- Hardened Launcher Settings shortcut to ignore Shift modifier and added test coverage; objectives unchanged; phase unchanged
- Added Meta+Shift regression coverage for the Launcher Settings shortcut guard; objectives unchanged; phase unchanged
- Removed unintended governance doc and AGENTS additions from the Meta+Shift shortcut test commit while keeping the launcher shortcut guards and coverage; objectives unchanged; phase unchanged
- Trimmed governance doc noise while retaining launcher shortcut guard coverage; objectives unchanged; phase unchanged
- Expanded Launcher dock tooltip to include shortcut, type-to-search, and Settings shortcut hints without changing behavior; objectives unchanged; phase unchanged

### 2025-12-16
- Reverted commit fbc5488 ("chore: tidy settings aria keyshortcuts") to remove unintended aria shortcut, governance, and test changes; objectives unchanged; phase unchanged
- Restored environment guardrails documenting pnpm-only workflow, forbidden remote operations, and apply_patch fallback; objectives unchanged; phase unchanged
- Corrected STAGEA root script examples to keep `--if-present` on pnpm recursion rather than forwarding to test/lint tools; objectives unchanged; phase unchanged
- Reaffirmed pnpm-only guardrails, advising contributors to ignore automated npm/remote output and expected pnpm build-script warnings; objectives unchanged; phase unchanged
- Hardened Launcher Settings shortcut to ignore Shift modifier and added test coverage; objectives unchanged; phase unchanged
- Added Meta+Shift regression coverage for the Launcher Settings shortcut guard; objectives unchanged; phase unchanged
- Removed unintended governance doc and AGENTS additions from the Meta+Shift shortcut test commit while keeping the launcher shortcut guards and coverage; objectives unchanged; phase unchanged
- Expanded Launcher dock tooltip to include shortcut, type-to-search, and Settings shortcut hints without changing behavior; objectives unchanged; phase unchanged

### 2025-12-16
- Reverted commit fbc5488 ("chore: tidy settings aria keyshortcuts") to remove unintended aria shortcut, governance, and test changes; objectives unchanged; phase unchanged
- Restored environment guardrails documenting pnpm-only workflow, forbidden remote operations, and apply_patch fallback; objectives unchanged; phase unchanged
- Corrected STAGEA root script examples to keep `--if-present` on pnpm recursion rather than forwarding to test/lint tools; objectives unchanged; phase unchanged
- Reaffirmed pnpm-only guardrails, advising contributors to ignore automated npm/remote output and expected pnpm build-script warnings; objectives unchanged; phase unchanged
- Hardened Launcher Settings shortcut to ignore Shift modifier and added test coverage; objectives unchanged; phase unchanged
- Added Meta+Shift regression coverage for the Launcher Settings shortcut guard; objectives unchanged; phase unchanged
- Expanded Launcher dock tooltip to include shortcut, type-to-search, and Settings shortcut hints without changing behavior; objectives unchanged; phase unchanged

### 2025-12-16
- Reverted commit fbc5488 ("chore: tidy settings aria keyshortcuts") to remove unintended aria shortcut, governance, and test changes; objectives unchanged; phase unchanged
- Restored environment guardrails documenting pnpm-only workflow, forbidden remote operations, and apply_patch fallback; objectives unchanged; phase unchanged
- Corrected STAGEA root script examples to keep `--if-present` on pnpm recursion rather than forwarding to test/lint tools; objectives unchanged; phase unchanged
- Reaffirmed pnpm-only guardrails, advising contributors to ignore automated npm/remote output and expected pnpm build-script warnings; objectives unchanged; phase unchanged
- Hardened Launcher Settings shortcut to ignore Shift modifier and added test coverage; objectives unchanged; phase unchanged
- Expanded Launcher dock tooltip to include shortcut, type-to-search, and Settings shortcut hints without changing behavior; objectives unchanged; phase unchanged

### 2025-12-16
- Reverted commit fbc5488 ("chore: tidy settings aria keyshortcuts") to remove unintended aria shortcut, governance, and test changes; objectives unchanged; phase unchanged
- Restored environment guardrails documenting pnpm-only workflow, forbidden remote operations, and apply_patch fallback; objectives unchanged; phase unchanged
- Corrected STAGEA root script examples to keep `--if-present` on pnpm recursion rather than forwarding to test/lint tools; objectives unchanged; phase unchanged
- Expanded Launcher dock tooltip to include shortcut, type-to-search, and Settings shortcut hints without changing behavior; objectives unchanged; phase unchanged
### 2025-12-16
- Confirmed rb-apps Launcher test remains only at packages/rb-apps/src/__tests__/launcher.test.tsx with no src/tests drift; references remain normalized; no behavior change; objectives unchanged; phase unchanged
- Centralized Dock Launcher Settings shortcut hint string to reduce tooltip drift (no behavior change); objectives unchanged; phase unchanged
- Added global Ctrl+, / Cmd+, shortcut in shell to open Settings when the Settings app exists; ignores editable targets and extra modifiers; objectives unchanged; phase unchanged
- No other behavior changes; phase unchanged
- Hardened Launcher Settings shortcut guards to ignore extra modifiers and editable targets; tests updated; objectives unchanged; phase unchanged
- Ensured work is on the main branch and confirmed launcher tests live only under packages/rb-apps/src/__tests__ (no src/tests drift); objectives unchanged; phase unchanged
- Documented guardrails against running npm install, modifying remotes/fetch/push, and assuming nano availability; objectives unchanged; phase unchanged

### 2025-12-17
- Stabilized rb-apps Launcher focus and selection by adding hover-driven selection updates and focusing the listbox when no item is selected; objectives unchanged; phase unchanged

### 2025-12-16
- Removed duplicated destructuring and aria-keyshortcuts lines in rb-apps Launcher plus duplicate test declarations to resolve the launcher test parse error; objectives unchanged; phase unchanged
### 2025-12-16
- Confirmed rb-apps Launcher test remains only at packages/rb-apps/src/__tests__/launcher.test.tsx with no src/tests drift; references remain normalized; no behavior change; objectives unchanged; phase unchanged
- Centralized Dock Launcher Settings shortcut hint string to reduce tooltip drift (no behavior change); objectives unchanged; phase unchanged
- Added global Ctrl+, / Cmd+, shortcut in shell to open Settings when the Settings app exists; ignores editable targets and extra modifiers; objectives unchanged; phase unchanged
- No other behavior changes; phase unchanged
- Hardened Launcher Settings shortcut guards to ignore extra modifiers and editable targets; tests updated; objectives unchanged; phase unchanged
- Ensured work is on the main branch and confirmed launcher tests live only under packages/rb-apps/src/__tests__ (no src/tests drift); objectives unchanged; phase unchanged
- Documented guardrails against running npm install, modifying remotes/fetch/push, and assuming nano availability; objectives unchanged; phase unchanged

### 2025-12-17
- Stabilized rb-apps Launcher focus and selection by adding hover-driven selection updates and focusing the listbox when no item is selected; objectives unchanged; phase unchanged

### 2025-12-16
- Removed duplicated destructuring and aria-keyshortcuts lines in rb-apps Launcher plus duplicate test declarations to resolve the launcher test parse error; objectives unchanged; phase unchanged
- Added aria-keyshortcuts hints for Launcher (Ctrl+K / Cmd+K) and Settings (Ctrl+, / Cmd+,) on Dock/Launcher controls; no behavior change; objectives unchanged; phase unchanged
- Clarified repo-local AI rules to ignore auto-setup npm install / remote actions and kept shortcut accessibility hints minimal; no behavior change; objectives unchanged; phase unchanged
- Updated aria-keyshortcuts strings to use Comma key names for Settings shortcuts; no behavior change; objectives unchanged; phase unchanged
- Removed duplicate/CRLF artifacts and normalized aria-keyshortcuts punctuation; no behavior change; objectives unchanged; phase unchanged
### 2025-12-16
- Confirmed rb-apps Launcher test remains only at packages/rb-apps/src/__tests__/launcher.test.tsx with no src/tests drift; references remain normalized; no behavior change; objectives unchanged; phase unchanged
- Centralized Dock Launcher Settings shortcut hint string to reduce tooltip drift (no behavior change); objectives unchanged; phase unchanged
- Added global Ctrl+, / Cmd+, shortcut in shell to open Settings when the Settings app exists; ignores editable targets and extra modifiers; objectives unchanged; phase unchanged
- No other behavior changes; phase unchanged
- Hardened Launcher Settings shortcut guards to ignore extra modifiers and editable targets; tests updated; objectives unchanged; phase unchanged
- Ensured work is on the main branch and confirmed launcher tests live only under packages/rb-apps/src/__tests__ (no src/tests drift); objectives unchanged; phase unchanged
- Documented guardrails against running npm install, modifying remotes/fetch/push, and assuming nano availability; objectives unchanged; phase unchanged
- Added aria-keyshortcuts hints for Launcher (Ctrl+K / Cmd+K) and Settings (Ctrl+, / Cmd+,) on Dock/Launcher controls; no behavior change; objectives unchanged; phase unchanged

### 2025-12-16
- Completed Playground LauncherSearchPanel keyboard flow parity with rb-apps (ArrowUp/ArrowDown clamped navigation, Enter executes selection, Escape clears query) and added coverage; objectives unchanged; phase unchanged
### 2025-12-16
- Wired Playground launcher visibility to Ctrl+K / Cmd+K with Escape-to-close on empty queries, returning focus to the shell and covering open/close shortcuts in tests; objectives unchanged; phase unchanged
### 2025-12-16
- Confirmed rb-apps Launcher test remains only at packages/rb-apps/src/__tests__/launcher.test.tsx with no src/tests drift; references remain normalized; no behavior change; objectives unchanged; phase unchanged
- Centralized Dock Launcher Settings shortcut hint string to reduce tooltip drift (no behavior change); objectives unchanged; phase unchanged
- Added global Ctrl+, / Cmd+, shortcut in shell to open Settings when the Settings app exists; ignores editable targets and extra modifiers; objectives unchanged; phase unchanged
- No other behavior changes; phase unchanged
- Hardened Launcher Settings shortcut guards to ignore extra modifiers and editable targets; tests updated; objectives unchanged; phase unchanged
- Ensured work is on the main branch and confirmed launcher tests live only under packages/rb-apps/src/__tests__ (no src/tests drift); objectives unchanged; phase unchanged
- Documented guardrails against running npm install, modifying remotes/fetch/push, and assuming nano availability; objectives unchanged; phase unchanged
- Locked in deterministic window lifecycle rules (focus, z-order, minimize/restore, singleton vs. multi-instance behavior) with new shell and window store tests; objectives unchanged; phase unchanged
### 2025-12-17
- Enforced single-focus restoration for minimized windows, tightened z-order stability on close/raise, and expanded window store lifecycle tests for focus transfer and restore behavior; objectives unchanged; phase unchanged
### 2025-12-16
- Confirmed rb-apps Launcher test remains only at packages/rb-apps/src/__tests__/launcher.test.tsx with no src/tests drift; references remain normalized; no behavior change; objectives unchanged; phase unchanged
- Centralized Dock Launcher Settings shortcut hint string to reduce tooltip drift (no behavior change); objectives unchanged; phase unchanged
- Added global Ctrl+, / Cmd+, shortcut in shell to open Settings when the Settings app exists; ignores editable targets and extra modifiers; objectives unchanged; phase unchanged
- No other behavior changes; phase unchanged
- Hardened Launcher Settings shortcut guards to ignore extra modifiers and editable targets; tests updated; objectives unchanged; phase unchanged
- Ensured work is on the main branch and confirmed launcher tests live only under packages/rb-apps/src/__tests__ (no src/tests drift); objectives unchanged; phase unchanged
- Documented guardrails against running npm install, modifying remotes/fetch/push, and assuming nano availability; objectives unchanged; phase unchanged
- Added aria-keyshortcuts hints for Launcher (Ctrl+K / Cmd+K) and Settings (Ctrl+, / Cmd+,) on Dock/Launcher controls; no behavior change; objectives unchanged; phase unchanged

### 2025-12-16
- Completed Playground LauncherSearchPanel keyboard flow parity with rb-apps (ArrowUp/ArrowDown clamped navigation, Enter executes selection, Escape clears query) and added coverage; objectives unchanged; phase unchanged
### 2025-12-16
- Wired Playground launcher visibility to Ctrl+K / Cmd+K with Escape-to-close on empty queries, returning focus to the shell and covering open/close shortcuts in tests; objectives unchanged; phase unchanged
### 2025-12-16
- Confirmed rb-apps Launcher test remains only at packages/rb-apps/src/__tests__/launcher.test.tsx with no src/tests drift; references remain normalized; no behavior change; objectives unchanged; phase unchanged
- Centralized Dock Launcher Settings shortcut hint string to reduce tooltip drift (no behavior change); objectives unchanged; phase unchanged
- Added global Ctrl+, / Cmd+, shortcut in shell to open Settings when the Settings app exists; ignores editable targets and extra modifiers; objectives unchanged; phase unchanged
- No other behavior changes; phase unchanged
- Hardened Launcher Settings shortcut guards to ignore extra modifiers and editable targets; tests updated; objectives unchanged; phase unchanged
- Ensured work is on the main branch and confirmed launcher tests live only under packages/rb-apps/src/__tests__ (no src/tests drift); objectives unchanged; phase unchanged
- Documented guardrails against running npm install, modifying remotes/fetch/push, and assuming nano availability; objectives unchanged; phase unchanged
- Formalized Launcher contract in AI_STATE.md specifying singleton, restore-from-minimized, and focus invariants; added Shell.openWindow fix to restore minimized singleton windows before focusing; added launcher-lifecycle.test.tsx OS-level tests; cleaned duplicate code in Launcher.tsx and launcher.test.tsx; all tests pass; objectives unchanged; phase unchanged
- Formalized Window + Shell lifecycle contract in AI_STATE.md specifying focus surface, Dock interaction, keyboard semantics, and visual state rules; added shell-lifecycle.test.tsx with 11 tests covering focus, minimize/maximize, and z-index behavior; cleaned duplicate code in Dock.tsx; all 49 tests pass; objectives unchanged; phase unchanged
- Implemented Files app as first real multi-window workflow proving non-singleton behavior; added sidebar navigation (Home/Desktop/Documents), mock file system with folder entries, keyboard navigation (Arrow/Enter/Escape), and 10 targeted tests covering lifecycle and independent state; Shell.openWindow correctly creates new Files windows on each Dock click; all 59 tests pass; objectives unchanged; phase unchanged
- Implemented Settings depth & persistence proving singleton semantics and OS-wide configuration; documented Settings contract in AI_STATE.md (strict singleton, Cmd/Ctrl+, shortcut, state persistence, live propagation); updated settings store with light/dark/system theme variants, wallpaperId (string), and accentColor (static list); implemented failure-safe localStorage persistence; updated applyTheme to support new theme variants with system preference detection; rebuilt Settings UI with Appearance/System sidebar, theme toggle (light/dark/system), wallpaper selector, and keyboard navigation (Arrow/Enter/Escape); added 13 Settings tests covering singleton manifest, theme/wallpaper changes, persistence, and keyboard controls; all 72 tests pass; objectives unchanged; phase unchanged
- Implemented app-to-app interaction via intents (PHASE_K); documented Intent System Contract in AI_STATE.md (explicit user-initiated actions, Shell routing, singleton awareness, immutable payloads); created intent-types.ts defining OpenWithIntent structure; added dispatchIntent function to Shell; implemented Files → Playground proof path with "Open in Playground" button and Cmd/Ctrl+Enter keyboard shortcut; updated LogicPlaygroundApp to receive and display resource metadata; added 5 intent routing tests covering window creation, singleton restoration, payload immutability, and source app state preservation; all 77 tests pass; objectives unchanged; phase unchanged
- Implemented power-user window and command workflows (PHASE_L); documented Command System Contract in AI_STATE.md (stateless synchronous commands, keyboard-only triggers, focused window operations); added executeCommand function with focus-next-window (Cmd/Ctrl+`), close-focused-window (Cmd/Ctrl+W), and minimize-focused-window (Cmd/Ctrl+M) commands; implemented window cycling logic (descending zIndex, wraps around, skips minimized); created Command Palette component with Cmd/Ctrl+Shift+P shortcut for visual command discovery; added 12 command workflow tests covering cycling order, wraparound, minimized window skipping, close/minimize operations, no-op safety, and Command Palette integration; all 89 tests pass; objectives unchanged; phase unchanged
- Implemented System Search for unified app/command/intent discovery (PHASE_M); documented System Search Contract in AI_STATE.md (global modal surface, read-only until confirmed, Cmd/Ctrl+Space shortcut, no indexing/async/fuzzy scoring); created search-types.ts and searchRegistry.ts aggregating apps from rb-apps registry, commands from Command System, and intent targets; implemented SystemSearch.tsx component with single input field, grouped results (Apps/Commands/Actions), keyboard navigation (Arrow/Enter/Escape), zero-latency execution (openWindow/executeCommand/dispatchIntent); added @redbyte/rb-apps dependency to rb-shell package.json; added 17 System Search tests covering filtering (name/description, case-insensitive, excludes launcher), result structure validation, execution behavior, and priority order; all 106 tests pass; objectives unchanged; phase unchanged
- Implemented window layouts and spatial memory (PHASE_N); documented Layout Contract in AI_STATE.md (explicit user-triggered layouts, per-session, normal windows only, no z-index changes); added snapWindow action to rb-windowing store (snap left/right/top/bottom to half-screen) and centerWindow action (400x300 centered on desktop); registered 5 layout commands (snap-left, snap-right, snap-top, snap-bottom, center-window) in CommandPalette and SystemSearch; added keyboard shortcuts (Cmd/Ctrl+Alt+Left/Right/Up/Down/C); integrated layout command execution in Shell with desktop viewport bounds; added 15 layout tests covering snap directions, center positioning, maximized-to-normal exit, minimized no-ops, z-index preservation, non-zero desktop offsets; all 121 tests pass; objectives unchanged; phase unchanged
- Implemented session restore and workspace continuity (PHASE_O); documented Session Contract in AI_STATE.md (best-effort automatic restore, failure-safe, transparent to user); added saveSession/loadSession helpers with schema validation; implemented auto-persist via Zustand subscription on every window mutation; added restoreSession action to window store; integrated session restore in Shell initialization (loads localStorage, filters unknown apps/Launcher, restores windows with original bounds/mode/zIndex, creates window-app bindings, runs before Welcome screen); added 21 session restore tests covering persistence (bounds/mode/focus/zIndex), loadSession validation (corrupted JSON, invalid schema), restoreSession action (preserves all window state), integration (post-restore manipulation, new window creation); all 142 tests pass; objectives unchanged; phase unchanged
- Implemented workspaces for multi-context organization (PHASE_P); documented Workspace Contract in AI_STATE.md (named snapshots of window state, explicit user-controlled, local-only, failure-safe); created workspaceStore.ts with Zustand store managing workspaces array and activeWorkspaceId (createWorkspace, switchWorkspace, deleteWorkspace, renameWorkspace actions); implemented workspace persistence to localStorage with schema validation; integrated workspace-aware boot flow in Shell (prioritizes active workspace, falls back to session restore, filters unknown apps/Launcher); added 3 workspace commands (create-workspace, switch-workspace, delete-workspace) to CommandPalette and SystemSearch; implemented minimal UI using window.prompt for workspace name input and selection, alert for errors (power-user first, no dock UI); workspace switching closes all windows and restores target snapshot; added 28 workspace tests covering create/switch/delete operations, persistence, active workspace across reload, corrupted data handling, rename workspace, getWorkspace, listWorkspaces; all 170 tests pass; objectives unchanged; phase unchanged
- Implemented macros for repeatable action sequences (PHASE_Q); documented Macro Contract in AI_STATE.md (named sequences of action steps, synchronous/deterministic execution, failure-safe abort-on-error, local-only persistence, explicit user-triggered); created macroTypes.ts (MacroStep union: command/openApp/intent/switchWorkspace) and macroStore.ts with Zustand store (createMacro, deleteMacro, renameMacro, updateMacroSteps, getMacro, listMacros actions); implemented localStorage persistence with schema validation; created executeMacro.ts execution engine (MacroExecutionContext interface, sequential step execution, abort on first error with step index reporting); integrated macro execution in Shell (switchWorkspaceById helper, executeMacroById wrapper, run-macro command, ref-based circular dependency resolution); added run-macro command to CommandPalette and SystemSearch; added MacroSearchResult type to search-types.ts; integrated macros in SystemSearch component with "Macros" group and onExecuteMacro callback; added 31 macro tests covering store operations (create/delete/rename/update, persistence, validation), execution (command/openApp/intent/switchWorkspace steps, sequential multi-step, abort on unknown app/workspace, error reporting), and integration (localStorage restore); all 201 tests pass; objectives unchanged; phase unchanged
- Implemented multi-target open-with and deterministic focus (PHASE_Z); expanded FILE_ACTION_TARGETS to 2 real targets (Logic Playground for .rblogic, Text Viewer for .txt/.md) with deterministic eligibility predicates based on resourceType + file extension; created TextViewerApp handling open-with intent with resourceId payload and deterministic focus using requestAnimationFrame; removed all setTimeout hacks from LogicPlaygroundApp focus behavior (replaced with requestAnimationFrame for single-frame delay); Open With modal now filters targets by eligibility predicate (only shows compatible apps for selected file, displays "No available targets" for unsupported types); added circuit.rblogic file to Home folder in fsModel for testing; added 9 PHASE_Z tests covering eligibility predicates (Logic Playground vs Text Viewer for different file types), registry validation (>=2 targets with deterministic isEligible functions), and deterministic behavior; updated fsModel tests and PHASE_X/Y/V tests to account for new filesystem structure; all 303 tests pass with zero warnings (PHASE_R gate satisfied); build passes; updated CHANGELOG.md with PHASE_Z completion; objectives unchanged; phase complete
