# RedByte 72-Hour Ship Plan

**Goal:** "Next Lab Ready" — a student with a Windows laptop and Basys 3 can complete a lab assignment end-to-end without help.

**Reference:** [What RedByte Is](../specs/what-redbyte-is.md)

---

## PR1: Window Drag Performance (DONE)

**Branch:** `perf/window-drag`
**Status:** Merged to main. Build passes, 7/7 tests pass.

Changes:
- Document-level drag/resize listeners (no dropped drags)
- transform:translate3d during drag (compositor-only, no layout recalc)
- rAF-based throttle replacing Date.now()
- Debounced localStorage persistence (suppressed during drag)
- Removed filter:saturate(0.92) on unfocused windows

---

## PR2: Surface Reduction + Dead Code Cleanup

**Branch:** `cleanup/surface-reduction`
**Goal:** Remove everything that isn't the golden path. The app list shrinks from 16 registered apps to 10. Dead files on disk get deleted.

### Task 2.1: Delete dead app files

Delete these 16 files that are not registered and never imported:
- `apps/WelcomeApp.tsx`
- `apps/StartHereApp.tsx`
- `apps/AppStoreApp.tsx`
- `apps/StatusPanelApp.tsx`
- `apps/VirtualLabApp.tsx`
- `apps/VirtualLabAppImpl.tsx`
- `apps/StudentLabApp.tsx`
- `apps/InstructorRunDetailApp.tsx`
- `apps/LabExaminerApp.tsx`
- `apps/LabExaminerAppRegistry.tsx`
- `apps/FpgaProofViewerApp.tsx`
- `apps/HelpApp.tsx`
- `apps/LogicHelpApp.tsx`
- `apps/UserManualApp.tsx`
- `apps/WalkthroughPage.tsx`
- `apps/LogicLabApp.tsx`

Verify: `pnpm build` passes. No import errors.

### Task 2.2: Delete stale .js duplicates in rb-shell

~14 `.test.js` files in `packages/rb-shell/src/__tests__/` are stale copies of `.test.tsx` files. Delete the `.js` versions. Run tests to confirm `.tsx` versions still pass.

### Task 2.3: Deregister non-essential apps

In `registerAllApps()`, remove registration of:
- `LabsApp` (redundant — LabWorkspaceApp is the studio)
- `ECELabApp` (redundant — labs accessed via HomeApp starter kits)

This leaves 14 registered apps in full mode. The dock and launcher only show golden-path apps.

### Task 2.4: Clean up dead comments in index.ts

Remove the 15-line "REMOVED" comment block (lines 215-229). The code is gone; the comments shouldn't linger.

**Commit:** `cleanup: delete 16 dead app files, deregister redundant apps`

---

## PR3: Visual Cohesion — "Make It Look Different Tonight"

**Branch:** `ui/visual-cohesion`
**Goal:** The shell feels like a different product after this PR. Focused on HomeScreen (desktop background) and window chrome.

### Task 3.1: HomeScreen redesign

Replace the current HomeScreen (inline styles, scattered layout) with a clean centered layout:
- Large "RedByte Studio" wordmark, centered vertically
- Subtitle: "Digital Logic Lab Environment"
- One primary CTA: "Open Dashboard" or the last project
- Pipeline strip below (Build → Simulate → Hardware → Export) as a subtle status bar
- Remove the scattered app grid sections
- Use CSS module instead of inline styles

### Task 3.2: Window chrome cleanup

In ShellWindow.tsx:
- Standardize title bar height to 36px
- Remove conditional border-radius logic for non-maximized — always use `var(--rb-radius-lg)`
- Consistent shadow: focused gets `var(--rb-shadow-3)`, unfocused gets `var(--rb-shadow-1)` (already done in PR1)
- Title text: 13px, font-weight 500, truncate with ellipsis

### Task 3.3: Dock simplification

Reduce dock to golden-path apps only:
- Home (dashboard)
- Studio (lab-workspace)
- Playground (logic-playground)
- Settings
- Divider
- Files (below divider, smaller)

### Task 3.4: Remove noise texture and vignette overlays

In `packages/rb-shell/src/styles.css`, the `::before` pseudo-elements add a noise texture SVG and vignette gradient overlay. These add visual clutter without purpose. Remove them.

**Commit:** `ui: redesign HomeScreen, simplify dock, clean window chrome`

---

## PR4: Shell.tsx Extraction (Copilot Task)

**Branch:** `refactor/shell-extraction`
**Goal:** Break Shell.tsx from 3,328 lines into focused modules under 400 lines each.

This is mechanical refactoring — no behavior changes. Extract into:
- `shell/useBootSequence.ts` — boot screen, app registration, first-run detection
- `shell/useWindowManager.ts` — window open/close/focus/move, workspace management
- `shell/useKeyboardShortcuts.ts` — all keyboard handlers
- `shell/useFileOperations.ts` — file open, save, drag-drop, file associations
- `shell/useDeterminism.ts` — recording, playback, proof generation
- `shell/useModals.ts` — modal state management (command palette, search, about, etc.)
- `Shell.tsx` — composition root, renders components, delegates to hooks

Each extraction: extract hook → import in Shell.tsx → run tests → commit.

**Tests:** All 14 test files in `packages/rb-shell/src/__tests__/` must pass after each extraction.

---

## PR5: Granular Store Selectors

**Branch:** `perf/granular-selectors`
**Goal:** Shell stops re-rendering on every window move.

### Task 5.1: Window ID list selector

In Shell.tsx, replace:
```tsx
const windowsRaw = useWindowStore((s) => s.windows);
```
With:
```tsx
const windowIds = useWindowStore((s) => s.windows.map(w => w.id), shallow);
```

Shell now re-renders only when windows are added/removed, not moved/resized.

### Task 5.2: Per-window state selector

Each ShellWindow already receives its state as props. Verify that `React.memo` with custom equality prevents re-renders when sibling windows change. Add equality check if missing.

### Task 5.3: LabStore selector granularity

The 780-line LabStore is subscribed monolithically in multiple components. Add granular selectors for the 5 most-accessed slices. (Detailed plan TBD after PR4 lands — need to profile first.)

---

## PR6: First-Run Polish

**Branch:** `feat/first-run-polish`
**Goal:** The FirstRunWizardApp reliably detects toolchain, tests USB, and gets student to Dashboard in under 2 minutes.

Detailed plan deferred — depends on current FirstRunWizardApp state.

---

## Day-by-Day Schedule

| Day | PRs | Outcome |
|-----|-----|---------|
| **Day 1 (Today)** | PR1 (done), PR2, PR3 | Product looks and feels different. Dead code gone. Golden path enforced. |
| **Day 2** | PR4, PR5 | Shell is maintainable. No jank from store re-renders. |
| **Day 3** | PR6, bug fixes, student checklist | End-to-end flow works on a clean Windows machine. |

---

## Student Machine Checklist (ships Day 3)

Will be written as `docs/student-setup.md` after PR6 validates the first-run flow. Content:
1. Prerequisites (Node 20+, pnpm, USB drivers for Basys 3)
2. Clone + install + dev server
3. First-run wizard walkthrough
4. Open a lab, complete it, export submission
5. Troubleshooting (common errors and fixes)
