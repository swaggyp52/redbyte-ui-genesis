# Lab Day Stabilization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make RedByte IDE reliable and classroom-proof before lab day: professor Vivado ZIPs import correctly, the core loop is honest and predictable, visual chrome is reduced, and a rehearsal checklist passes cleanly.

**Architecture:** Seven focused commits — no new components, no new design system, no backend changes. Each commit has a gate obligation. Order is: system map → import robustness → classroom hardening → visual discipline → freeze.

**Tech Stack:** TypeScript, React 18, Playwright gate harness (`scripts/gates/_gateHarness.mjs`), Vitest unit tests, JSZip, Vite build

**Key context:**
- ZIP import pipeline: `packages/rb-apps/src/apps/ide/zipImport.ts`
- XDC parser: `packages/rb-apps/src/import/xdcImport.ts`
- HDL→circuit: `packages/rb-apps/src/import/hdlToCircuit.ts`
- Import surface: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
- Project health: `packages/rb-apps/src/apps/ide/projectHealth.ts`
- Import fixtures: `packages/rb-apps/src/fixtures/import/`
- Gate harness: `scripts/gates/_gateHarness.mjs`
- CSS root: `packages/rb-apps/src/apps/ide/ide-root.css`
- Workbench shell: `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`

---

## Commit Summary

| # | Commit message |
|---|----------------|
| 1 | `docs: add IDE_SYSTEM_MAP — modes, runtime authorities, lab-critical paths, gate inventory` |
| 2 | `fix(import): nested folder detection, top-candidate list, XDC path preference` |
| 3 | `fix(import): pin confidence tiers, import blockers panel for unmapped ports` |
| 4 | `fix(import): honest fallback for behavioural HDL + professor-import gate` |
| 5 | `fix(ide): classroom hardening — kill YOU-ARE-HERE dup, Verify status once, console discipline` |
| 6 | `fix(ide): visual authority — remove Design Command Center panel, waveform empty state` |
| 7 | `test(gates): rebaseline screenshots after stabilization` |

---

## Pre-read: Confirmed facts (do not re-verify)

| Fact | Value |
|------|-------|
| `chooseTopHdlEntry` | Picks by `topHdlScore` — prefers `top.vhd/v/sv`, nothing about nested folders |
| `chooseXdcEntry` | Prefers `top.xdc` by name, then shortest path — no `constrs_*/` preference |
| XDC parse result | `{ pinMap: Record<string,string>, warnings: string[] }` — no confidence field |
| `ZipImportInspection` | Has `detectedTopPath`, `detectedXdcPath`, `detectedFiles`, `ignoredFiles`, `warnings`, `project` |
| Import surface Apply flow | `requestApplyProject()` → confirmation dialog → `confirmApplyProject()` → `onImportProject?.(project)` |
| `data-testid="ide-import-zip-inspection"` | Shows detected files after ZIP upload |
| Project surface duplicate | "YOU ARE HERE: Project Setup" appears in both (a) the top guided strip AND (b) inside the main panel header |
| Verify duplicate | "IDLE" pill shown in BOTH panel header top-right AND inside VERIFICATION SUMMARY card |
| Console auto-expand | `IdeWorkbenchShell.tsx` auto-expands to 88px when `consoleHasEntries`, 176px when `consoleHasBlocking` |
| Console collapses to | 40px when neither `consoleHasBlocking` nor `consoleHasEntries` |
| Export console | Currently shows "Diagnostics, build output..." intro text even when there are no diagnostic entries |
| Design Command Center | Panel at top of canvas with title "Design Command Center" and subtitle text — takes ~60px of canvas space |
| Gate: `ide-zip-import-contract.mjs` | Tests the 906-byte `01-and-gate-vivado.zip` fixture |
| Fixture ZIPs | `packages/rb-apps/src/fixtures/import/zip/01-and-gate-vivado.zip` (flat structure, not nested) |

---

## Task 1 · Repo System Map Doc

**Files:**
- Create: `docs/IDE_SYSTEM_MAP.md`

### Step 1: Write the system map

Write `docs/IDE_SYSTEM_MAP.md` with the following sections. This is reference material — no code changes.

```markdown
# RedByte IDE System Map

> Living reference for the IDE codebase. Update when surfaces, authorities, or gates change.

## Surfaces and Responsibilities

| Surface | File | Responsibility |
|---------|------|----------------|
| Project | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | Project identity, I/O mapping, readiness dashboard |
| Design | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx` | Circuit canvas editing + live simulation |
| Verify | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` | Deterministic verification, waveform viewer |
| Export | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | Vivado bundle generation, evidence capsule |
| Hardware | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` | Bring-up checklist, mapping summary |
| Import | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx` | Vivado ZIP / HDL+XDC import pipeline |

## Runtime Authorities

| Authority | File | Responsibility |
|-----------|------|----------------|
| `projectRuntime.ts` | `packages/rb-apps/src/apps/ide/projectRuntime.ts` | Run verification against sim trace |
| `circuitStore.ts` | `packages/rb-apps/src/apps/ide/circuitStore.ts` | Circuit graph mutations |
| `unifiedProjectStore.ts` | `packages/rb-apps/src/apps/ide/stores/unifiedProjectStore.ts` | Single source of truth for RBProject |
| `projectHealth.ts` | `packages/rb-apps/src/apps/ide/projectHealth.ts` | Derives blocking issues from core state |
| `simEngine.ts` | `packages/rb-apps/src/apps/ide/sim/simEngine.ts` | Simulation advancement, trace accumulation |

## Lab-Critical Paths

### Path 1: Professor ZIP Import → Design Shows Circuit
1. `ImportSurface` → user uploads ZIP
2. `zipImport.ts::importVivadoZipFile()` → extracts HDL + XDC → `ZipImportInspection`
3. `zipImport.ts::buildImportedProject()` → calls `parsedHdlToCircuit()` → `RBProject`
4. User clicks Apply → `onImportProject?.(project)` → IDE loads project
5. Design surface renders nodes + connections

**Gate:** `scripts/gates/ide-zip-import-contract.mjs`

### Path 2: Verify Run Produces Trace
1. Design surface runs simulation (30+ ticks)
2. `VerifySurface` → user generates vectors → clicks Run
3. `projectRuntime.ts::runVerification()` → calls `buildVerifyRowsFromRuntimeTrace(vectors, ioRows, sim)`
4. Returns `RunVerificationOutput` with `report` and `waveform`
5. `VerifySurface` renders waveform + PASS/FAIL status

**Gate:** `scripts/gates/ide-verify-reality-contract.mjs`

### Path 3: Export → Vivado Pack
1. Project must have: IO mapping complete + verify PASS
2. `ExportSurface` → `buildEvidenceDiagnostics()` → no errors
3. User clicks "Download Vivado Pack" → `onExportBundle()` → ZIP with top.vhd + top.xdc + BRINGUP.md

**Gate:** `scripts/gates/ide-export-generates-hdl.mjs`

### Path 4: Hardware Checklist
1. Hardware surface receives `health` + `mappingRows` + `vectorsCount`
2. Derives: `hasClockMapping`, `hasResetMapping`, `hasOutputMapping`
3. Checklist rows show Ready/Missing per check

**Gate:** `scripts/gates/ide-bringup-contract.mjs`

## Import Pipeline Details

```
User picks file
  └─ zipImport.ts::importVivadoZipFile(file)
       └─ importVivadoZipBytes(bytes)
            ├─ collectTextEntries(zip)        — flattens all files to { path, text }[]
            ├─ chooseTopHdlEntry(files)       — picks by topHdlScore (prefers top.vhd)
            ├─ chooseXdcEntry(files)          — picks by name (prefers top.xdc)
            ├─ parseVhdl(text) OR parseVerilog(text)
            ├─ parseXdcPins(xdcText)          — returns { pinMap, warnings }
            └─ buildImportedProject(...)      — returns RBProject
```

**Pin resolution:**
- `xdcImport.ts::parseXdcPins()` → `{ portName → PACKAGE_PIN }`
- `basys3Pins.ts::normalizeBasys3PinAlias()` → resolve alias (e.g. "SW0" → "V17")
- `basys3Pins.ts::BASYS3_ALLOWED_PACKAGE_PINS` → Set of valid Basys3 package pins

## Gate Inventory

| Gate | What it protects |
|------|-----------------|
| `ide-bringup-contract.mjs` | Hardware surface loads + bring-up checklist renders |
| `ide-canvas-legibility-contract.mjs` | Canvas text is legible at default zoom |
| `ide-console-autocollapse-contract.mjs` | Console collapses when no blocking entries |
| `ide-design-build-contract.mjs` | Design mode builds without compile errors |
| `ide-design-io-panel-contract.mjs` | Live inputs panel renders and toggles |
| `ide-design-live-sim-contract.mjs` | Simulation ticks advance and pause |
| `ide-export-generates-hdl.mjs` | Export produces VHDL with entity/architecture |
| `ide-export-ready-contract.mjs` | Export shows correct blocked/ready state |
| `ide-layout-contract.mjs` | Shell layout elements and resize handles present |
| `ide-persistence-contract.mjs` | Project state survives page reload |
| `ide-project-readiness-contract.mjs` | Project surface readiness checklist renders |
| `ide-shell-chrome-contract.mjs` | Top bar, rail, status bar within height limits |
| `ide-shell-density-contract.mjs` | Shell passes density assertions at 1280px |
| `ide-verify-contract.mjs` | Verify flow works end-to-end |
| `ide-verify-reality-contract.mjs` | Trace produces ≥8 ticks with correct signals |
| `ide-verify-no-trace-guard-contract.mjs` | hasNoTrace guard works correctly |
| `ide-zip-import-contract.mjs` | ZIP import produces project with ioRows |
| `ide-professor-import-reality-contract.mjs` | Realistic nested Vivado ZIP imports correctly |
| `ide-zoom-presets-contract.mjs` | Zoom preset buttons change canvas zoom |
```

### Step 2: Commit

```bash
git add docs/IDE_SYSTEM_MAP.md
git commit -m "docs: add IDE_SYSTEM_MAP — modes, runtime authorities, lab-critical paths, gate inventory"
```

---

## Task 2 · ZIP Import: Nested Folders + Top Candidate List

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/zipImport.ts`

**Problem:** Vivado exports ZIPs like:
```
project.xpr
project.srcs/sources_1/new/top.vhd
project.srcs/constrs_1/new/basys3.xdc
project.runs/...
```
Current `chooseTopHdlEntry` uses `topHdlScore` which scores by filename only — works accidentally because `top.vhd` is still named `top.vhd`. But `chooseXdcEntry` prefers `top.xdc` by name, not `constrs_1/new/basys3.xdc`. Also, `ZipImportInspection` has no field for "all HDL candidates" — the surface can't show "top candidates: X, Y".

### Step 1: Extend `ZipImportInspection` type

In `zipImport.ts`, add `hdlCandidates` to `ZipImportInspection`:

```typescript
export interface ZipImportInspection {
  sourceName: string;
  detectedTopPath: string;
  detectedTopLanguage: 'vhdl' | 'verilog';
  detectedXdcPath?: string;
  detectedFiles: string[];
  ignoredFiles: string[];
  hdlCandidates: string[];      // ← NEW: all HDL files found, sorted by score (best first)
  xdcCandidates: string[];      // ← NEW: all XDC files found
  parsedHdl: ParsedHDL;
  xdcResult?: XdcParseResult;
  warnings: string[];
  project: RBProject;
}
```

### Step 2: Update `chooseXdcEntry` to prefer `constrs_*/` folders

Replace the `compareXdcEntry` function:

```typescript
function compareXdcEntry(left: ZipTextEntry, right: ZipTextEntry): number {
  const leftPath = left.path.toLowerCase();
  const rightPath = right.path.toLowerCase();
  // Prefer files in constrs_* directories (Vivado project structure)
  const leftConstrs = /\/constr[s]?_\d+\//.test(leftPath);
  const rightConstrs = /\/constr[s]?_\d+\//.test(rightPath);
  if (leftConstrs !== rightConstrs) return leftConstrs ? -1 : 1;
  // Then prefer top.xdc by name
  const leftTop = leftPath.endsWith('/top.xdc') || leftPath === 'top.xdc';
  const rightTop = rightPath.endsWith('/top.xdc') || rightPath === 'top.xdc';
  if (leftTop !== rightTop) return leftTop ? -1 : 1;
  // Then prefer basys3.xdc
  const leftBasys = leftPath.endsWith('/basys3.xdc') || leftPath === 'basys3.xdc';
  const rightBasys = rightPath.endsWith('/basys3.xdc') || rightPath === 'basys3.xdc';
  if (leftBasys !== rightBasys) return leftBasys ? -1 : 1;
  const lengthDelta = left.path.length - right.path.length;
  if (lengthDelta !== 0) return lengthDelta;
  return compareCodepoint(left.path, right.path);
}
```

### Step 3: Update `topHdlScore` to prefer `sources_*/` folders

Replace `topHdlScore`:

```typescript
function topHdlScore(path: string): number {
  const lower = path.toLowerCase();
  const file = lower.split('/').pop() ?? lower;
  // Vivado-style sources directory gets a boost
  const inSourcesDir = /\/sources?_\d+\//.test(lower);
  const fileScore =
    file === 'top.vhd' || file === 'top.vhdl' || file === 'top.v' || file === 'top.sv'
      ? 0
      : file.startsWith('top.')
        ? 1
        : file.includes('top')
          ? 2
          : 3;
  // Files in sources_* dirs get same score but sorted before non-sources files at same level
  return inSourcesDir ? fileScore : fileScore + 4;
}
```

### Step 4: Return candidate lists from `importVivadoZipBytes`

Update the return statement in `importVivadoZipBytes` to include candidates:

```typescript
  const hdlEntries = files.filter((entry) => isHdlPath(entry.path));
  const hdlCandidates = [...hdlEntries]
    .sort(compareHdlEntry)
    .map((entry) => entry.path);

  const xdcEntries = files.filter((entry) => entry.path.toLowerCase().endsWith('.xdc'));
  const xdcCandidates = [...xdcEntries]
    .sort(compareXdcEntry)
    .map((entry) => entry.path);

  return {
    sourceName,
    detectedTopPath: topEntry.path,
    detectedTopLanguage,
    detectedXdcPath: xdcEntry?.path,
    detectedFiles: [topEntry.path, ...(xdcEntry ? [xdcEntry.path] : [])],
    ignoredFiles,
    hdlCandidates,
    xdcCandidates,
    parsedHdl,
    xdcResult,
    warnings,
    project,
  };
```

### Step 5: Update ImportSurface to show candidates

In `ImportSurface.tsx`, find the section that renders `data-testid="ide-import-zip-inspection"` and add a candidate list below the detected paths:

```tsx
{zipInspection.hdlCandidates.length > 1 && (
  <div className="ide-import-zip-candidates" data-testid="ide-import-zip-hdl-candidates">
    <span className="ide-import-zip-label">HDL candidates</span>
    <ol>
      {zipInspection.hdlCandidates.map((path, i) => (
        <li key={path} className={i === 0 ? 'is-selected' : 'is-alt'}>
          {path}
          {i === 0 && <span className="ide-import-zip-selected-badge">selected</span>}
        </li>
      ))}
    </ol>
  </div>
)}
{zipInspection.xdcCandidates.length > 1 && (
  <div className="ide-import-zip-candidates" data-testid="ide-import-zip-xdc-candidates">
    <span className="ide-import-zip-label">XDC candidates</span>
    <ol>
      {zipInspection.xdcCandidates.map((path, i) => (
        <li key={path} className={i === 0 ? 'is-selected' : 'is-alt'}>
          {path}
          {i === 0 && <span className="ide-import-zip-selected-badge">selected</span>}
        </li>
      ))}
    </ol>
  </div>
)}
```

### Step 6: Add nested-folder fixture for unit test

Create `packages/rb-apps/src/apps/ide/__tests__/zipImport.nestedfolder.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { importVivadoZipBytes } from '../zipImport';

// Simulate Vivado project structure with nested folders
async function buildNestedVivadoZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    'project.srcs/sources_1/new/top.vhd',
    `
library ieee; use ieee.std_logic_1164.all;
entity top is
  port (sw0 : in std_logic; sw1 : in std_logic; ld0 : out std_logic);
end top;
architecture rtl of top is
begin
  ld0 <= sw0 and sw1;
end rtl;
    `.trim()
  );
  zip.file(
    'project.srcs/constrs_1/new/basys3.xdc',
    `
set_property PACKAGE_PIN V17 [get_ports {sw0}]
set_property PACKAGE_PIN V16 [get_ports {sw1}]
set_property PACKAGE_PIN U16 [get_ports {ld0}]
    `.trim()
  );
  zip.file('project.runs/impl_1/top.bit', 'dummy bitstream');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new Uint8Array(buffer);
}

describe('zipImport — nested Vivado folder structure', () => {
  it('detects HDL in sources_1/new/', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.detectedTopPath).toBe('project.srcs/sources_1/new/top.vhd');
  });

  it('detects XDC in constrs_1/new/', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.detectedXdcPath).toBe('project.srcs/constrs_1/new/basys3.xdc');
  });

  it('populates ioRows with all 3 ports', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    const allRows = [
      ...result.project.ioMapping.inputs,
      ...result.project.ioMapping.outputs,
    ];
    expect(allRows).toHaveLength(3);
  });

  it('returns hdlCandidates list', async () => {
    const bytes = await buildNestedVivadoZip();
    const result = await importVivadoZipBytes(bytes, { sourceName: 'project.zip' });
    expect(result.hdlCandidates).toContain('project.srcs/sources_1/new/top.vhd');
  });
});
```

### Step 7: Run unit tests

```bash
pnpm --filter @redbyte/rb-apps test packages/rb-apps/src/apps/ide/__tests__/zipImport.nestedfolder.test.ts
```
Expected: 4 PASS

### Step 8: Commit

```bash
git add packages/rb-apps/src/apps/ide/zipImport.ts \
        packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx \
        packages/rb-apps/src/apps/ide/__tests__/zipImport.nestedfolder.test.ts
git commit -m "fix(import): nested folder detection, top-candidate list, XDC path preference"
```

---

## Task 3 · Pin Confidence Tiers + Import Blockers Panel

**Files:**
- Modify: `packages/rb-apps/src/import/xdcImport.ts`
- Modify: `packages/rb-apps/src/apps/ide/zipImport.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

**Problem:** Currently all pins are treated equally — either mapped or warned-as-unsupported. For lab day, unmapped ports need one-click fix (dropdown to pick SW0/LD0/etc). And users need to know which ports have strong vs weak pin mapping.

### Step 1: Add `PinConfidence` to `xdcImport.ts`

Add confidence type and update return:

```typescript
export type PinConfidence = 'strong' | 'weak' | 'none';

export interface XdcPinEntry {
  packagePin: string;
  confidence: PinConfidence;
  // 'strong' = known Basys3 pin in allowed set
  // 'weak'   = parsed from XDC but not in BASYS3_ALLOWED_PACKAGE_PINS
}

export interface XdcParseResult {
  pinMap: XdcPinMap;                         // portName -> packagePin (unchanged)
  pinEntries: Record<string, XdcPinEntry>;   // ← NEW: portName -> { packagePin, confidence }
  warnings: string[];
}
```

Update `upsertPin` inside `parseXdcPins`:

```typescript
  const pinEntries: Record<string, XdcPinEntry> = {};

  const upsertPin = (rawPin: string, rawPortToken: string) => {
    const pin = normalizeBasys3PinAlias(rawPin);
    const portName = normalizePortToken(rawPortToken);
    if (portName.length === 0 || pin.length === 0) return;
    const confidence: PinConfidence = BASYS3_ALLOWED_PACKAGE_PINS.has(pin) ? 'strong' : 'weak';
    maybePushUnsupportedPinWarning(warnings, pin);
    pinMap[portName] = pin;
    pinEntries[portName] = { packagePin: pin, confidence };
  };

  // ... (rest of function unchanged) ...

  return { pinMap, pinEntries, warnings };
```

### Step 2: Surface pin confidence in `buildIoMapping`

In `zipImport.ts`, extend `buildIoMapping` to annotate IO rows with a `pinConfidence` field. This requires the IoMapping type to accept it — check if `IoMapping` type in `rb-utils` has a `confidence` field. If not, add it to the local mapping construction only (as a temporary extended type) or annotate via `meta`.

For now, annotate low-confidence ports as unmapped (empty pin) rather than setting a weak pin:

```typescript
// In buildIoMapping: only apply pin if it's 'strong'
const xdcEntry = xdcResult?.pinEntries?.[normalizeToken(portName)];
const mappedPin =
  xdcEntry && xdcEntry.confidence === 'strong'
    ? xdcEntry.packagePin
    : xdcResult?.pinMap[normalizeToken(portName)] ?? '';
// Still use the pin, but store confidence on the inspection
```

Actually — do NOT filter out weak pins from the mapping. Instead, add a `weakPins` list to `ZipImportInspection` so the surface can show a warning for each weak pin without removing the mapping.

```typescript
// In ZipImportInspection, add:
weakPinPorts: string[];  // portNames where pin was parsed but not in BASYS3_ALLOWED_PACKAGE_PINS
```

And populate it in `importVivadoZipBytes`:

```typescript
const weakPinPorts = xdcResult?.pinEntries
  ? Object.entries(xdcResult.pinEntries)
      .filter(([, entry]) => entry.confidence === 'weak')
      .map(([portName]) => portName)
  : [];
```

### Step 3: Add "Unmapped ports" blockers panel with dropdown fix

In `ImportSurface.tsx`, the existing `data-testid="ide-import-unmapped-list"` section currently shows unmapped ports. Enhance it to include a per-port dropdown for quick mapping to standard Basys3 signals:

```tsx
// In ImportSurface.tsx, find the unmapped ports section and replace:
const BASYS3_QUICK_PINS = [
  'SW0', 'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7',
  'LD0', 'LD1', 'LD2', 'LD3', 'LD4', 'LD5', 'LD6', 'LD7',
  'BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR',
  'CLK100MHZ',
];

// In the unmapped ports render:
{unmappedPorts.map((portName) => (
  <div key={portName} className="ide-import-unmapped-row" data-testid={`ide-import-unmapped-row-${portName}`}>
    <span className="ide-import-unmapped-port-name">{portName}</span>
    <span className="ide-import-unmapped-direction">{portDirection(portName)}</span>
    <select
      className="ide-import-unmapped-pin-select"
      data-testid={`ide-import-unmapped-pin-select-${portName}`}
      value={mapping[portName] ?? ''}
      onChange={(e) => setMapping((prev) => ({ ...prev, [portName]: e.target.value }))}
    >
      <option value="">— map to pin —</option>
      {BASYS3_QUICK_PINS.map((pin) => (
        <option key={pin} value={pin}>{pin}</option>
      ))}
    </select>
  </div>
))}
```

### Step 4: Unit test for confidence output

Add to `packages/rb-apps/src/import/__tests__/xdcImport.test.ts`:

```typescript
it('sets confidence=strong for known Basys3 pins', () => {
  const result = parseXdcPins('set_property PACKAGE_PIN V17 [get_ports {sw0}]');
  expect(result.pinEntries?.['sw0']?.confidence).toBe('strong');
});

it('sets confidence=weak for unknown pins', () => {
  const result = parseXdcPins('set_property PACKAGE_PIN ZZZZ [get_ports {sw0}]');
  expect(result.pinEntries?.['sw0']?.confidence).toBe('weak');
});
```

### Step 5: Run tests

```bash
pnpm --filter @redbyte/rb-apps test packages/rb-apps/src/import/__tests__/xdcImport.test.ts
```
Expected: All PASS (new + existing)

### Step 6: Commit

```bash
git add packages/rb-apps/src/import/xdcImport.ts \
        packages/rb-apps/src/apps/ide/zipImport.ts \
        packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx \
        packages/rb-apps/src/import/__tests__/xdcImport.test.ts
git commit -m "fix(import): pin confidence tiers, import blockers panel for unmapped ports"
```

---

## Task 4 · Honest Fallback + Professor-Import Gate

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/zipImport.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
- Create: `packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip` (binary fixture)
- Create: `scripts/gates/ide-professor-import-reality-contract.mjs`

**Problem:** When HDL is behavioural (has `process`/`always` blocks) the parser returns no instances→ circuit has no gates. The surface should say "HDL uses behavioural constructs — only I/O ports were extracted" rather than silently producing an empty circuit.

### Step 1: Add `reconstructionLevel` to `ImportResult`

In `packages/rb-apps/src/import/hdlToCircuit.ts`, find `ImportResult`:

```typescript
export type ReconstructionLevel = 'full' | 'ports-only' | 'empty';

export interface ImportResult {
  circuit: Circuit;
  warnings: string[];
  unmappedComponents: string[];
  reconstructionLevel: ReconstructionLevel;  // ← NEW
}
```

In `parsedHdlToCircuit`, add at the end before returning:

```typescript
const hasGates = circuit.nodes.some(
  (node) => node.type !== 'INPUT' && node.type !== 'OUTPUT'
);
const hasPortWarnings = warnings.some((w) => w.includes('process') || w.includes('always'));
const reconstructionLevel: ReconstructionLevel =
  circuit.nodes.length === 0
    ? 'empty'
    : !hasGates && hasPortWarnings
      ? 'ports-only'
      : 'full';

return { circuit, warnings, unmappedComponents, reconstructionLevel };
```

### Step 2: Surface `reconstructionLevel` in `ZipImportInspection`

In `zipImport.ts`, add field:

```typescript
export interface ZipImportInspection {
  // ... existing fields ...
  reconstructionLevel: ReconstructionLevel;  // ← NEW
}
```

Populate in `importVivadoZipBytes`:

```typescript
const converted = parsedHdlToCircuit(parsedHdl);  // already called for warnings
// ...
return {
  // ...
  reconstructionLevel: converted.reconstructionLevel,
  // ...
};
```

### Step 3: Show reconstruction callout in ImportSurface

In `ImportSurface.tsx`, below the parse summary, add:

```tsx
{zipInspection?.reconstructionLevel === 'ports-only' && (
  <div
    className="ide-import-recon-callout ide-import-recon-callout--partial"
    data-testid="ide-import-recon-partial"
  >
    <strong>Behavioural HDL detected</strong>
    <p>
      This module uses process/always blocks. RedByte extracted I/O ports only — gates were
      not reconstructed. The project will have the correct I/O mapping but an empty circuit.
      You can wire the circuit manually in Design mode.
    </p>
  </div>
)}
{zipInspection?.reconstructionLevel === 'full' && (
  <div
    className="ide-import-recon-callout ide-import-recon-callout--full"
    data-testid="ide-import-recon-full"
  >
    <strong>Structural HDL</strong>
    <p>Circuit reconstructed with gates and connections.</p>
  </div>
)}
```

### Step 4: Create the professor-style fixture ZIP (binary)

Write a script to generate it, then commit the resulting binary. Create `scripts/build-professor-zip-fixture.mjs`:

```javascript
// scripts/build-professor-zip-fixture.mjs
// Run once: node scripts/build-professor-zip-fixture.mjs
import JSZip from 'jszip';
import { writeFileSync } from 'fs';

const zip = new JSZip();

// Vivado-style nested structure
zip.file(
  'professor_and/professor_and.srcs/sources_1/new/top.vhd',
  `library ieee;
use ieee.std_logic_1164.all;

entity top is
  port (
    sw0 : in  std_logic;
    sw1 : in  std_logic;
    ld0 : out std_logic
  );
end top;

architecture rtl of top is
begin
  ld0 <= sw0 and sw1;
end rtl;
`
);

zip.file(
  'professor_and/professor_and.srcs/constrs_1/new/basys3.xdc',
  `## Switch Inputs
set_property PACKAGE_PIN V17 [get_ports {sw0}]
set_property PACKAGE_PIN V16 [get_ports {sw1}]
## LED Output
set_property PACKAGE_PIN U16 [get_ports {ld0}]
`
);

// Decoy files (typical Vivado project noise)
zip.file('professor_and/professor_and.xpr', '<!-- Vivado project file -->');
zip.file('professor_and/professor_and.runs/synth_1/.Xil/placeholder', '');

const buffer = await zip.generateAsync({ type: 'nodebuffer' });
writeFileSync(
  'packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip',
  buffer
);
console.log('Wrote 02-vivado-nested-andgate.zip');
```

Run:
```bash
node scripts/build-professor-zip-fixture.mjs
```

Verify the file was created:
```bash
ls -la packages/rb-apps/src/fixtures/import/zip/
```

### Step 5: Write `ide-professor-import-reality-contract.mjs`

Create `scripts/gates/ide-professor-import-reality-contract.mjs`:

```javascript
// Gate: professor import reality contract
// Tests a realistic Vivado-style nested project ZIP end-to-end.
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runIdeGate, assert } from './_gateHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip'
);

await runIdeGate('IDE professor import reality contract', async ({ page, baseUrl }) => {
  // ── 1. Navigate to Import mode ─────────────────────────────────────────
  await page.goto(`${baseUrl}ide`);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-import"]').click();
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 10000 });

  // ── 2. Upload nested Vivado ZIP fixture ────────────────────────────────
  const zipBytes = readFileSync(FIXTURE_PATH);
  const zipInput = page.locator('[data-testid="ide-import-zip-input"]');

  await zipInput.setInputFiles({
    name: '02-vivado-nested-andgate.zip',
    mimeType: 'application/zip',
    buffer: zipBytes,
  });

  // ── 3. Wait for inspection to render ──────────────────────────────────
  await page.waitForSelector('[data-testid="ide-import-zip-inspection"]', { timeout: 10000 });

  const topPath = await page
    .locator('[data-testid="ide-import-zip-top-path"]')
    .textContent()
    .catch(() => '');
  assert(
    topPath?.includes('sources_1/new/top.vhd'),
    `top path must point to sources_1/new/top.vhd, got "${topPath}"`
  );

  const xdcPath = await page
    .locator('[data-testid="ide-import-zip-xdc-path"]')
    .textContent()
    .catch(() => '');
  assert(
    xdcPath?.includes('constrs_1/new/basys3.xdc'),
    `xdc path must point to constrs_1/new/basys3.xdc, got "${xdcPath}"`
  );

  // ── 4. Parse HDL (auto-populated from ZIP) ────────────────────────────
  // ZIP inspection auto-parses; check parse summary
  await page.waitForSelector('[data-testid="ide-import-parse-summary"]', { timeout: 10000 });
  const parseSummary = await page
    .locator('[data-testid="ide-import-parse-summary"]')
    .textContent()
    .catch(() => '');
  assert(parseSummary && parseSummary.length > 0, 'parse summary must not be empty');

  // ── 5. Check ports table has at least 1 row ───────────────────────────
  const portRows = await page.locator('[data-testid="ide-import-ports-table"] tr').count();
  assert(portRows >= 2, `ports table must have header + ≥1 data row, got ${portRows} rows`);

  // ── 6. Blocking errors must be 0 ─────────────────────────────────────
  const errorText = await page
    .locator('[data-testid="ide-import-errors"]')
    .textContent()
    .catch(() => '0 blockers');
  assert(
    errorText?.includes('0 blocker') || !errorText?.includes('blocker'),
    `must have 0 blocking errors, got: "${errorText}"`
  );

  // ── 7. Apply to Project ───────────────────────────────────────────────
  const applyBtn = page.locator('[data-testid="ide-import-build-project"]');
  const applyDisabled = await applyBtn.getAttribute('disabled');
  assert(applyDisabled === null, 'Apply button must not be disabled when no blocking errors');
  await applyBtn.click();

  // Confirm dialog
  await page.waitForSelector('[data-testid="ide-import-apply-confirmation"]', { timeout: 5000 });
  await page.locator('[data-testid="ide-import-apply-confirm"]').click();

  // ── 8. Navigate to Design and confirm circuit loaded ──────────────────
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const nodeCount = await page.locator('[data-testid^="logic-node-"]').count();
  assert(nodeCount >= 2, `design must have ≥2 nodes (at least SW0+LD0), got ${nodeCount}`);

  // ── 9. Navigate to Project and confirm ioRows populated ──────────────
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const ioRows = await page
    .locator('[data-testid="ide-project-mapping-table"] tr')
    .count();
  assert(ioRows >= 4, `mapping table must have header + ≥3 rows (3 ports), got ${ioRows}`);
});
```

### Step 6: Build and run gate

```bash
pnpm --filter @redbyte/playground build
node scripts/gates/ide-professor-import-reality-contract.mjs
```
Expected: PASS

### Step 7: Commit

```bash
git add packages/rb-apps/src/import/hdlToCircuit.ts \
        packages/rb-apps/src/apps/ide/zipImport.ts \
        packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx \
        packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip \
        scripts/gates/ide-professor-import-reality-contract.mjs \
        scripts/build-professor-zip-fixture.mjs
git commit -m "fix(import): honest fallback for behavioural HDL + professor-import gate"
```

---

## Task 5 · Classroom Hardening — Kill Duplicates + Console Discipline

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx`

**Problems (each confirmed in screenshots):**

1. **Project surface duplicate strip:** "YOU ARE HERE: Project Setup" appears in BOTH the top guided strip AND inside the main panel header region. The inner one is a rendered `<h2>` or panel title. Remove the inner one — the top strip owns navigation context.

2. **Verify status shown twice:** "IDLE" pill appears in (a) panel header top-right and (b) VERIFICATION SUMMARY card. The summary card shows `Status | [IDLE pill]` which is correct. The panel header pill is redundant. Remove the panel header pill.

3. **Console shows intro text as "entries":** Export console shows "Diagnostics, build output, and jump-to-fix actions appear here while you work in this mode." This is static help text — it causes `consoleHasEntries` to be true, which expands the console to 88px. This intro text should NOT count as a console entry — it should only show when console height > collapsed threshold.

### Step 1: Remove inner panel heading from ProjectSurface

In `ProjectSurface.tsx`, find the section that renders the inner panel title like:
```tsx
<h2>Project Overview</h2>
```
or
```tsx
<IdePanel title="Project Overview" ...>
  <p>YOU ARE HERE: ...</p>
```

The `YOU ARE HERE` inner text is produced by the guided strip being copied into the panel. Find the exact duplicate and remove it. The guided strip component at the top renders the location context — the main panel should just say "Project Overview" without the location context.

Search for: `data-testid="ide-project-surface"` and look at what immediately follows — find any text that duplicates the top guided strip content and remove it.

### Step 2: Remove panel header pill from VerifySurface

In `VerifySurface.tsx`, find the `IdePanel` or `IdePanelHeader` component that has the status pill in the top-right corner of the Verify panel. This is separate from the VERIFICATION SUMMARY card's status pill.

Look for something like:
```tsx
right={<IdeStatusPill ...>{displayStatus}</IdeStatusPill>}
```
on the outer panel. The summary card already shows the status — remove the outer panel pill entirely.

### Step 3: Fix console intro text not counting as entries

In `IdeWorkbenchShell.tsx`, the console entry detection checks `consoleHasEntries`. The issue is the intro/help text renders as a child even when no diagnostic entries exist.

In each surface's console slot prop, the intro text like "Diagnostics, build output..." is passed as a static child with no `data-console-entry` attribute. Update the console height logic to count only elements with `data-console-entry` attribute, OR update each surface to only render that text inside a `data-console-intro` wrapper that explicitly excludes from entry count.

The cleanest fix: In `IdeWorkbenchShell.tsx`, update `consoleHasEntries`:

```typescript
// Instead of checking children count, check for data-console-entry elements
// The consoleRef already exists. After render, count entries:
const consoleHasEntries = useMemo(() => {
  // This is prop-driven — check if any console child has real entry content
  // consoleEntries prop is already passed to the shell
  return (consoleEntries?.length ?? 0) > 0;
}, [consoleEntries]);
```

This requires tracing exactly how `consoleHasEntries` is determined. Read lines 40-90 of `IdeWorkbenchShell.tsx` to find the current logic and update precisely.

### Step 4: Build and verify

```bash
pnpm --filter @redbyte/playground build
```

Visual check:
- Project surface: "YOU ARE HERE" appears only once (in top strip)
- Verify surface: Status pill appears only in Summary card, not in panel header
- Export surface: Console is collapsed (40px) on load when no blocking entries

### Step 5: Run affected gates

```bash
node scripts/gates/ide-shell-chrome-contract.mjs
node scripts/gates/ide-verify-contract.mjs
node scripts/gates/ide-project-readiness-contract.mjs
```
Expected: All PASS

### Step 6: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx \
        packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx \
        packages/rb-apps/src/apps/ide/components/IdeWorkbenchShell.tsx
git commit -m "fix(ide): classroom hardening — kill YOU-ARE-HERE dup, Verify status once, console discipline"
```

---

## Task 6 · Visual Authority — Remove Design Command Center, Waveform Empty State

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

**Problems (confirmed in screenshots):**

1. **Design Command Center panel:** A white/light-background panel at the top of the design canvas area titled "Design Command Center" with subtitle "Build your circuit with deterministic graph updates and explicit editing controls." This panel takes ~60px of vertical canvas height without adding lab-day value. The toolbar below it (Select Mode / Undo / Redo / etc.) is the real control surface. Remove the heading/subtitle panel.

2. **Waveform empty state:** Verify shows TWO dotted-border empty rectangles stacked vertically when no waveform data exists. These look like broken UI. Replace with a single centered empty state message.

3. **Right inspector sections all collapsed:** In Design, the right dock shows WORKSPACE METRICS, SIGNAL PROBE, SELECTION, NEXT ACTION, NET/PINS — all collapsed. The "Show/Hide" toggles make this feel like an accordion with no default-open section. Make LIVE SIMULATION default-open (it already is), and show SELECTION only when a node is selected.

### Step 1: Remove Design Command Center panel

In `DesignSurface.tsx`, find the panel/section that renders:
- Title: "Design Command Center"
- Subtitle: "Build your circuit with deterministic graph updates and explicit editing controls."

This is likely wrapped in an `IdePanel` component. Remove the title + subtitle wrapper, keeping only the toolbar content (Select/Undo/Redo/Wire buttons etc.) which should remain.

Search for `"Design Command Center"` or `"deterministic graph updates"` and remove the containing panel header element. The toolbar below it stays.

### Step 2: Replace double waveform empty rectangles with single centered state

In `VerifySurface.tsx`, the waveform viewer renders two placeholder areas when `signalTimeline.length === 0`. Find the two `className="ide-verify-waveform-*"` or similar empty renders and replace with:

```tsx
{signalTimeline.length === 0 && !hasNoTrace && (
  <div className="ide-verify-waveform-empty" data-testid="ide-verify-waveform-empty">
    <span>Run verification to see waveforms</span>
  </div>
)}
```

CSS in `ide-root.css`:
```css
.ide-verify-waveform-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--rb-text-3);
  font-size: var(--rb-font-size-1);
}
```

### Step 3: Make LIVE SIMULATION default-open in Design inspector

In `DesignSurface.tsx`, find where the right dock inspector sections are rendered. The `LIVE SIMULATION` section toggle state — change its initial `show` state from whatever it is to `true` (or ensure it defaults open). The `SELECTION` and `NET / PINS` sections should only render when a node is selected — they're already shown with "No node selected" text, but they can be hidden entirely when selection is empty to reduce accordion noise.

Find:
```tsx
<IdeInspectorSection title="SELECTION" ...>
  No node selected. Click a node to inspect type, id, and pins.
</IdeInspectorSection>
```
Change to only render when a node is selected:
```tsx
{selectedNodeId && (
  <IdeInspectorSection title="SELECTION" ...>
    ...
  </IdeInspectorSection>
)}
```

### Step 4: Build and check visually

```bash
pnpm --filter @redbyte/playground build
```

Run a quick visual smoke check by opening the preview:
```bash
pnpm --filter @redbyte/playground exec vite preview
```
Check:
- Design canvas fills full height — no "Design Command Center" header wasting space
- Verify idle state shows single clean empty message, not two dotted rectangles
- Design right dock shows simulation controls by default without clutter

### Step 5: Run gates

```bash
node scripts/gates/ide-design-build-contract.mjs
node scripts/gates/ide-verify-contract.mjs
node scripts/gates/ide-shell-chrome-contract.mjs
```
Expected: All PASS

### Step 6: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx \
        packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx \
        packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "fix(ide): visual authority — remove Design Command Center panel, waveform empty state"
```

---

## Task 7 · Freeze — Rebaseline + Rehearsal Checklist

**Files:**
- No code changes
- Update: screenshot baselines

### Step 1: Run full gate suite

Run all gates sequentially:

```bash
node scripts/gates/ide-bringup-contract.mjs &&
node scripts/gates/ide-design-build-contract.mjs &&
node scripts/gates/ide-design-live-sim-contract.mjs &&
node scripts/gates/ide-export-generates-hdl.mjs &&
node scripts/gates/ide-export-ready-contract.mjs &&
node scripts/gates/ide-layout-contract.mjs &&
node scripts/gates/ide-persistence-contract.mjs &&
node scripts/gates/ide-project-readiness-contract.mjs &&
node scripts/gates/ide-shell-chrome-contract.mjs &&
node scripts/gates/ide-shell-density-contract.mjs &&
node scripts/gates/ide-verify-contract.mjs &&
node scripts/gates/ide-verify-reality-contract.mjs &&
node scripts/gates/ide-verify-no-trace-guard-contract.mjs &&
node scripts/gates/ide-zip-import-contract.mjs &&
node scripts/gates/ide-professor-import-reality-contract.mjs &&
node scripts/gates/ide-zoom-presets-contract.mjs
```

All must PASS. Fix any failures before proceeding.

### Step 2: Screenshot rebaseline

```bash
pnpm ide:gate:screenshots:update
```
Expected: 7 tests pass.

### Step 3: Commit freeze

```bash
git add tests/e2e/ide-screenshot-baseline.spec.ts-snapshots/
git commit -m "test(gates): rebaseline screenshots after stabilization"
```

### Step 4: Rehearsal Checklist

Run this the day before lab. Every item must pass without hesitation.

**Import path (professor ZIP simulation):**
- [ ] Open IDE in fresh browser tab
- [ ] Navigate to Import
- [ ] Upload `02-vivado-nested-andgate.zip`
- [ ] Inspection shows `sources_1/new/top.vhd` and `constrs_1/new/basys3.xdc`
- [ ] Parse summary shows entity name + 3 ports
- [ ] 0 blocking errors
- [ ] Click "Apply to Project" → confirm
- [ ] Navigate to Project — mapping table shows 3 rows, all Mapped
- [ ] Navigate to Design — circuit shows SW0, SW1 → AND gate → LD0 (or equivalent)

**Core verify loop:**
- [ ] Example loaded (use "AND Gate Starter" from Project → example list)
- [ ] Navigate to Design → click Run → wait for tick > 30 → Pause
- [ ] Navigate to Verify → Generate Basics → click Run Verification
- [ ] Status shows PASS (or FAIL if logic wrong — but it must show one of them, not IDLE/BLOCKED)
- [ ] Waveform shows signals

**Export path:**
- [ ] After verify PASS: navigate to Export
- [ ] Export shows READY (not BLOCKED)
- [ ] Click "Download Vivado Pack" → ZIP downloads without error

**Hardware page:**
- [ ] Navigate to Hardware
- [ ] Checklist: Clock mapped = Ready, Output pins mapped = Ready
- [ ] Mapping summary shows all expected signals

**Visual sanity:**
- [ ] No duplicate "YOU ARE HERE" text visible
- [ ] Console is collapsed when viewing Export (no diagnostic entries)
- [ ] Design canvas fills full height without "Design Command Center" heading
- [ ] Verify idle shows clean single empty state

---

## Notes for Claude Executing This Plan

1. **Read before touching.** Before modifying any file, read it first. Do not guess at line numbers.

2. **Build after every source change.** `pnpm --filter @redbyte/playground build` is required before running any gate. Gates run against the pre-built dist.

3. **Unit tests first.** For `zipImport.ts` and `xdcImport.ts` changes, write the unit test BEFORE changing the implementation, verify it fails, then implement.

4. **ZipImportInspection is a public type.** Any field additions to it cascades to `ImportSurface.tsx` usage — check for all consumers after changing the interface.

5. **Gate PASS = truth.** Do not lower assertions to make gates pass. Make the code correct first, then run the gate.

6. **tmpclaude-* files.** These should not be committed. They are Claude session temp files. Add `tmpclaude-*` to `.gitignore` before committing anything.

7. **Commit order matters.** Each commit is independent and must not break the previous gate. Follow the order.

8. **The professor-import gate** requires an actual binary ZIP fixture file to be committed. Run `node scripts/build-professor-zip-fixture.mjs` first to generate it.
