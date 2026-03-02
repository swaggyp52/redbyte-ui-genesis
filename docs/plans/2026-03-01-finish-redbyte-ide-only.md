# Finish RedByte IDE — Complete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform RedByte from a partially-working multi-app monorepo into a single, polished, production-ready digital logic IDE — deleting every non-IDE artifact, removing all submission/grader logic, fixing all functional gaps across the 6 surfaces, and achieving visual coherence throughout.

**Architecture:** The only artifact that ships is `apps/playground` (the IDE). Every other app is deleted. The 6 surfaces (Project, Design, Verify, Export, Import, Hardware) each need both functional completion and UI polish. Submission/evidence/capsule machinery is removed entirely — it belongs to a grading workflow that is out of scope.

**Tech Stack:** React 18 + TypeScript + Zustand + Vite + pnpm monorepo. Vitest for unit tests. Playwright for E2E. `pnpm verify:gates` is the CI gate runner.

**Authority:** `AI_STATE.md` is the source of truth for sprint history. Update it after every sprint. `pnpm verify:gates` must pass before every commit.

---

## Sprint A — Repo Surgery (Do First — Unblocks Everything)

*Nothing can be trusted until dead code is gone. Do this before any surface work.*

---

### Task A-1: Delete tmpclaude-* temp directories

**Files:**
- Delete: all `tmpclaude-*` dirs in repo root (hundreds of leaked Claude CWDs)

**Step 1: Count and confirm what exists**

```bash
ls c:/Users/conno/redbyte-ui | grep tmpclaude | wc -l
```

Expected output: large number (>100)

**Step 2: Delete all tmpclaude directories**

```bash
cd c:/Users/conno/redbyte-ui
rm -rf tmpclaude-*/
```

**Step 3: Verify clean**

```bash
ls | grep tmpclaude
git status --short | head -5
```

Expected: no output from grep, git status shows mass deletions

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete leaked tmpclaude-* working directories from repo root"
```

---

### Task A-2: Delete dead apps

**Files to delete:**
- `apps/lab3-webapp/` — ECE141 classroom app (superseded by IDE)
- `apps/manual-site/` — marketing/docs site (not shipped)
- `apps/docs/` — documentation app (if it exists)
- `apps/studio/` — design system playground
- `apps/playground_bak2/` — stale backup

**Step 1: Verify playground still builds before deleting anything**

```bash
cd c:/Users/conno/redbyte-ui
pnpm --filter playground build 2>&1 | tail -5
```

Expected: success

**Step 2: Delete dead app directories**

```bash
cd c:/Users/conno/redbyte-ui
rm -rf apps/lab3-webapp apps/manual-site apps/studio apps/playground_bak2
# docs app may or may not exist
rm -rf apps/docs 2>/dev/null || true
```

**Step 3: Verify playground still builds**

```bash
pnpm --filter playground typecheck
```

Expected: no errors referencing deleted apps

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete dead apps (lab3-webapp, manual-site, studio, playground_bak2)"
```

---

### Task A-3: Delete dead packages

Dead packages to remove from `packages/`:
- `packages/rb-shell/` — OS shell window manager (explicitly out of scope)
- `packages/rb-analog-sim/` — analog simulation (out of scope)
- `packages/rb-windowing/` — window manager (out of scope)
- `packages/rb-logic-3d/` — 3D voxel Redstone world (to be removed from HardwareSurface in Sprint H)

**Step 1: Check what imports rb-shell**

```bash
cd c:/Users/conno/redbyte-ui
grep -r "rb-shell\|rb-analog-sim\|rb-windowing" packages/rb-apps/src --include="*.ts" --include="*.tsx" -l
```

Note all files that need to be updated.

**Step 2: Check what imports rb-logic-3d**

```bash
grep -r "rb-logic-3d\|Lab3DScene" packages/rb-apps/src --include="*.tsx" -l
```

Expected: `HardwareSurface.tsx` is the only consumer.

**Step 3: Remove rb-logic-3d import from HardwareSurface.tsx**

- File: `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
- Remove: `import { Lab3DScene } from '@redbyte/rb-logic-3d';`
- Remove: the entire `{show3D && (...)}` block (lines containing `ide-hw-3d-wrap`, `Lab3DScene`, `handle3dSwitchToggle`, etc.)
- Remove: `show3D` state and all 3D-related state/callbacks

**Step 4: Delete dead packages**

```bash
cd c:/Users/conno/redbyte-ui
rm -rf packages/rb-shell packages/rb-analog-sim packages/rb-windowing packages/rb-logic-3d
```

**Step 5: Remove from root package.json / workspace if referenced**

```bash
grep -r "rb-shell\|rb-analog-sim\|rb-windowing\|rb-logic-3d" . --include="package.json" -l
```

Remove those entries from each file found.

**Step 6: Verify build**

```bash
pnpm install
pnpm --filter playground build 2>&1 | tail -10
```

Expected: clean build

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete dead packages (rb-shell, rb-analog-sim, rb-windowing, rb-logic-3d)"
```

---

### Task A-4: Delete all dead rb-apps application components

These are app components that are not the IDE. They live in `packages/rb-apps/src/apps/` and should be deleted entirely.

**Files to delete:**
- `ECELabApp.tsx` + `.js`
- `ECELabManifest.ts` + `.js`
- `files/` directory
- `FilesApp.tsx` + `.js`
- `firstRun/` directory (if exists)
- `FirstRunWizardApp.tsx` + `.module.css`
- `HardwarePanelApp.tsx` + `.js` + `.module.css`
- `hardwarePanelUtils.ts` + `.js`
- `HelpApp.tsx` + `.js`
- `HomeApp.tsx` + `.js` + `.module.css`
- `InstructorApp.tsx` + `.js` + `.module.css`
- `InstructorRunDetailApp.tsx` + `.js` + `.module.css`
- `LabLauncherApp.tsx`
- `LabsApp.tsx` (if exists)
- `LabWorkspaceApp.tsx` (if exists)
- `LauncherApp.tsx` (if exists)
- `LogicLabApp.tsx` (if exists)
- `LogicPlaygroundApp.tsx` (if exists)
- `SubmissionInspectorApp.tsx` (if exists)
- `SystemLogApp.tsx` (if exists)
- `TerminalApp.tsx` (if exists)
- `TextViewerApp.tsx` (if exists)
- `ToolchainSetupApp.tsx` (if exists)
- `UserManualApp.tsx` (if exists)
- `WalkthroughPage.tsx` (if exists)

**Step 1: List all non-IDE app files**

```bash
ls packages/rb-apps/src/apps/ | grep -v "^ide$\|^IdeApp"
```

**Step 2: Delete them**

```bash
cd packages/rb-apps/src/apps
# Delete everything that isn't IdeApp.tsx, IdeApp.js, or the ide/ directory
find . -maxdepth 1 -not -name "." -not -name "ide" -not -name "IdeApp.tsx" -not -name "IdeApp.js" -exec rm -rf {} +
```

**Step 3: Typecheck**

```bash
pnpm --filter rb-apps typecheck
```

Fix any import errors that arise (likely none since IdeApp.tsx only imports from `./ide/`).

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete all non-IDE app components from rb-apps"
```

---

## Sprint B — IdeApp.tsx + Submission Machinery Removal

*After repo surgery, the IDE's main entry point still contains submission/grader wiring. Remove it.*

---

### Task B-1: Remove SubmissionViewerSurface from IdeApp.tsx

**Files:**
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`
- Delete: `packages/rb-apps/src/apps/ide/surfaces/SubmissionViewerSurface.tsx`

**Step 1: Read current IdeApp.tsx surface routing**

```bash
grep -n "SubmissionViewer\|submission\|grader\|proofRun\|validateSubmission\|generateIde" \
  packages/rb-apps/src/apps/IdeApp.tsx
```

Note all lines referencing submission machinery.

**Step 2: Remove from IdeApp.tsx**

- Remove the `SubmissionViewerSurface` import
- Remove `parseIdeSubmissionZip`, `validateSubmissionForLab`, `generateIdeSubmissionBundle` imports
- Remove the `proofRunFlags` state and all references
- Remove the `submission` surface route (the tab/case that renders `<SubmissionViewerSurface />`)
- Remove any `onImportSubmission` prop wiring
- Remove the `submissionPreview` state

The surface tabs should be exactly: `project | design | verify | export | import | hardware`

**Step 3: Delete SubmissionViewerSurface.tsx**

```bash
rm packages/rb-apps/src/apps/ide/surfaces/SubmissionViewerSurface.tsx
```

**Step 4: Typecheck**

```bash
pnpm --filter rb-apps typecheck
```

Fix any remaining type errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(ide): remove SubmissionViewerSurface and all submission/grader wiring from IdeApp"
```

---

### Task B-2: Remove evidenceCapsule.ts and its consumers

**Files:**
- Delete: `packages/rb-apps/src/apps/ide/evidenceCapsule.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`
- Modify: any other importer

**Step 1: Find all consumers**

```bash
grep -r "evidenceCapsule\|buildEvidenceCapsule\|EvidenceManifest" \
  packages/rb-apps/src --include="*.ts" --include="*.tsx" -l
```

**Step 2: Remove capsule sealing from ExportSurface.tsx**

In `ExportSurface.tsx`:
- Remove `import { buildEvidenceCapsule, type EvidenceManifest } from '../evidenceCapsule';`
- Remove `capsuleSealState`, `capsuleSealPayload`, `capsuleManifest`, `capsuleBundleHash`, `capsuleManifestHash`, `capsuleFileList`, `capsuleBuildError`, `capsuleBuildState` state variables
- Remove `handleBuildEvidenceCapsule` callback — replace it with a simpler `handleDownloadKit` that calls `buildEvidenceCapsule`-free logic (just download the zip without the evidence manifest)
- Remove the `capsule` step from `STEP_ORDER` (change to 6 steps: validate, mapping, clock, bundle, manifest, zip)
- Remove all `capsuleSeal*` render references in the JSX

The download button should simply trigger a zip download without capsule sealing or evidence manifest embedding.

**Step 3: Delete evidenceCapsule.ts**

```bash
rm packages/rb-apps/src/apps/ide/evidenceCapsule.ts
```

Also delete `buildEvidenceDiagnostics` helper if it only served capsule logic (check the function in ExportSurface.tsx — if it only checks `verifyResult` for submission purposes, inline or remove it).

**Step 4: Typecheck**

```bash
pnpm --filter rb-apps typecheck
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(export): remove evidence capsule sealing — export downloads Vivado kit without submission manifest"
```

---

### Task B-3: Remove parseIdeSubmission from ImportSurface.tsx

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

**Step 1: Remove submission imports and prop**

In `ImportSurface.tsx`:
- Remove `import { parseIdeSubmissionZip, NotASubmissionZipError, SubmissionIntegrityError, type ParsedIdeSubmission } from '../../../export/parseIdeSubmission';`
- Remove `onImportSubmission?: (submission: ParsedIdeSubmission) => void;` from `ImportSurfaceProps`
- Remove all code that calls `parseIdeSubmissionZip` or `onImportSubmission`
- If the upload tab had a "Load submission ZIP" path, remove that branch

**Step 2: Typecheck**

```bash
pnpm --filter rb-apps typecheck
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(import): remove submission ZIP parsing — import is HDL/XDC/project only"
```

---

### Task B-4: Fix E0 console leakage — DesignSurface primary culprit

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: any other file with console.log calls in rb-apps

**Step 1: Count current console calls**

```bash
grep -rn "console\.log\|console\.warn\|console\.error\|console\.group" \
  packages/rb-apps/src --include="*.ts" --include="*.tsx" | wc -l
```

Note the count.

**Step 2: Find all console calls in DesignSurface**

```bash
grep -n "console\." packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx
```

**Step 3: Remove or gate all console calls**

For each console call found:
- If it's a debug/diagnostic call: **delete it entirely**
- If it's genuinely useful for development: gate it behind `if (import.meta.env.DEV) { ... }`

Priority: `console.groupCollapsed` / `console.group` in DesignSurface are the biggest E0 budget violators — delete all of them.

**Step 4: Repeat for all other rb-apps source files**

```bash
grep -rn "console\." packages/rb-apps/src --include="*.ts" --include="*.tsx" -l
```

Go file by file, removing or gating.

**Step 5: Verify budget**

```bash
grep -rn "console\." packages/rb-apps/src --include="*.ts" --include="*.tsx" | wc -l
```

Target: ≤ 140 occurrences

**Step 6: Commit**

```bash
git add -A
git commit -m "fix(e0): eliminate console leakage — remove debug console.log/group from DesignSurface and rb-apps"
```

---

## Sprint C — ProjectSurface Functional Completion

*ProjectSurface is the first thing a student sees. It must feel like a real product entry point.*

---

### Task C-1: Remove submission dock from ProjectSurface

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`

**Step 1: Find submission sections**

```bash
grep -n "submit\|Submit\|submission\|Submission\|studentName\|onSubmit" \
  packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx
```

**Step 2: Remove submission dock**

In `ProjectSurface.tsx`:
- Remove the submission form section (student name input, submit button, preview panel)
- Remove `onSubmitProject`, `submissionStatus`, `submissionPreview` props/state
- Remove `onGoToSubmission` prop (no longer a surface)
- Simplify the 3-state design from `landing | loaded | submit` to `landing | loaded`

**Step 3: Ensure the surface has a clear CTA flow**

The ProjectSurface should end with: "Open in IDE →" CTA that navigates to DesignSurface. Replace any submit CTA with "Continue to Design →".

**Step 4: Typecheck**

```bash
pnpm --filter rb-apps typecheck
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(project): remove submission dock — ProjectSurface is entry point only"
```

---

### Task C-2: Complete the "Start a Lab" gallery with lab starters

**Files:**
- Create: `packages/rb-apps/src/apps/ide/labStarters.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`

**Step 1: Define lab starter data**

Create `packages/rb-apps/src/apps/ide/labStarters.ts`:

```typescript
import type { RBProject } from '../../export/projectFormat';

export interface LabStarter {
  id: string;
  labNumber: number;
  title: string;
  description: string;
  difficulty: 'intro' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  project: () => RBProject;
}

export const LAB_STARTERS: LabStarter[] = [
  {
    id: 'lab1-gates',
    labNumber: 1,
    title: 'Lab 1 — Basic Logic Gates',
    description: 'AND, OR, NOT gates with switch inputs and LED outputs.',
    difficulty: 'intro',
    estimatedMinutes: 30,
    project: () => ({
      // Minimal valid RBProject with 2 switch inputs + 1 LED output
      // pre-placed, no gates yet
      version: 1,
      id: 'lab1-starter',
      name: 'Lab 1 Starter',
      nodes: [
        { id: 'sw0', type: 'INPUT', label: 'SW0', x: 100, y: 150 },
        { id: 'sw1', type: 'INPUT', label: 'SW1', x: 100, y: 250 },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', x: 500, y: 200 },
      ],
      edges: [],
      vectors: [],
      pinMapping: {
        sw0: 'V17',
        sw1: 'W16',
        ld0: 'U16',
      },
    }),
  },
  // Add labs 2-8 with appropriate I/O scaffolding
];
```

**Step 2: Add lab gallery section to ProjectSurface**

In `ProjectSurface.tsx`, add a "Start a Lab" section that renders `LAB_STARTERS` as clickable cards. Each card shows: lab number, title, description, difficulty badge, estimated time. Clicking loads the lab's starter project.

**Step 3: Test: each starter loads without console errors**

```bash
pnpm --filter playground dev &
# Manually verify each lab card loads the starter in the IDE
# Check browser console for errors
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(project): add lab starters gallery for labs 1-8 with pre-wired I/O scaffolding"
```

---

## Sprint D — DesignSurface Polish and Functional Fixes

---

### Task D-1: Fix tool mode toggle labels (SEL/WIR → icons)

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: relevant CSS file for `.ide-design-mode-toggle`

**Step 1: Find the mode toggle render**

```bash
grep -n "SEL\|WIR\|mode-toggle\|selectMode\|wireMode" \
  packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx | head -20
```

**Step 2: Replace text labels with descriptive button text**

Change:
- `SEL` → `Select` (or use a cursor icon SVG inline)
- `WIR` → `Wire` (or use a wire icon SVG inline)

If icons aren't available in `rb-icons`, use text labels that are full words. The goal is a first-time student can understand what each mode does without a tooltip.

**Step 3: Add keyboard shortcut hints to button titles**

```tsx
<button title="Select tool (S)" ...>Select</button>
<button title="Wire tool (W)" ...>Wire</button>
```

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(design): replace cryptic SEL/WIR mode labels with readable 'Select' / 'Wire' labels"
```

---

### Task D-2: Add G hotkey for grid snap toggle

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find existing hotkey handler**

```bash
grep -n "keydown\|hotkey\|useEffect.*keyboard\|snap\|grid" \
  packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx | head -20
```

**Step 2: Add G hotkey to the keydown handler**

In the keyboard effect, add:
```typescript
if (e.key === 'g' || e.key === 'G') {
  setSnapToGrid(prev => !prev);
}
```

If `snapToGrid` state doesn't exist yet, add it:
```typescript
const [snapToGrid, setSnapToGrid] = useState(true);
```

Pass `snapToGrid` to the canvas component (check what prop name the canvas uses).

**Step 3: Show grid snap status in toolbar**

Add a small indicator in the toolbar: `G: Grid ON` / `G: Grid OFF` as a ghost toggle button.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(design): add G hotkey for grid snap toggle with toolbar indicator"
```

---

### Task D-3: Remove "AND Demo" and "IO Pins" quick-action confusion

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find these quick actions**

```bash
grep -n "AND Demo\|IO Pins\|quick.*action\|demo" \
  packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx
```

**Step 2: Remove or replace**

- If these are quick-insert buttons that place a demo circuit: remove them (they belong in the examples gallery on ProjectSurface, not in the design canvas toolbar).
- Replace with: nothing (less is more here; students should learn to place their own gates).

**Step 3: Commit**

```bash
git add -A
git commit -m "fix(design): remove confusing AND Demo / IO Pins quick-action buttons from toolbar"
```

---

### Task D-4: Add HDL pane syntax highlighting note + improve empty state

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`

**Step 1: Find the HDL pane render**

```bash
grep -n "textarea\|hdl-pane\|split.*view\|vhdl\|verilog" \
  packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx | head -20
```

**Step 2: Add a "Generated VHDL — read only" label above the textarea**

The HDL pane shows live-generated VHDL/Verilog. It should have a clear header:

```tsx
<div className="ide-hdl-pane-header">
  <span>Generated VHDL</span>
  <code className="ide-hdl-pane-badge">read-only</code>
</div>
<textarea className="ide-hdl-pane" readOnly value={generatedVhdl} />
```

Add `readOnly` attribute if not already there (prevents student confusion about editing it).

**Step 3: Improve empty-canvas state**

Find the empty canvas message and ensure it shows a clear 3-step guide:
1. "Pick a gate from the palette on the left"
2. "Click to place it on the canvas"
3. "Drag from an output port to an input port to wire it"

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(design): label HDL pane as read-only, improve empty canvas guidance"
```

---

## Sprint E — VerifySurface Polish and Functional Completion

---

### Task E-1: Verify that run context block renders for sequential circuits

**Files:**
- Read/Test: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Read: `packages/rb-apps/src/apps/ide/verifyReport.ts`

**Step 1: Identify the run context rendering path**

In `VerifySurface.tsx`, `runContextRows` is built using `formatVerifyProtocol`, `formatVerifySampling`, `formatVerifyTickZero`. These display in the Details tab. Confirm this renders by checking:

```bash
grep -n "runContextRows\|run-context\|verifyTab.*details" \
  packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx | head -20
```

**Step 2: Ensure clocked banner shows when isSequentialRun**

The `IdeCallout` at line `~2083` should render:
```
Clocked circuit: expected outputs are sampled AFTER the rising edge of each clock tick.
Tick 0 = initial state (no clock pulse yet).
```
Confirm `isSequentialRun` detection is correct:
```typescript
const isSequentialRun = Boolean(
  hasDff || lastRun?.meta?.circuitKind === 'sequential' || lastRun?.schedule === 'clocked_macro'
);
```

If the `hasDff` prop is passed from IdeApp correctly, this should work. Verify IdeApp passes `hasDff` from the circuit store.

**Step 3: Add a "Why did this fail?" explanation for first failure**

The failure explainer already exists in the drawer (lines ~2695-2752). Confirm it:
- Shows `firstFailure.signal`, `firstFailure.tick`, `firstFailure.expected`, `firstFailure.actual`
- Shows `firstFailureInputs` (the inputs at the failing tick)
- Has "Jump to tick" button
- Has "Show only mismatches" button

If any of these are missing, add them. The data is all available in component state.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(verify): ensure run context renders for sequential circuits, improve failure explainer"
```

---

### Task E-2: Polish waveform viewer — clock edge markers for sequential runs

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` (WaveformViewer component)

**Step 1: Add clock edge markers to the waveform header**

When `isSequentialRun` is true, each tick represents a clock edge. Add a small triangle or "CLK↑" label in the header rail at each tick position:

```tsx
{isSequentialRun && ticks.map((tick, i) => (
  <text
    key={`clk-${tick}`}
    x={LABEL_W + i * TICK_W + TICK_W / 2}
    y={HEADER_H - 4}
    textAnchor="middle"
    fontSize={7}
    fill="rgba(46,196,182,0.5)"
  >
    ↑
  </text>
))}
```

Pass `isSequentialRun` as a prop into `WaveformViewer`.

**Step 2: Ensure signal direction (IN/OUT) shows in label column**

The `signalMeta` prop is already passed, and the label column shows `▲ IN` / `▼ OUT` sub-labels. Verify these render correctly by checking the test: `data-testid="ide-verify-waveform-svg"`.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(verify): add clock edge markers to waveform viewer header for sequential circuits"
```

---

## Sprint F — ExportSurface Cleanup and IO Completeness Blocking

---

### Task F-1: Simplify ExportSurface — pure Vivado kit download

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

**Step 1: Simplify the download function**

After removing `buildEvidenceCapsule` in Sprint B, `handleBuildEvidenceCapsule` is now dead. Replace with `handleDownloadKit`:

```typescript
const handleDownloadKit = useCallback(async () => {
  if (hasBlockingErrors) return;
  if (!hasVerifyPass) return;

  setIsRebuilding(true);
  try {
    // Build zip from viewModel.artifacts (already computed)
    // viewModel.artifacts contains: top.vhd, top.xdc, vivado_import.tcl, testbench.vhd, README.txt
    const zip = await buildVivadoKitZip(viewModel.artifacts);
    downloadBlob(zip, 'redbyte-vivado-kit.zip');
    onExportBundle?.(viewModel.artifacts);
    onExportResult?.({ status: 'ok', hash: viewModel.exportHash, artifacts: viewModel.artifacts.map(a => a.path), ranAtIso: new Date().toISOString() });
  } catch (err) {
    // show error
  } finally {
    setIsRebuilding(false);
  }
}, [hasBlockingErrors, hasVerifyPass, viewModel, onExportBundle, onExportResult]);
```

Check if `buildVivadoKitZip` or equivalent already exists in the viewModel/toolchain layer. If `viewModel.artifacts` already includes the zip bytes, just trigger the download directly.

**Step 2: Simplify rebuild pipeline steps**

Change `STEP_ORDER` to remove `capsule`:
```typescript
const STEP_ORDER = [
  { id: 'validate', label: 'Validate inputs' },
  { id: 'mapping',  label: 'Validate I/O mapping' },
  { id: 'clock',    label: 'Validate clock domain' },
  { id: 'bundle',   label: 'Build VHDL + constraints' },
  { id: 'manifest', label: 'Generate README' },
  { id: 'zip',      label: 'Package Vivado Kit' },
];
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(export): simplify to pure Vivado kit download — no submission capsule"
```

---

### Task F-2: Block export when IO mapping is incomplete

**Files:**
- Read: `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

**Step 1: Understand current blocking logic**

```bash
grep -n "hasBlockingErrors\|required\|requiredCount\|requiredMapped\|incomplete\|block" \
  packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts | head -20
```

**Step 2: Ensure `buildExportViewModel` emits an error when required pins are unmapped**

In `buildExportViewModel.ts`, check that when `requiredMappedCount < requiredCount`, an `error` diagnostic is added (not just a warning). If it's currently a warning, change it to an error:

```typescript
if (requiredMappedCount < requiredCount) {
  errors.push({
    id: 'io-incomplete',
    severity: 'error',
    message: `${requiredCount - requiredMappedCount} required I/O pin${requiredCount - requiredMappedCount > 1 ? 's' : ''} not mapped. Assign all pins before downloading.`,
    action: { label: 'Map Pins', surfaceTarget: 'hardware' },
  });
}
```

**Step 3: In ExportSurface, add a "Map Pins →" CTA to the blocking banner**

When `hasBlockingErrors` is true due to incomplete IO:
```tsx
<IdeCallout tone="error" title="IO mapping incomplete">
  <p>All required input/output ports must be assigned Basys3 pin identifiers before downloading the Vivado kit.</p>
  <IdeButton tone="primary" onClick={onGoToHardware}>Map Pins in Hardware →</IdeButton>
</IdeCallout>
```

**Step 4: Typecheck**

```bash
pnpm --filter rb-apps typecheck
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(export): block download when required IO pins are unmapped, add 'Map Pins' CTA"
```

---

### Task F-3: Fix artifact preview — add line numbers and copy button

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

**Step 1: Find the artifact preview render**

```bash
grep -n "selectedArtifact\|artifact.*preview\|pre.*vhdl" \
  packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx | head -20
```

**Step 2: Add a "Copy to clipboard" button above the artifact preview**

```tsx
<div className="ide-export-artifact-header">
  <span>{selectedArtifact?.path}</span>
  <IdeButton tone="ghost" onClick={() => navigator.clipboard.writeText(selectedArtifact?.content ?? '')}>
    Copy
  </IdeButton>
</div>
<pre className="ide-export-artifact-preview">{selectedArtifact?.content}</pre>
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(export): add copy-to-clipboard button on artifact preview"
```

---

## Sprint G — ImportSurface Simplification

---

### Task G-1: Clean up ImportSurface — remove submission cruft, improve UX

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

**Step 1: Remove all submission-related code**

After Sprint B-3 removed `onImportSubmission`, verify no stale references remain:
```bash
grep -n "submission\|Submission\|parseIdeSubmission" \
  packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
```

Delete any remaining lines.

**Step 2: Improve the HDL tab empty state**

The HDL tab textarea should start with a helpful placeholder:
```
-- Paste your VHDL or Verilog here
-- Structural VHDL and Verilog only (behavioral/process blocks not supported)
-- Try one of the sample templates below ↓
```

**Step 3: Clarify behavioral VHDL blocker messaging**

When `scanBehavioralConstructs` finds process/always/rising_edge:
- Current: some error message
- Target:

```tsx
<IdeCallout tone="error" title="Behavioral HDL cannot be imported">
  <p>RedByte only supports structural descriptions (instantiated gates and direct signal assignments).</p>
  <p>Found: {behavioralConstructs.join(', ')}</p>
  <p>To use this circuit, redesign it using gate nodes in the Design canvas.</p>
</IdeCallout>
```

**Step 4: Add a "Clear" button to the HDL textarea**

```tsx
<IdeButton tone="ghost" onClick={() => setHdlSource('')}>Clear</IdeButton>
```

**Step 5: Commit**

```bash
git add -A
git commit -m "fix(import): remove submission cruft, improve behavioral blocker message, add Clear button"
```

---

## Sprint H — HardwareSurface: SSD Mapping + Debounce Guidance

---

### Task H-1: Add 7-segment display (SSD) composite pin group to HardwareSurface

**Files:**
- Read: `packages/rb-board-profiles/src/` (find board profile types)
- Modify: `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`

**Step 1: Understand current pin mapping UI**

```bash
grep -n "pin.*map\|mapping.*row\|HardwareMappingRow\|pinTable" \
  packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx | head -20
```

**Step 2: Check board profile for SSD pins**

```bash
grep -rn "CA\|CB\|CC\|CD\|CE\|CF\|CG\|DP\|AN0\|AN1\|AN2\|AN3\|seven.*seg\|ssd\|SevenSeg" \
  packages/rb-board-profiles/src --include="*.ts" -l
```

**Step 3: Add SSD composite group rendering**

In HardwareSurface, when the current project's pin mapping includes any of `{CA, CB, CC, CD, CE, CF, CG, DP, AN0, AN1, AN2, AN3}`, render a collapsed "Seven-Segment Display" section:

```tsx
{hasSsdMapping && (
  <IdeCallout tone="info" title="7-Segment Display">
    <p>Your circuit uses 7-segment display outputs. The Basys3 uses active-low segment lines (0 = segment ON).</p>
    <p>Digit select (AN0–AN3) are also active-low. AN0 controls the rightmost digit.</p>
    <p>Segment order: CA=seg[0], CB=seg[1], CC=seg[2], CD=seg[3], CE=seg[4], CF=seg[5], CG=seg[6], DP=decimal point.</p>
  </IdeCallout>
)}
```

Detect `hasSsdMapping` by checking `mappingRows` for any SSD pin names.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(hardware): add 7-segment display guidance callout when SSD pins are mapped"
```

---

### Task H-2: Add debounce guidance for physical button mappings

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`

**Step 1: Detect button mappings**

When any `mappingRow` has `label` matching `BTNC|BTNU|BTND|BTNL|BTNR` and `direction === 'in'`:

```typescript
const hasButtonMapping = useMemo(
  () => mappingRows.some(r => r.direction === 'in' && /^btn(c|u|d|l|r)/i.test(r.label)),
  [mappingRows]
);
```

**Step 2: Show debounce callout once (dismissable)**

Use a `localStorage` key `rb-debounce-tip-dismissed` to show once per session:

```tsx
{hasButtonMapping && !debounceDismissed && (
  <IdeCallout tone="warn" title="Physical buttons bounce">
    <p>Physical push buttons produce multiple signal transitions when pressed or released.
       Add synchronizer flip-flops or a debounce delay to ensure reliable edge detection.</p>
    <div className="ide-inline-actions">
      <IdeButton tone="ghost" onClick={() => setDebounceDismissed(true)}>Got it</IdeButton>
    </div>
  </IdeCallout>
)}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(hardware): add dismissable debounce guidance callout for physical button mappings"
```

---

## Sprint I — UI Polish: Keyboard Shortcuts + First-Use Onboarding

---

### Task I-1: Add Keyboard Shortcuts panel to Settings modal

**Files:**
- Read: whatever component renders the Settings modal (find it in IdeApp.tsx or a components/ file)
- Modify: Settings modal component

**Step 1: Find the Settings modal**

```bash
grep -rn "Settings\|settings.*modal\|SettingsModal\|keyboard.*short" \
  packages/rb-apps/src/apps/IdeApp.tsx packages/rb-apps/src/apps/ide/ --include="*.tsx" -l
```

**Step 2: Add Keyboard Shortcuts tab**

In the Settings modal, add a "Shortcuts" tab that renders a table:

| Action | Keys |
|---|---|
| Select tool | S |
| Wire tool | W |
| Toggle grid snap | G |
| Rotate selected gate | R |
| Delete selected | Delete / Backspace |
| Select all | Ctrl+A |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z |
| Save project | Ctrl+S |
| Share circuit | Ctrl+Shift+C |
| Switch to Design | 1 |
| Switch to Verify | 2 |
| Switch to Export | 3 |
| Switch to Hardware | 4 |
| Switch to Import | 5 |
| Escape / deselect | Esc |
| Pan canvas | Space+drag |

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(settings): add Keyboard Shortcuts panel to Settings modal"
```

---

### Task I-2: Add first-use onboarding overlay

**Files:**
- Create: `packages/rb-apps/src/apps/ide/components/OnboardingOverlay.tsx`
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`

**Step 1: Create OnboardingOverlay component**

```tsx
// OnboardingOverlay.tsx
import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'rb-onboarding-v1-seen';

const STEPS = [
  {
    title: 'Build your circuit',
    body: 'Use the gate palette on the left to place logic gates. Drag from output ports to input ports to wire them together.',
    anchor: 'palette',
  },
  {
    title: 'Verify correctness',
    body: 'Switch to the Verify tab to add test vectors and run your circuit against expected outputs.',
    anchor: 'verify-tab',
  },
  {
    title: 'Export to hardware',
    body: 'Once verification passes, switch to Export to download a Vivado-ready zip for your Basys3 FPGA.',
    anchor: 'export-tab',
  },
];

export const OnboardingOverlay: React.FC = () => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* storage unavailable */ }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="rb-onboarding-overlay" role="dialog" aria-modal="true">
      <div className="rb-onboarding-card">
        <div className="rb-onboarding-step-indicator">
          {STEPS.map((_, i) => (
            <span key={i} className={`rb-onboarding-dot ${i === step ? 'is-active' : ''}`} />
          ))}
        </div>
        <h2 className="rb-onboarding-title">{current.title}</h2>
        <p className="rb-onboarding-body">{current.body}</p>
        <div className="rb-onboarding-actions">
          <button className="rb-onboarding-skip" onClick={dismiss}>Skip</button>
          {step < STEPS.length - 1 ? (
            <button className="rb-onboarding-next" onClick={() => setStep(s => s + 1)}>
              Next →
            </button>
          ) : (
            <button className="rb-onboarding-next" onClick={dismiss}>
              Get started →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Mount in IdeApp**

In `IdeApp.tsx`:
```tsx
import { OnboardingOverlay } from './ide/components/OnboardingOverlay';
// In render, near the top level:
<OnboardingOverlay />
```

Show only when no saved project exists (`!hasLoadedProject`).

**Step 3: Add CSS**

In the relevant CSS file (check what IdeApp imports for styles):
```css
.rb-onboarding-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(2, 11, 24, 0.85);
  display: grid; place-items: center;
}
.rb-onboarding-card {
  background: var(--ide-surface-2);
  border: 1px solid var(--ide-border);
  border-radius: 8px;
  padding: 32px;
  max-width: 420px;
  width: 90vw;
}
.rb-onboarding-title { font-size: 1.25rem; margin-bottom: 12px; }
.rb-onboarding-body { color: var(--ide-text-soft); line-height: 1.6; margin-bottom: 24px; }
.rb-onboarding-actions { display: flex; justify-content: space-between; }
.rb-onboarding-step-indicator { display: flex; gap: 8px; margin-bottom: 20px; }
.rb-onboarding-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ide-border); }
.rb-onboarding-dot.is-active { background: var(--rb-accent); }
```

**Step 4: Test that it only shows once**

Navigate to IDE in a fresh browser session. Overlay should appear. Click through all 3 steps. Close. Refresh. Overlay should NOT appear again.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add 3-step first-use overlay with localStorage dismissal guard"
```

---

### Task I-3: Share link robustness

**Files:**
- Read: wherever share link logic lives in IdeApp or playground app (`Ctrl+Shift+C` handler)

**Step 1: Find clipboard handling**

```bash
grep -rn "clipboard\|shareLink\|circuit=\|SHARE_POLISH" \
  packages/rb-apps/src/apps/IdeApp.tsx packages/rb-apps/src/apps/ide/ --include="*.tsx" --include="*.ts" -l
```

**Step 2: Implement clipboard fallback modal**

When `navigator.clipboard.writeText()` fails (rejected promise), show a modal:
```tsx
<IdeCallout tone="info" title="Copy this link">
  <input readOnly value={shareUrl} onClick={e => (e.target as HTMLInputElement).select()} />
  <p>Your browser blocked automatic copy. Select all and copy manually.</p>
</IdeCallout>
```

**Step 3: Implement decode error modal**

When the `?circuit=` URL param fails to decode, show:
```tsx
<IdeCallout tone="error" title="Invalid circuit URL">
  <p>The circuit data in this URL could not be decoded (it may be corrupted or truncated).</p>
  <IdeButton tone="primary" onClick={clearURLAndStartFresh}>Clear URL & Start Fresh</IdeButton>
</IdeCallout>
```

Where `clearURLAndStartFresh` removes the `?circuit=` param and loads a blank project.

**Step 4: Add loading spinner during async circuit decode**

During URL decode add a `<IdeSpinner />` overlay so students know something is happening.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(share): clipboard fallback modal, decode error recovery, loading spinner on URL import"
```

---

## Sprint J — Quality Gates

---

### Task J-1: Gates: add console budget gate

**Files:**
- Create: `tests/gates/console-budget.test.ts`

**Step 1: Write the gate test**

```typescript
// tests/gates/console-budget.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const BUDGET = 140;
const TARGET = 'packages/rb-apps/src';

describe('gates:console-budget', () => {
  it(`console.log/warn/error/group calls in rb-apps/src should be ≤ ${BUDGET}`, () => {
    const result = execSync(
      `grep -rn "console\\." ${TARGET} --include="*.ts" --include="*.tsx" | wc -l`,
      { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }
    ).trim();
    const count = Number.parseInt(result, 10);
    expect(count).toBeLessThanOrEqual(BUDGET);
  });
});
```

**Step 2: Run the gate**

```bash
pnpm verify:gates
```

Expected: PASS (after Sprint B-4 console cleanup)

If it fails, return to Sprint B-4 and remove more console calls.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(gates): add console-budget gate — enforce ≤140 console calls in rb-apps/src"
```

---

### Task J-2: Gate: export IO completeness

**Files:**
- Create: `tests/gates/export-io-completeness-gate.test.ts`
- Read: `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`

**Step 1: Write the gate**

```typescript
// tests/gates/export-io-completeness-gate.test.ts
import { describe, it, expect } from 'vitest';
import { buildExportViewModel } from '../../packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel';

const CIRCUIT_WITH_UNMAPPED_IO: RBProject = {
  // A project with 2 inputs and 1 output but no pin assignments
  // ... minimal valid project structure
};

describe('gates:export-io-completeness', () => {
  it('blocks export when required pins are not mapped', () => {
    const vm = buildExportViewModel(CIRCUIT_WITH_UNMAPPED_IO, undefined);
    const hasBlocker = vm.errors.some(e => e.severity === 'error' && /pin/i.test(e.message));
    expect(hasBlocker).toBe(true);
  });

  it('allows export when all required pins are mapped', () => {
    const CIRCUIT_WITH_MAPPED_IO: RBProject = {
      // Same circuit but with pin assignments filled
    };
    const vm = buildExportViewModel(CIRCUIT_WITH_MAPPED_IO, undefined);
    const hasBlocker = vm.errors.some(e => e.severity === 'error' && /pin/i.test(e.message));
    expect(hasBlocker).toBe(false);
  });
});
```

**Step 2: Run**

```bash
pnpm verify:gates
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(gates): add export-io-completeness gate"
```

---

### Task J-3: Gate: lab starter load without errors

**Files:**
- Create: `tests/gates/lab-starter-load.test.ts`

**Step 1: Write the gate**

```typescript
// tests/gates/lab-starter-load.test.ts
import { describe, it, expect } from 'vitest';
import { LAB_STARTERS } from '../../packages/rb-apps/src/apps/ide/labStarters';

describe('gates:lab-starter-load', () => {
  for (const starter of LAB_STARTERS) {
    it(`Lab ${starter.labNumber} starter loads without error and has I/O`, () => {
      const project = starter.project();
      expect(project).toBeTruthy();
      const inputs = project.nodes.filter(n => n.type === 'INPUT');
      const outputs = project.nodes.filter(n => n.type === 'OUTPUT');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
      expect(outputs.length).toBeGreaterThanOrEqual(1);
    });
  }
});
```

**Step 2: Run**

```bash
pnpm verify:gates
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(gates): add lab-starter-load gate for all 8 lab starters"
```

---

### Task J-4: Update AI_STATE.md

**Files:**
- Modify: `AI_STATE.md`

**Step 1: Add Sprint 20 entry**

Add a new Change Log entry:
```markdown
## Sprint 20 — 2026-03-01: Full IDE Completion Pass

### Changed
- Deleted: dead apps (lab3-webapp, manual-site, studio, playground_bak2), dead packages (rb-shell, rb-analog-sim, rb-windowing, rb-logic-3d), all tmpclaude-* temp dirs, all non-IDE app components
- Removed: SubmissionViewerSurface, evidenceCapsule.ts, parseIdeSubmission from ImportSurface, submission dock from ProjectSurface, proofRunFlags from IdeApp
- Fixed E0 console budget: reduced from 770 to ≤140
- Added: first-use onboarding overlay (3 steps, localStorage guard)
- Added: Keyboard Shortcuts panel in Settings
- Added: G hotkey for grid snap, improved design tool labels (SEL/WIR → Select/Wire)
- Added: Lab starters gallery (Labs 1-8) in ProjectSurface
- Added: SSD guidance callout in HardwareSurface
- Added: Debounce guidance for physical button mappings
- Added: Share link clipboard fallback + decode error recovery
- Fixed: ExportSurface simplified to pure Vivado kit download — no capsule sealing
- Fixed: Export blocks when required IO pins unmapped
- Fixed: Sequential verify run context block confirmed working
- Added gates: console-budget, export-io-completeness, lab-starter-load

### Gates
- pnpm verify:gates: ALL PASS
- pnpm build:unified: CLEAN
- E0 console budget: ≤140 ✅
```

**Step 2: Commit**

```bash
git add AI_STATE.md
git commit -m "chore(state): update AI_STATE.md — Sprint 20 change log"
```

---

## Execution Order

```
Sprint A (Tasks A-1 → A-4)   Repo surgery — delete everything that isn't the IDE
Sprint B (Tasks B-1 → B-4)   IdeApp + submission removal + console cleanup
Sprint C (Tasks C-1 → C-2)   ProjectSurface — submission dock removal + lab starters
Sprint D (Tasks D-1 → D-4)   DesignSurface — label polish, grid snap, HDL pane
Sprint E (Tasks E-1 → E-2)   VerifySurface — sequential context, waveform clock markers
Sprint F (Tasks F-1 → F-3)   ExportSurface — capsule removal, IO blocking, artifact copy
Sprint G (Task G-1)           ImportSurface — submission removal, UX improvements
Sprint H (Tasks H-1 → H-2)   HardwareSurface — SSD guidance, debounce callouts
Sprint I (Tasks I-1 → I-3)   UI polish — keyboard shortcuts, onboarding, share robustness
Sprint J (Tasks J-1 → J-4)   Quality gates + AI_STATE.md update
```

Each sprint = one or more logical commits. `pnpm verify:gates` must pass before each commit.

---

## Definition of Done

- [ ] `apps/` contains only `playground/`
- [ ] `packages/` contains no dead packages
- [ ] No `tmpclaude-*` dirs in repo root
- [ ] `SubmissionViewerSurface.tsx` deleted
- [ ] `evidenceCapsule.ts` deleted
- [ ] No submission/grader code anywhere in `rb-apps/src`
- [ ] `pnpm verify:gates` — all gates pass
- [ ] `pnpm build:unified` — clean build, 0 warnings
- [ ] E0 console budget: ≤ 140 occurrences in `packages/rb-apps/src`
- [ ] ProjectSurface has lab starters gallery for Labs 1-8
- [ ] DesignSurface: tool labels readable, grid snap hotkey works, HDL pane labeled read-only
- [ ] ExportSurface: blocks when IO incomplete, downloads Vivado kit without capsule
- [ ] HardwareSurface: SSD guidance shows for SSD circuits, debounce tip shows for buttons
- [ ] First-use onboarding overlay shows once on fresh load
- [ ] Keyboard shortcuts discoverable in Settings
- [ ] Share link clipboard fallback + decode error recovery working
- [ ] `AI_STATE.md` updated with Sprint 20 change log

---

*Plan owner: Connor Angiel. Written: 2026-03-01.*
