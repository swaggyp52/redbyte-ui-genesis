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


---



\## Current Phase



Phase ID: PHASE\_G  

Phase Name: Genesis Stabilization \& Attribution Cleanup  

Status: ACTIVE



---



\## Completed Phases



\- PHASE\_A — Repository Initialization

\- PHASE\_B — pnpm Monorepo Structure

\- PHASE\_C — Core Logic Engine

\- PHASE\_D — UI Shell \& Desktop

\- PHASE\_E — App Framework

\- PHASE\_F — Legal \& Licensing Foundation



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
