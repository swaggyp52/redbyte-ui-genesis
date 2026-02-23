# Phase 34 — Import Trust & Trace

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Import surface trustworthy enough for students submitting lab work — top-module chooser, click-to-fix diagnostics, ZIP contents chooser, schematic preview, and one-click Import → Verify wiring.

**Architecture:** Five discrete additions to `ImportSurface.tsx`, two small parser exports, one zipImport helper, and a CSS block. No new files. Follows the same "five tasks, five commits" cadence as Phase 33. All three individual parse buttons are kept; new features layer on top without rearranging existing structure.

**Tech Stack:** React 18, TypeScript strict, existing primitives: `IdeButton`, `IdeStatusPill`, `IdeCallout`, `IdeDataTable`. SVG/HTML for schematic preview (inline, no new deps).

---

## Context: What Exists After Phase 33

`ImportSurface.tsx` (~1838 lines) has:

- **State:** `parsedHdl`, `xdcResult`, `zipInspection`, `mapping`, `pipelineSteps/Active`, `pendingApplyProject`, `overrides`, `activeWarningLine`
- **Refs:** `hdlTextareaRef`, `hdlGutterRef` (HDL editor gutter), `zipInputRef`
- **Handlers:** `parseHdl()`, `parseXdc()`, `buildCurrentProject()`, `handleProcessDesign()`, `confirmApplyProject()`, `requestApplyProject()`
- **XDC editor:** plain `<textarea className="ide-import-textarea">` with no gutter — needs upgrade in Task 2
- **Preview Schematic:** renders `<div className="ide-waveform-stub">` with 4 empty `<span>` elements — replaced in Task 4
- **Props:** `onImportProject?`, `projectIoRows?`, `onApplySuggestions?`, `onGoToProject?`

**Parser facts:**
- `parseVhdl(source)` — `src.match(/entity\s+(\w+)\s+is\s+port\s*\(...)` — no `g` flag, stops at first entity
- `parseVerilog(source)` — `src.match(/module\s+(\w+)\s*...)` — no `g` flag, stops at first module
- `ParsedHDL` has: `entityName`, `ports[]` (each: `name`, `direction`, `typeName`), `instances[]` (each: `id`, `componentType`, `portMap`), `lang`, `warnings[]` (each: `message`, `line?`)
- `XdcPinEntry` has: `{ packagePin: string; confidence: 'strong' | 'weak' }` — **no line numbers**
- `XdcParseResult.pinEntries: Record<string, XdcPinEntry>` — already indexed by portName

**XDC parser detail (important for Task 2):**
`parseXdcPins` joins all non-comment lines into a single normalized string before regex matching — line info is lost at that point. The fix is a **pre-scan** on the raw lines before normalization.

**ZIP inspector facts:**
- `ZipImportInspection` has: `hdlCandidates: string[]` (all HDL files, best first), `xdcCandidates: string[]`, `detectedTopPath`, `detectedXdcPath`
- `importVivadoZipBytes(bytes, options?)` is the internal function — needs `overrideTopPath` / `overrideXdcPath` options
- The File object is NOT stored in state currently

**IdeApp navigation pattern (established):**
```typescript
// HardwareSurface has onOpenVerify?: () => void wired as:
onOpenVerify={() => setCurrentMode('verify')}
// ImportSurface needs the same pattern for onGoToVerify
```

**Vector flow:**
- `RBProject.vectors?: TestVector[]` exists in projectFormat.ts
- `loadFromProject(project)` in projectRuntime.ts reads `project.vectors ?? []` into Zustand state
- VerifySurface receives `vectors={projectVectors}` from IdeApp — no special injection needed
- `TestVector = { tick: number; inputs: Record<nodeId, 0|1>; expected: Record<nodeId, 0|1> }`
- Circuit nodes: `project.circuit.nodes.filter(n => n.type === 'INPUT')` gives input nodes with `.id: string`

---

## Task 1: Multi-entity/module detection + top chooser

**What:** When HDL source has multiple entities (VHDL) or modules (Verilog), show a dropdown above the code editor so the user can pick which to parse. The auto-pick rule is shown inline. Selecting a different entity re-parses with the correct block.

**Files:**
- Modify: `packages/rb-apps/src/import/vhdlImport.ts`
- Modify: `packages/rb-apps/src/import/verilogImport.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Add `scanVhdlEntities` export to vhdlImport.ts

Add **after** the existing `export function parseVhdl` block:

```typescript
/**
 * Returns all entity names found in the VHDL source (in order of appearance).
 * Does not parse ports — use parseVhdl() after selecting the desired entity.
 */
export function scanVhdlEntities(source: string): string[] {
  const rx = /entity\s+(\w+)\s+is\s+port\s*\(/gi;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source)) !== null) {
    names.push(m[1]);
  }
  return names;
}
```

### Step 2: Add `scanVerilogModules` export to verilogImport.ts

Add **after** the existing `export function parseVerilog` block:

```typescript
/**
 * Returns all module names found in the Verilog source (in order of appearance).
 * Does not parse ports — use parseVerilog() after selecting the desired module.
 */
export function scanVerilogModules(source: string): string[] {
  const rx = /\bmodule\s+(\w+)\s*(?:#\s*\([^)]*\))?\s*\(/gi;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source)) !== null) {
    names.push(m[1]);
  }
  return names;
}
```

### Step 3: Add imports to ImportSurface.tsx

At the top of the file, add to the existing vhdlImport and verilogImport import lines:

```typescript
import { parseVhdl, scanVhdlEntities } from '../../../import/vhdlImport';
import { parseVerilog, scanVerilogModules } from '../../../import/verilogImport';
```

(The existing import lines only have `parseVhdl` and `parseVerilog` — add the scan functions.)

### Step 4: Add entity chooser state in ImportSurface component

After the `const [activeWarningLine, setActiveWarningLine] = useState<number | null>(null);` line, add:

```typescript
// Phase 34: entity chooser
const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);
```

### Step 5: Add `detectedEntityNames` useMemo

After the `const lineCount = useMemo(...)` declaration, add:

```typescript
const detectedEntityNames = useMemo((): string[] => {
  const source = hdlText.trim();
  if (!source) return [];
  const effectiveLang = language === 'auto' ? detectHdlLanguage(source) : language;
  return effectiveLang === 'vhdl' ? scanVhdlEntities(source) : scanVerilogModules(source);
}, [hdlText, language]);
```

### Step 6: Make `parseHdl` entity-aware

In the existing `parseHdl` useCallback, find this block:

```typescript
const effectiveLang =
  language === 'auto' ? detectHdlLanguage(source) : (language as 'vhdl' | 'verilog');
const parsed = effectiveLang === 'vhdl' ? parseVhdl(source) : parseVerilog(source);
```

Replace with:

```typescript
const effectiveLang =
  language === 'auto' ? detectHdlLanguage(source) : (language as 'vhdl' | 'verilog');

// If multiple entities detected and the user selected a specific one, slice the source.
// parseVhdl/parseVerilog always take the first entity — so we extract just the chosen block.
let parseSource = source;
if (selectedEntityName && detectedEntityNames.length > 1) {
  const sliceRx =
    effectiveLang === 'vhdl'
      ? new RegExp(
          `entity\\s+${selectedEntityName}\\s+is[\\s\\S]*?end\\s+(?:entity\\s+)?(?:${selectedEntityName}\\s*)?;`,
          'i'
        )
      : new RegExp(
          `\\bmodule\\s+${selectedEntityName}\\b[\\s\\S]*?endmodule`,
          'i'
        );
  const sliceMatch = source.match(sliceRx);
  if (sliceMatch) parseSource = sliceMatch[0];
}
const parsed = effectiveLang === 'vhdl' ? parseVhdl(parseSource) : parseVerilog(parseSource);
```

Also add `detectedEntityNames` and `selectedEntityName` to the `useCallback` deps array:
```typescript
}, [hdlText, language, selectedEntityName, detectedEntityNames]);
```

### Step 7: Apply same entity-aware change inside `handleProcessDesign`

In `handleProcessDesign`, find the identical `effectiveLang` + `parsed` block inside the `parse-hdl` step and apply the same replacement (copy from Step 6). Add `selectedEntityName` and `detectedEntityNames` to the `handleProcessDesign` useCallback deps array.

### Step 8: Add the entity chooser UI

In the JSX, inside the `{tab === 'hdl' && (` block, find the `<div className="ide-import-language-row">` language selector. Insert immediately **after** that closing `</div>` and **before** `<div className="ide-code-editor">`:

```tsx
{detectedEntityNames.length >= 2 && (
  <div className="ide-import-entity-chooser" data-testid="ide-import-entity-chooser">
    <span className="ide-import-entity-chooser-label">Top Entity</span>
    <select
      className="ide-export-pin-input"
      value={selectedEntityName ?? detectedEntityNames[0]}
      onChange={(e) => setSelectedEntityName(e.target.value)}
      data-testid="ide-import-entity-select"
    >
      {detectedEntityNames.map((name) => (
        <option key={name} value={name}>{name}</option>
      ))}
    </select>
    <span className="ide-import-entity-chooser-hint" data-testid="ide-import-entity-hint">
      {(selectedEntityName ?? detectedEntityNames[0]) === detectedEntityNames[0]
        ? 'Auto-selected: first entity'
        : 'User selected'}
    </span>
  </div>
)}
```

### Step 9: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep -E "ImportSurface|vhdlImport|verilogImport"
```

Expected: no errors.

### Step 10: Commit

```bash
git add packages/rb-apps/src/import/vhdlImport.ts packages/rb-apps/src/import/verilogImport.ts packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "$(cat <<'EOF'
feat(import): multi-entity/module detection + top chooser

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: XDC line tracking + click-to-fix diagnostics + XDC gutter editor

**What:**
1. Add line numbers to `XdcPinEntry` (via a pre-scan on the raw XDC text — the current parser joins lines before parsing, losing offsets)
2. Upgrade the XDC textarea to have a line gutter (same pattern as HDL editor)
3. Make ORPHAN diagnostic rows show a clickable "Ln X" button that scrolls + highlights the XDC editor

**Files:**
- Modify: `packages/rb-apps/src/import/xdcImport.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Extend `XdcPinEntry` type in xdcImport.ts

Find the existing interface:

```typescript
export interface XdcPinEntry {
  packagePin: string;
  confidence: PinConfidence;
}
```

Replace with:

```typescript
export interface XdcPinEntry {
  packagePin: string;
  confidence: PinConfidence;
  line?: number; // 1-based line number of the set_property statement in the original XDC source
}
```

### Step 2: Add `scanXdcLineNumbers` helper in xdcImport.ts

Add this pure function **before** `parseXdcPins`:

```typescript
/**
 * Pre-scans the raw XDC source line-by-line and returns a map of
 * portName → 1-based line number for each set_property PACKAGE_PIN statement.
 * This runs on the original text (before normalization) so line offsets are preserved.
 */
function scanXdcLineNumbers(xdcText: string): Record<string, number> {
  const lineByPort: Record<string, number> = {};
  const lines = xdcText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    // Pattern 1: set_property PACKAGE_PIN V17 [get_ports {portName}]
    const direct = /set_property\s+PACKAGE_PIN\s+\S+\s+\[get_ports\s*(\{[^}]*\}|\S+)\s*\]/i.exec(line);
    if (direct) {
      const portName = direct[1].replace(/[{}\s]/g, '');
      if (portName) lineByPort[portName] = i + 1;
    }
    // Pattern 2: set_property -dict { PACKAGE_PIN ... } [get_ports {portName}]
    const dictMatch = /set_property\s+-dict\s+\{[^}]*\}\s+\[get_ports\s*(\{[^}]*\}|\S+)\s*\]/i.exec(line);
    if (dictMatch) {
      const portName = dictMatch[1].replace(/[{}\s]/g, '');
      if (portName) lineByPort[portName] = i + 1;
    }
  }
  return lineByPort;
}
```

### Step 3: Use line numbers in `parseXdcPins`

In `parseXdcPins`, at the **top of the function body** (before the `normalized` computation), add:

```typescript
const lineByPort = scanXdcLineNumbers(xdcText);
```

Then find the `upsertPin` inner function:

```typescript
const upsertPin = (rawPin: string, rawPortToken: string) => {
  const pin = normalizeBasys3PinAlias(rawPin);
  const portName = normalizePortToken(rawPortToken);
  if (portName.length === 0 || pin.length === 0) return;

  maybePushUnsupportedPinWarning(warnings, pin);
  pinMap[portName] = pin;
  const confidence: PinConfidence = BASYS3_ALLOWED_PACKAGE_PINS.has(pin) ? 'strong' : 'weak';
  pinEntries[portName] = { packagePin: pin, confidence };
};
```

Change the last line of `upsertPin` to attach the line number:

```typescript
  pinEntries[portName] = { packagePin: pin, confidence, line: lineByPort[portName] };
```

### Step 4: Add XDC editor refs and state in ImportSurface.tsx

After the existing `const hdlGutterRef = useRef<HTMLDivElement | null>(null);` line, add:

```typescript
const xdcTextareaRef = useRef<HTMLTextAreaElement | null>(null);
const xdcGutterRef = useRef<HTMLDivElement | null>(null);
const [activeXdcWarningLine, setActiveXdcWarningLine] = useState<number | null>(null);
```

### Step 5: Add `xdcLineCount` computed value

After the existing `const lineCount = useMemo(...)` declaration, add:

```typescript
const xdcLineCount = useMemo(() => Math.max(1, xdcText.split('\n').length), [xdcText]);
```

### Step 6: Add XDC scroll sync and jump handlers

After the existing `handleHdlScroll` useCallback, add:

```typescript
const handleXdcScroll = useCallback(() => {
  const ta = xdcTextareaRef.current;
  const gutter = xdcGutterRef.current;
  if (!ta || !gutter) return;
  gutter.scrollTop = ta.scrollTop;
}, []);
```

After the existing `scrollToLine` useCallback, add:

```typescript
const scrollToXdcLine = useCallback((line: number) => {
  const ta = xdcTextareaRef.current;
  if (!ta) return;
  const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18;
  ta.scrollTop = Math.max(0, (line - 1) * lineHeight - ta.clientHeight / 3);
  setActiveXdcWarningLine(line);
}, []);
```

### Step 7: Add clearXdcHighlight effect

After the existing `useEffect` for `activeWarningLine` (the one that clears after 1200ms), add:

```typescript
useEffect(() => {
  if (!activeXdcWarningLine) return;
  const t = window.setTimeout(() => setActiveXdcWarningLine(null), 1200);
  return () => window.clearTimeout(t);
}, [activeXdcWarningLine]);
```

### Step 8: Replace plain XDC textarea with gutter editor

Find the `{tab === 'xdc' && (` block, which currently renders:

```tsx
{tab === 'xdc' && (
  <div className="ide-import-editor">
    <textarea
      className="ide-import-textarea"
      value={xdcText}
      onChange={(event) => setXdcText(event.target.value)}
      placeholder="Paste XDC constraints here."
      spellCheck={false}
      data-testid="ide-import-xdc-input"
    />
  </div>
)}
```

Replace with:

```tsx
{tab === 'xdc' && (
  <div className="ide-import-editor">
    <div className="ide-code-editor" data-testid="ide-import-xdc-editor">
      <div
        className="ide-code-gutter"
        aria-hidden="true"
        ref={xdcGutterRef}
      >
        {Array.from({ length: xdcLineCount }, (_, i) => {
          const lineNum = i + 1;
          return (
            <span
              key={lineNum}
              className={`ide-code-gutter-line${
                activeXdcWarningLine === lineNum ? ' ide-code-gutter-line--warn' : ''
              }`}
            >
              {lineNum}
            </span>
          );
        })}
      </div>
      <textarea
        ref={xdcTextareaRef}
        className="ide-code-textarea"
        data-testid="ide-import-xdc-input"
        value={xdcText}
        onChange={(event) => setXdcText(event.target.value)}
        onScroll={handleXdcScroll}
        placeholder="Paste XDC constraints here."
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />
    </div>
  </div>
)}
```

### Step 9: Make ORPHAN diagnostic rows clickable

In the XDC Coverage section, find the ORPHAN row render:

```tsx
<div key={key} className="ide-import-xdc-gap-row ide-import-xdc-gap-row--orphan">
  <IdeStatusPill tone="warn">ORPHAN</IdeStatusPill>
  <code className="ide-import-xdc-gap-port">{key}</code>
  <span className="ide-import-xdc-gap-dir">→ {xdcResult!.pinMap[key]}</span>
  <span className="ide-import-xdc-gap-hint">In XDC but not in HDL</span>
</div>
```

Replace with:

```tsx
<div key={key} className="ide-import-xdc-gap-row ide-import-xdc-gap-row--orphan">
  <IdeStatusPill tone="warn">ORPHAN</IdeStatusPill>
  <code className="ide-import-xdc-gap-port">{key}</code>
  <span className="ide-import-xdc-gap-dir">→ {xdcResult!.pinMap[key]}</span>
  {xdcResult!.pinEntries[key]?.line != null ? (
    <button
      type="button"
      className="ide-warning-jump"
      onClick={() => { setTab('xdc'); scrollToXdcLine(xdcResult!.pinEntries[key]!.line!); }}
      title={`Jump to XDC line ${xdcResult!.pinEntries[key]!.line}`}
      data-testid={`ide-import-xdc-jump-${key}`}
    >
      Ln {xdcResult!.pinEntries[key]!.line}
    </button>
  ) : (
    <span className="ide-import-xdc-gap-hint">In XDC but not in HDL</span>
  )}
</div>
```

### Step 10: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep -E "ImportSurface|xdcImport"
```

Expected: no errors.

### Step 11: Commit

```bash
git add packages/rb-apps/src/import/xdcImport.ts packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "$(cat <<'EOF'
feat(import): XDC line tracking + click-to-fix orphan diagnostics + XDC gutter editor

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ZIP contents chooser with selection rationale

**What:** When a ZIP is loaded, show the `hdlCandidates` and `xdcCandidates` arrays as radio-button selectors instead of static text. An "auto" badge marks the auto-selected file. A "Re-extract with selection" button re-runs the import with the user's override. The original `File` object is kept in a ref for re-extraction.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/zipImport.ts`
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Extend `importVivadoZipBytes` options in zipImport.ts

Find the function signature:

```typescript
export async function importVivadoZipBytes(
  bytes: Uint8Array,
  options?: { sourceName?: string }
): Promise<ZipImportInspection>
```

Replace with:

```typescript
export async function importVivadoZipBytes(
  bytes: Uint8Array,
  options?: {
    sourceName?: string;
    overrideTopPath?: string;
    overrideXdcPath?: string | null;
  }
): Promise<ZipImportInspection>
```

Inside the function body, find where the top HDL and XDC paths are chosen (the lines that set `const topPath = hdlCandidates[0]` and `const xdcPath = xdcCandidates[0]` or similar). Apply the override logic there:

```typescript
// Use caller-specified overrides if provided; otherwise use auto-scored candidates
const topPath = options?.overrideTopPath ?? hdlCandidates[0];
const xdcPath =
  options?.overrideXdcPath !== undefined
    ? (options.overrideXdcPath ?? undefined)   // null → explicit "no XDC"
    : (xdcCandidates[0] ?? undefined);
```

(Exact variable names may differ — adapt to match the existing code's actual naming.)

### Step 2: Add `reimportZipWithCandidates` export to zipImport.ts

Add **after** `importVivadoZipFile`:

```typescript
/**
 * Re-runs ZIP inspection using caller-specified HDL and XDC paths.
 * Used when the user overrides the auto-selected candidates in the UI.
 */
export async function reimportZipWithCandidates(
  file: File,
  hdlPath: string,
  xdcPath: string | null
): Promise<ZipImportInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importVivadoZipBytes(bytes, {
    sourceName: file.name,
    overrideTopPath: hdlPath,
    overrideXdcPath: xdcPath,
  });
}
```

### Step 3: Update the import line in ImportSurface.tsx

Find the zipImport import at the top of the file:

```typescript
import {
  buildImportedProject,
  importVivadoZipFile,
  type ZipImportInspection,
} from '../zipImport';
```

Replace with:

```typescript
import {
  buildImportedProject,
  importVivadoZipFile,
  reimportZipWithCandidates,
  type ZipImportInspection,
} from '../zipImport';
```

### Step 4: Add ZIP chooser state and file ref in ImportSurface

After `const zipInputRef = useRef<HTMLInputElement | null>(null);`, add:

```typescript
const zipFileRef = useRef<File | null>(null);
const [selectedZipHdl, setSelectedZipHdl] = useState<string | null>(null);
const [selectedZipXdc, setSelectedZipXdc] = useState<string | null>(null);
```

### Step 5: Store file ref and initialize candidate state in `handleZipFile`

In the `handleZipFile` async function, add one line immediately before `setZipBusy(true)`:

```typescript
zipFileRef.current = file;
```

And after `setZipInspection(inspection)`, add:

```typescript
setSelectedZipHdl(inspection.detectedTopPath);
setSelectedZipXdc(inspection.detectedXdcPath ?? null);
```

### Step 6: Add `handleReextractZip` handler

After `handleZipFile`, add:

```typescript
const handleReextractZip = async () => {
  const file = zipFileRef.current;
  if (!file || !selectedZipHdl) return;
  setZipBusy(true);
  setPendingApplyProject(null);
  try {
    const inspection = await reimportZipWithCandidates(file, selectedZipHdl, selectedZipXdc);
    setZipInspection(inspection);
    setParsedHdl(inspection.parsedHdl);
    const topSource = inspection.project.hdl?.sources?.[0]?.text ?? '';
    setHdlText(topSource);
    const constraintsText = inspection.project.fpga?.constraints?.text ?? '';
    setXdcText(constraintsText);
    setXdcResult(inspection.xdcResult ?? null);
    setMapping(buildMappingRecord(inspection.project));
    setStatusMessage(
      `Re-extracted: ${selectedZipHdl}${selectedZipXdc ? ` + ${selectedZipXdc}` : ' (no XDC)'}`
    );
  } catch (err) {
    setStatusMessage(
      `Re-extract failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  } finally {
    setZipBusy(false);
  }
};
```

### Step 7: Replace the KV rows in ZIP Inspection section

In the `{zipInspection ? (` block inside `tab === 'upload'`, find these three KV rows:

```tsx
<div className="ide-kv-row">
  <span>Top HDL</span>
  <code data-testid="ide-import-zip-top-path">{zipInspection.detectedTopPath}</code>
</div>
<div className="ide-kv-row">
  <span>Language</span>
  <span data-testid="ide-import-zip-top-language">
    {zipInspection.detectedTopLanguage.toUpperCase()}
  </span>
</div>
<div className="ide-kv-row">
  <span>XDC</span>
  <code data-testid="ide-import-zip-xdc-path">
    {zipInspection.detectedXdcPath ?? 'not found'}
  </code>
</div>
```

Replace with:

```tsx
<div className="ide-kv-row ide-kv-row--tall">
  <span>HDL&nbsp;Source</span>
  <div className="ide-zip-candidate-list" data-testid="ide-import-zip-hdl-candidates">
    {zipInspection.hdlCandidates.slice(0, 6).map((path) => (
      <label key={path} className="ide-zip-candidate-row">
        <input
          type="radio"
          name="zip-hdl-candidate"
          value={path}
          checked={selectedZipHdl === path}
          onChange={() => setSelectedZipHdl(path)}
        />
        <code className="ide-zip-candidate-path" data-testid="ide-import-zip-top-path">
          {path.split('/').pop() ?? path}
        </code>
        {path === zipInspection.detectedTopPath && (
          <span className="ide-zip-candidate-auto">auto</span>
        )}
      </label>
    ))}
  </div>
</div>
<div className="ide-kv-row ide-kv-row--tall">
  <span>XDC</span>
  <div className="ide-zip-candidate-list" data-testid="ide-import-zip-xdc-candidates">
    <label className="ide-zip-candidate-row">
      <input
        type="radio"
        name="zip-xdc-candidate"
        value=""
        checked={selectedZipXdc === null}
        onChange={() => setSelectedZipXdc(null)}
      />
      <code className="ide-zip-candidate-path">— none</code>
    </label>
    {zipInspection.xdcCandidates.slice(0, 4).map((path) => (
      <label key={path} className="ide-zip-candidate-row">
        <input
          type="radio"
          name="zip-xdc-candidate"
          value={path}
          checked={selectedZipXdc === path}
          onChange={() => setSelectedZipXdc(path)}
        />
        <code className="ide-zip-candidate-path" data-testid="ide-import-zip-xdc-path">
          {path.split('/').pop() ?? path}
        </code>
        {path === zipInspection.detectedXdcPath && (
          <span className="ide-zip-candidate-auto">auto</span>
        )}
      </label>
    ))}
  </div>
</div>
{(selectedZipHdl !== zipInspection.detectedTopPath ||
  selectedZipXdc !== (zipInspection.detectedXdcPath ?? null)) && (
  <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
    <IdeButton
      tone="secondary"
      onClick={() => void handleReextractZip()}
      disabled={zipBusy || !selectedZipHdl}
      testId="ide-import-zip-reextract"
    >
      {zipBusy ? 'Extracting…' : 'Re-extract with selection'}
    </IdeButton>
  </div>
)}
```

### Step 8: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep -E "ImportSurface|zipImport"
```

Expected: no errors. If `overrideXdcPath?: string | null` causes issues, check the existing `importVivadoZipBytes` internal logic for how it uses `xdcPath` and ensure null is handled (null = explicit "no XDC").

### Step 9: Commit

```bash
git add packages/rb-apps/src/apps/ide/zipImport.ts packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "$(cat <<'EOF'
feat(import): ZIP contents chooser with candidate rationale + re-extract

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Tier-1 schematic preview (IO front panel + instance stubs)

**What:** Replace the empty `ide-waveform-stub` in the "Preview Schematic" section with an always-rendered IO front panel: inputs left column, "TOP: entityName" center box, outputs right column. If `parsedHdl.instances.length > 0`, show component instance stubs below. Plus all Phase 34 CSS.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css`

---

### Step 1: Add `ImportSchematicPreview` inline component

Add this function at the bottom of `ImportSurface.tsx`, **after** `buildMappingRecord` and **before** the end of the file:

```tsx
interface SchematicPreviewProps {
  parsedHdl: ParsedHDL | null;
}

function ImportSchematicPreview({ parsedHdl }: SchematicPreviewProps) {
  if (!parsedHdl) {
    return (
      <div className="ide-import-schematic-empty" data-testid="ide-import-schematic-empty">
        <span>Parse HDL to see schematic preview.</span>
      </div>
    );
  }

  const inputs = parsedHdl.ports.filter((p) => p.direction === 'in');
  const outputs = parsedHdl.ports.filter((p) => p.direction === 'out');

  return (
    <div className="ide-import-schematic" data-testid="ide-import-schematic">
      {/* IO Front Panel */}
      <div className="ide-import-schematic-panel">
        {/* Left: inputs */}
        <div className="ide-import-schematic-col ide-import-schematic-col--in">
          {inputs.length > 0 ? (
            inputs.map((p) => (
              <div
                key={p.name}
                className="ide-import-schematic-port ide-import-schematic-port--in"
                data-testid={`ide-import-schematic-port-${p.name}`}
              >
                <span className="ide-import-schematic-port-name">{p.name}</span>
                <span className="ide-import-schematic-port-dir">→</span>
              </div>
            ))
          ) : (
            <span className="ide-import-schematic-port-empty">no inputs</span>
          )}
        </div>

        {/* Center: TOP block */}
        <div className="ide-import-schematic-top" data-testid="ide-import-schematic-top">
          <span className="ide-import-schematic-top-label">TOP</span>
          <strong className="ide-import-schematic-top-name">{parsedHdl.entityName}</strong>
          <span className="ide-import-schematic-top-lang">{parsedHdl.lang.toUpperCase()}</span>
        </div>

        {/* Right: outputs */}
        <div className="ide-import-schematic-col ide-import-schematic-col--out">
          {outputs.length > 0 ? (
            outputs.map((p) => (
              <div
                key={p.name}
                className="ide-import-schematic-port ide-import-schematic-port--out"
                data-testid={`ide-import-schematic-port-${p.name}`}
              >
                <span className="ide-import-schematic-port-dir">←</span>
                <span className="ide-import-schematic-port-name">{p.name}</span>
              </div>
            ))
          ) : (
            <span className="ide-import-schematic-port-empty">no outputs</span>
          )}
        </div>
      </div>

      {/* Instance stubs — shown when structural HDL has sub-components */}
      {parsedHdl.instances.length > 0 && (
        <div className="ide-import-schematic-instances" data-testid="ide-import-schematic-instances">
          {parsedHdl.instances.slice(0, 8).map((inst) => (
            <div
              key={inst.id}
              className="ide-import-schematic-inst"
              data-testid={`ide-import-schematic-inst-${inst.id}`}
            >
              <span className="ide-import-schematic-inst-type">{inst.componentType}</span>
              <span className="ide-import-schematic-inst-id">{inst.id}</span>
            </div>
          ))}
          {parsedHdl.instances.length > 8 && (
            <div className="ide-import-schematic-inst ide-import-schematic-inst--more">
              +{parsedHdl.instances.length - 8} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Note: `ParsedHDL` is already imported (used by `parsedHdl` state). If TypeScript can't find the type reference in the inline component signature, add `import type { ParsedHDL } from '../../../import/hdlToCircuit';` at the top alongside the existing hdlToCircuit import.

### Step 2: Replace the "Preview Schematic" section

Find:

```tsx
<section className="ide-export-section">
  <IdeSectionHeader title="Preview Schematic" meta="v1 preview" />
  <div className="ide-waveform-stub" data-testid="ide-import-schematic-preview">
    <span />
    <span />
    <span />
    <span />
  </div>
</section>
```

Replace with:

```tsx
<section className="ide-export-section">
  <IdeSectionHeader
    title="Schematic Preview"
    meta={parsedHdl ? `${parsedHdl.instances.length} instance${parsedHdl.instances.length !== 1 ? 's' : ''}` : 'v1'}
  />
  <ImportSchematicPreview parsedHdl={parsedHdl} />
</section>
```

### Step 3: Append Phase 34 CSS to ide-root.css

Append the following block at EOF of `packages/rb-apps/src/apps/ide/ide-root.css` (after the Phase 33 section):

```css
/* ═══════════════════════════════════════════════════════════════════════════
   Phase 34 — Import Trust & Trace
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── 34A: Entity chooser ──────────────────────────────────────────────── */
.ide-import-entity-chooser {
  display: flex;
  align-items: center;
  gap: var(--ide-space-2);
  padding: var(--ide-space-1) var(--ide-space-2);
  background: rgba(56, 189, 248, 0.05);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: var(--ide-radius);
  margin-bottom: var(--ide-space-2);
}
.ide-import-entity-chooser-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--ide-text-soft);
  flex-shrink: 0;
}
.ide-import-entity-chooser-hint {
  font-size: 10px;
  color: var(--ide-text-muted);
  font-style: italic;
}

/* ─── 34B: ZIP candidate chooser ──────────────────────────────────────── */
.ide-zip-candidate-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ide-zip-candidate-row {
  display: flex;
  align-items: center;
  gap: var(--ide-space-1);
  cursor: pointer;
  font-size: 11px;
}
.ide-zip-candidate-row input[type="radio"] {
  cursor: pointer;
  flex-shrink: 0;
}
.ide-zip-candidate-path {
  font-size: 10px;
  color: var(--ide-text-soft);
}
.ide-zip-candidate-auto {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(56, 189, 248, 0.75);
  background: rgba(56, 189, 248, 0.12);
  border-radius: 3px;
  padding: 1px 4px;
}
.ide-kv-row--tall {
  align-items: flex-start;
  padding-top: var(--ide-space-1);
}

/* ─── 34C: Schematic preview ───────────────────────────────────────────── */
.ide-import-schematic-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  color: var(--ide-text-muted);
  font-size: 11px;
  font-style: italic;
  border: 1px dashed color-mix(in srgb, var(--ide-border) 60%, transparent);
  border-radius: var(--ide-radius);
}

.ide-import-schematic {
  display: flex;
  flex-direction: column;
  gap: var(--ide-space-2);
}

.ide-import-schematic-panel {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--ide-space-2);
  align-items: center;
  min-height: 80px;
  padding: var(--ide-space-2);
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius);
  background: rgba(255, 255, 255, 0.015);
}

.ide-import-schematic-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ide-import-schematic-col--in  { align-items: flex-end; }
.ide-import-schematic-col--out { align-items: flex-start; }

.ide-import-schematic-port {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-family: var(--rb-font-mono, monospace);
  color: var(--ide-text-soft);
}
.ide-import-schematic-port--in  { flex-direction: row; }
.ide-import-schematic-port--out { flex-direction: row-reverse; }
.ide-import-schematic-port-dir  { color: var(--ide-text-muted); font-size: 9px; }
.ide-import-schematic-port-empty {
  font-size: 10px;
  color: var(--ide-text-muted);
  font-style: italic;
}

.ide-import-schematic-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--ide-space-2) var(--ide-space-3);
  border: 1.5px solid rgba(56, 189, 248, 0.4);
  border-radius: var(--ide-radius);
  background: rgba(56, 189, 248, 0.05);
  min-width: 80px;
}
.ide-import-schematic-top-label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(56, 189, 248, 0.6);
  text-transform: uppercase;
}
.ide-import-schematic-top-name {
  font-family: var(--rb-font-mono, monospace);
  font-size: 12px;
  color: var(--ide-text);
  text-align: center;
  word-break: break-all;
}
.ide-import-schematic-top-lang {
  font-size: 8px;
  color: var(--ide-text-muted);
  letter-spacing: 0.06em;
}

.ide-import-schematic-instances {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ide-import-schematic-inst {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--ide-border);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.025);
  font-size: 9px;
  font-family: var(--rb-font-mono, monospace);
  gap: 1px;
}
.ide-import-schematic-inst-type { color: var(--ide-text-soft); font-weight: 600; }
.ide-import-schematic-inst-id   { color: var(--ide-text-muted); }
.ide-import-schematic-inst--more {
  color: var(--ide-text-muted);
  font-style: italic;
  align-self: center;
}

/* ─── 34D: Import → Verify CTA ─────────────────────────────────────────── */
.ide-import-verify-cta {
  display: flex;
  align-items: center;
  gap: var(--ide-space-2);
  padding: var(--ide-space-2) var(--ide-space-3);
  background: rgba(74, 222, 128, 0.05);
  border: 1px solid rgba(74, 222, 128, 0.25);
  border-radius: var(--ide-radius);
  flex: 1;
}
.ide-import-verify-cta-label {
  font-size: 11px;
  color: var(--ide-text-soft);
  flex: 1;
}
```

### Step 4: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep -E "ImportSurface"
```

Expected: no errors.

### Step 5: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "$(cat <<'EOF'
feat(import): Tier-1 schematic preview (IO front panel + instance stubs) + Phase 34 CSS

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Import → Verify CTA + baseline vector generation

**What:** After the Build pipeline step succeeds, generate baseline test vectors from the imported circuit structure and store them on the pending project. Add `onGoToVerify` prop. Show a "Confirm & Open Verify →" CTA in the commit preview. Wire the prop in IdeApp.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`
- Modify: `packages/rb-apps/src/apps/IdeApp.tsx`

---

### Step 1: Add `onGoToVerify` to `ImportSurfaceProps`

Find the props interface:

```typescript
export interface ImportSurfaceProps {
  onImportProject?: (project: RBProject) => void;
  projectIoRows?: IdeExampleIoRow[];
  onApplySuggestions?: (items: Array<{ rowId: string; pin: string }>) => void;
  onGoToProject?: () => void;
}
```

Replace with:

```typescript
export interface ImportSurfaceProps {
  onImportProject?: (project: RBProject) => void;
  projectIoRows?: IdeExampleIoRow[];
  onApplySuggestions?: (items: Array<{ rowId: string; pin: string }>) => void;
  onGoToProject?: () => void;
  onGoToVerify?: () => void;
}
```

### Step 2: Destructure `onGoToVerify` in the component

In the component function signature, add `onGoToVerify` alongside the other destructured props:

```typescript
export const ImportSurface: React.FC<ImportSurfaceProps> = ({
  onImportProject,
  projectIoRows,
  onApplySuggestions,
  onGoToProject,
  onGoToVerify,
}) => {
```

### Step 3: Add `generateBaselineVectors` helper function

Add this function at the bottom of the file, alongside the other helpers (`buildDiagnosticsReport`, `buildMappingRecord`):

```typescript
/**
 * Generates minimal baseline test vectors from the circuit's INPUT nodes.
 * Patterns: all-zeros (tick 0), one-hot per input (ticks 1..N), all-ones (tick N+1).
 * Expected outputs are set to 0 — the student fills them in after running verify.
 */
function generateBaselineVectors(project: RBProject): Array<{
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}> {
  const inputNodes = project.circuit.nodes.filter((n) => n.type === 'INPUT');
  const outputNodes = project.circuit.nodes.filter((n) => n.type === 'OUTPUT');
  if (inputNodes.length === 0) return [];

  const emptyExpected = Object.fromEntries(outputNodes.map((n) => [n.id, 0 as 0 | 1]));

  const vectors: Array<{ tick: number; inputs: Record<string, 0 | 1>; expected: Record<string, 0 | 1> }> = [];

  // Tick 0: all inputs = 0
  vectors.push({
    tick: 0,
    inputs: Object.fromEntries(inputNodes.map((n) => [n.id, 0 as 0 | 1])),
    expected: { ...emptyExpected },
  });

  // Ticks 1..N: one-hot inputs
  inputNodes.forEach((inNode, i) => {
    vectors.push({
      tick: i + 1,
      inputs: Object.fromEntries(
        inputNodes.map((n) => [n.id, (n.id === inNode.id ? 1 : 0) as 0 | 1])
      ),
      expected: { ...emptyExpected },
    });
  });

  // Final tick: all inputs = 1
  vectors.push({
    tick: inputNodes.length + 1,
    inputs: Object.fromEntries(inputNodes.map((n) => [n.id, 1 as 0 | 1])),
    expected: { ...emptyExpected },
  });

  return vectors;
}
```

### Step 4: Attach vectors in Build step of `handleProcessDesign`

In `handleProcessDesign`, find the Build step success path. Currently it ends with:

```typescript
setPendingApplyProject(built);
markPipelineStep('build', 'done', `${built.circuit.nodes.length} nodes · ${built.circuit.connections.length} connections`);
setStatusMessage('Design processed. Review commit preview below.');
```

Replace with:

```typescript
const baselineVectors = generateBaselineVectors(built);
const builtWithVectors: RBProject = baselineVectors.length > 0
  ? { ...built, vectors: baselineVectors }
  : built;
setPendingApplyProject(builtWithVectors);
markPipelineStep(
  'build',
  'done',
  baselineVectors.length > 0
    ? `${built.circuit.nodes.length} nodes · ${baselineVectors.length} baseline vectors`
    : `${built.circuit.nodes.length} nodes · ${built.circuit.connections.length} connections`
);
setStatusMessage('Design processed. Review commit preview below.');
```

### Step 5: Add `confirmAndVerify` action handler

Add after `cancelApplyProject`:

```typescript
const confirmAndVerify = () => {
  if (!pendingApplyProject) return;
  onImportProject?.(pendingApplyProject);
  setPendingApplyProject(null);
  setStatusMessage('Project imported. Opening Verify…');
  onGoToVerify?.();
};
```

### Step 6: Add the "Confirm & Open Verify →" CTA to the commit preview

In the commit preview JSX, find the `ide-inline-actions` div:

```tsx
<div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
  <IdeButton tone="ghost" onClick={cancelApplyProject} testId="ide-import-apply-cancel">
    Cancel
  </IdeButton>
  <IdeButton tone="primary" onClick={confirmApplyProject} testId="ide-import-apply-confirm">
    Confirm Replace Project
  </IdeButton>
</div>
```

Replace with:

```tsx
<div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)', flexWrap: 'wrap' }}>
  <IdeButton tone="ghost" onClick={cancelApplyProject} testId="ide-import-apply-cancel">
    Cancel
  </IdeButton>
  <IdeButton tone="secondary" onClick={confirmApplyProject} testId="ide-import-apply-confirm">
    Confirm Replace Project
  </IdeButton>
  {onGoToVerify && (
    <div className="ide-import-verify-cta">
      <span className="ide-import-verify-cta-label">
        {(pendingApplyProject?.vectors?.length ?? 0) > 0
          ? `${pendingApplyProject!.vectors!.length} baseline vectors ready`
          : 'Import + open Verify'}
      </span>
      <IdeButton
        tone="primary"
        onClick={confirmAndVerify}
        testId="ide-import-apply-open-verify"
      >
        Confirm &amp; Open Verify →
      </IdeButton>
    </div>
  )}
</div>
```

### Step 7: Wire `onGoToVerify` in IdeApp.tsx

Find the `<ImportSurface` block in IdeApp.tsx:

```typescript
<ImportSurface
  onImportProject={handleImportProject}
  projectIoRows={projectIoRows}
  onApplySuggestions={handleApplySuggestions}
  onGoToProject={() => setCurrentMode('project')}
/>
```

Add the new prop:

```typescript
<ImportSurface
  onImportProject={handleImportProject}
  projectIoRows={projectIoRows}
  onApplySuggestions={handleApplySuggestions}
  onGoToProject={() => setCurrentMode('project')}
  onGoToVerify={() => setCurrentMode('verify')}
/>
```

### Step 8: TypeScript check (full check)

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep -E "ImportSurface|IdeApp"
```

Expected: no errors on either file.

### Step 9: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx packages/rb-apps/src/apps/IdeApp.tsx
git commit -m "$(cat <<'EOF'
feat(import): baseline vector generation + Confirm & Open Verify CTA

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Final TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep -E "ImportSurface|vhdlImport|verilogImport|xdcImport|zipImport|IdeApp"
```

Expected: no output (zero errors across all modified files).

---

## Acceptance tests (manual)

**A) Entity chooser:**
- In HDL tab, paste two VHDL entities in sequence:
  ```vhdl
  entity foo is Port (a: in STD_LOGIC; y: out STD_LOGIC); end foo;
  architecture Behavioral of foo is begin y <= a; end Behavioral;
  entity bar is Port (x: in STD_LOGIC; z: out STD_LOGIC); end bar;
  architecture Behavioral of bar is begin z <= x; end Behavioral;
  ```
- The entity chooser dropdown appears showing `foo` / `bar`. Auto-pick hint reads "Auto-selected: first entity".
- Select `bar`. Click Parse HDL. The ports table shows `x` (in) and `z` (out) — `bar`'s ports, not `foo`'s.

**B) XDC jump-to-fix:**
- Load `SAMPLE_AND_GATE_VHDL` + `SAMPLE_AND_GATE_XDC` (AND gate has no `clk` port, but XDC has a `clk` → W5 assignment).
- Parse both. Switch to XDC tab — the XDC gutter shows line numbers. Switch back.
- In XDC Coverage, the `clk` ORPHAN row shows "Ln X" button. Clicking it switches to the XDC tab and the gutter highlights the line of the `set_property ... clk` entry.

**C) ZIP chooser:**
- Upload a Vivado ZIP containing multiple HDL files (e.g. one with `top.vhd` and `helper.vhd`).
- ZIP Inspection shows HDL candidates as radio buttons; `top.vhd` shows the "auto" badge.
- Select `helper.vhd` and click "Re-extract with selection" — the ports table now shows `helper.vhd`'s ports.

**D) Schematic preview:**
- Parse `SAMPLE_PASSTHROUGH_VHDL` (4-bit passthrough, no instances). Preview shows:
  - Left col: `sw[0]`..`sw[3]` (inputs) with `→` arrows
  - Center: `TOP / top / VHDL` box
  - Right col: `ld[0]`..`ld[3]` (outputs) with `←` arrows
  - No instance stubs (behavioral HDL)
- Parse structural VHDL with two component instantiations — instance stubs appear below the panel.

**E) Import → Verify:**
- Paste AND gate VHDL + XDC. Click "Process Design". All steps pass. Commit Preview shows "3 baseline vectors ready" (all-zeros, one-hot ×2 inputs, all-ones).
- Click "Confirm & Open Verify →". The Verify surface opens and the vector table shows 4 rows (tick 0..3) pre-populated.

---

## What Phase 34 Does NOT Include (Deferred to Phase 35)

- **Constraints sanity checks** — duplicate pin detection, missing clock pin, bus bit format mismatches (SW[0] vs SW0). These are purely additive warnings computed from `xdcResult.pinMap` and can be added without parser changes.
- **Replace Project safety gate** — destructive-change warning + checkbox confirmation before `confirmApplyProject`. Straightforward diff of `removedPortNames.length > 0` in `commitPreview`.
- **Import manifest hash** — HDL hash + XDC hash + timestamp slab after Build. Compute with `crypto.subtle.digest('SHA-256', ...)` on the source strings, display alongside the commit preview.
- **Multi-file HDL** — component libraries where one file defines `helper_and` used inside `top.vhd`. Currently parsers see only one file at a time. Phase 35+ needs a multi-source bundle concept.
