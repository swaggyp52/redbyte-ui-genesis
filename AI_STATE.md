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



\## Current Phase



Phase ID: PHASE\_Y

Phase Name: Open-With Payload + Target Consumption

Status: ACTIVE



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
