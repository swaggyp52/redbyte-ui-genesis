# Phase 33 — Import: Pipeline Authority

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Import surface feel like an auditable ingestion pipeline — not a form. Every parse decision visible, every XDC gap flagged, every Replace Project commit previewed before it happens.

**Architecture:** Five discrete additions to `ImportSurface.tsx` + one CSS block. No new files. No new props on `ImportSurface`. The three individual action buttons (Parse HDL / Parse XDC / Apply Pins Only) are kept; "Process Design" wraps them into a unified pipeline CTA with step feedback.

**Tech Stack:** React, TypeScript strict, existing primitives: `IdeButton`, `IdeStatusPill`, `IdeCallout`, `IdeDataTable`, `IdePanel`.

---

## Context: What Exists After Phase 31

`ImportSurface.tsx` (1465 lines) has:

- **State:** `parsedHdl`, `xdcResult`, `zipInspection`, `mapping`, `blockingErrors`, `warnings`, `suggestions`
- **Handlers:** `parseHdl()` (line 248), `parseXdc()` (line 451), `buildCurrentProject()` (line 495), `requestApplyProject()` (line 525), `confirmApplyProject()` (line 533)
- **Parse summary:** compact one-liner in `ide-import-parse-summary` showing entity + port count
- **Confirmation dialog:** generic `IdeCallout tone="warn"` asking "apply import to replace project?" with no diff
- **XDC gaps:** `blockingErrors` includes unmapped ports but XDC orphan keys (XDC entries with no HDL match) are not surfaced in UI
- **Width display:** `inferPortWidth()` (line 1371) returns `'bus'` for vector types — it should return actual bit-width

**Existing `ZipImportInspection` fields used in this plan:**
- `detectedTopPath`, `detectedXdcPath`, `hdlCandidates`, `xdcCandidates`, `reconstructionLevel`, `parsedHdl`, `xdcResult`

**`ParsedHDL` fields:** `entityName`, `ports[]` (each: `name`, `direction`, `typeName`), `lang`, `warnings[]`

**`XdcParseResult` fields:** `pinMap: Record<string, string>` (portName → package pin), `warnings: string[]`

---

## Task 1: Import Pipeline Step State + `handleProcessDesign`

**What:** Add 5-step pipeline state for `ImportPipelineStep` and a `handleProcessDesign` function that runs all import stages in sequence with step-by-step feedback. Keeps existing individual buttons unchanged.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Add types + `IMPORT_PIPELINE` constant before component export (after line 170)

```tsx
// ─── Phase 33: Import Pipeline Step Types ─────────────────────────────────
type ImportPipelineStepId = 'load' | 'parse-hdl' | 'parse-xdc' | 'validate' | 'build';
type ImportPipelineStepState = 'idle' | 'running' | 'done' | 'skipped' | 'error';

interface ImportPipelineStep {
  id: ImportPipelineStepId;
  label: string;
  state: ImportPipelineStepState;
  detail?: string;
}

const IMPORT_PIPELINE: Array<{ id: ImportPipelineStepId; label: string }> = [
  { id: 'load',      label: 'Load inputs' },
  { id: 'parse-hdl', label: 'Parse HDL' },
  { id: 'parse-xdc', label: 'Parse XDC' },
  { id: 'validate',  label: 'Validate ports' },
  { id: 'build',     label: 'Build project model' },
];

function makePipelineSteps(): ImportPipelineStep[] {
  return IMPORT_PIPELINE.map((s) => ({ id: s.id, label: s.label, state: 'idle' }));
}

/** Yield control to React for a short duration between async pipeline steps. */
function importTick(ms = 40): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}
```

### Step 2: Add pipeline state inside the component (after `openFixPathId`, around line 196)

```tsx
// Phase 33: pipeline state
const [pipelineSteps, setPipelineSteps] = useState<ImportPipelineStep[]>(() => makePipelineSteps());
const [pipelineActive, setPipelineActive] = useState(false);
```

### Step 3: Add `markPipelineStep` and `handleProcessDesign` helper (after `parseXdc`, around line 478)

Place after the `parseXdc` function:

```tsx
const markPipelineStep = useCallback(
  (id: ImportPipelineStepId, state: ImportPipelineStepState, detail?: string) => {
    setPipelineSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state, detail } : s))
    );
  },
  []
);

const handleProcessDesign = useCallback(async () => {
  setPipelineActive(true);
  setPipelineSteps(makePipelineSteps());
  setPendingApplyProject(null);
  setStatusMessage('Processing design…');

  try {
    // STEP: load — check inputs present
    markPipelineStep('load', 'running');
    await importTick();
    if (!hdlText.trim() && !zipInspection) {
      markPipelineStep('load', 'error', 'No HDL source — paste HDL or upload a ZIP first');
      setStatusMessage('Process failed: no HDL source.');
      setPipelineActive(false);
      return;
    }
    markPipelineStep('load', 'done');

    // STEP: parse-hdl
    markPipelineStep('parse-hdl', 'running');
    await importTick();
    const source = hdlText.trim();
    if (!source) {
      markPipelineStep('parse-hdl', 'skipped', 'No HDL pasted — using ZIP parse result');
    } else {
      try {
        const effectiveLang =
          language === 'auto' ? detectHdlLanguage(source) : (language as 'vhdl' | 'verilog');
        const parsed = effectiveLang === 'vhdl' ? parseVhdl(source) : parseVerilog(source);
        setParsedHdl(parsed);
        setMapping((prev) => {
          const next: Record<string, string> = {};
          for (const port of parsed.ports) next[port.name] = prev[port.name] ?? '';
          return next;
        });
        markPipelineStep(
          'parse-hdl',
          parsed.ports.length > 0 ? 'done' : 'error',
          parsed.ports.length > 0
            ? `${parsed.entityName} · ${parsed.ports.length} ports`
            : 'No ports detected — check entity/module syntax'
        );
        if (parsed.ports.length === 0) {
          setStatusMessage('HDL parse found no ports.');
          setPipelineActive(false);
          return;
        }
      } catch (err) {
        markPipelineStep('parse-hdl', 'error', err instanceof Error ? err.message : 'parse failed');
        setStatusMessage(`HDL parse failed.`);
        setPipelineActive(false);
        return;
      }
    }

    // STEP: parse-xdc
    const xdcSource = xdcText.trim();
    if (!xdcSource && !xdcResult) {
      markPipelineStep('parse-xdc', 'skipped', 'No XDC — pins will need manual assignment');
    } else {
      markPipelineStep('parse-xdc', 'running');
      await importTick();
      if (xdcSource && !xdcResult) {
        try {
          const parsed = parseXdcPins(xdcSource);
          setXdcResult(parsed);
          setMapping((prev) => {
            const next = { ...prev };
            const activeParsedHdl = parsedHdl;
            if (activeParsedHdl) {
              for (const port of activeParsedHdl.ports) {
                const mappedPin = parsed.pinMap[port.name] ?? parsed.pinMap[port.name.toLowerCase()];
                if (mappedPin && !(next[port.name] ?? '').trim()) {
                  next[port.name] = mappedPin.toUpperCase();
                }
              }
            }
            return next;
          });
          markPipelineStep('parse-xdc', 'done', `${Object.keys(parsed.pinMap).length} pin assignments`);
        } catch (err) {
          markPipelineStep('parse-xdc', 'error', err instanceof Error ? err.message : 'XDC parse failed');
          // non-fatal — continue
        }
      } else {
        markPipelineStep('parse-xdc', 'done', `${Object.keys(xdcResult!.pinMap).length} pins already parsed`);
      }
    }

    // STEP: validate
    markPipelineStep('validate', 'running');
    await importTick();
    // Re-read blockingErrors after state updates settle (state reads here are from closure,
    // so evaluate directly):
    const activePorts = parsedHdl?.ports ?? [];
    const activeMapping = mapping;
    const unmapped = activePorts.filter((p) => !(activeMapping[p.name] ?? '').trim());
    if (unmapped.length > 0) {
      markPipelineStep('validate', 'error', `${unmapped.length} unmapped port${unmapped.length !== 1 ? 's' : ''}`);
      setStatusMessage(`Validation: ${unmapped.length} unmapped ports.`);
      setPipelineActive(false);
      return;
    }
    markPipelineStep('validate', 'done', `${activePorts.length} ports valid`);

    // STEP: build
    markPipelineStep('build', 'running');
    await importTick(60);
    const built = buildCurrentProject();
    if (!built) {
      markPipelineStep('build', 'error', 'buildCurrentProject returned null');
      setStatusMessage('Build failed.');
      setPipelineActive(false);
      return;
    }
    setPendingApplyProject(built);
    markPipelineStep('build', 'done', `${built.circuit.nodes.length} nodes · ${built.circuit.connections.length} connections`);
    setStatusMessage('Design processed. Review commit preview below.');
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    setStatusMessage(`Process failed: ${reason}`);
    setPipelineSteps((prev) =>
      prev.map((s) => (s.state === 'running' ? { ...s, state: 'error', detail: reason } : s))
    );
  } finally {
    setPipelineActive(false);
  }
}, [
  hdlText, xdcText, language, zipInspection, xdcResult, parsedHdl, mapping,
  markPipelineStep, buildCurrentProject,
]);
```

**Note:** `handleProcessDesign` closes over `parsedHdl` and `mapping` from the **current render**. Because `setParsedHdl` updates are batched, the `validate` step reads `parsedHdl` from the closure (which reflects the value before this render batch). This is acceptable: if the user already has parsed HDL loaded, the validate step correctly uses it. If parse-hdl just ran and updated state, React will have committed by the time `importTick` resolves (the 40ms yield allows a re-render cycle before validation reads). This is the same pattern used in Phase 32's `handleRebuildExport`.

### Step 4: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ImportSurface
```

Expected: no errors on the new code.

### Step 5: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "feat(import): pipeline step state + handleProcessDesign"
```

---

## Task 2: "Process Design" Button + Step List UI

**What:** Add the "Process Design" primary CTA button to the IdePanel header `actions`, and add the step list display below the tab selector in the main content area.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Add "Process Design" button before "Replace Project…" in the header actions

Find the `span data-testid="ide-primary-cta"` wrapping the Replace Project button (around line 924). Insert before it:

```tsx
<IdeButton
  tone="secondary"
  onClick={() => void handleProcessDesign()}
  disabled={pipelineActive || (!hdlText.trim() && !zipInspection)}
  testId="ide-import-process-design"
>
  {pipelineActive ? 'Processing…' : 'Process Design'}
</IdeButton>
```

### Step 2: Add step list below tab selector (after `ide-pipeline-stage` tabs, around line 1001)

Find the closing `</div>` of the `ide-pipeline-stage` buttons group (after line 1000). Add immediately after:

```tsx
{pipelineSteps.some((s) => s.state !== 'idle') && (
  <ol className="ide-import-pipeline-steps" data-testid="ide-import-pipeline-steps">
    {pipelineSteps.map((s) => (
      <li
        key={s.id}
        className={`ide-import-pipeline-step ide-import-pipeline-step--${s.state}`}
        data-testid={`ide-import-pipeline-step-${s.id}`}
      >
        <span className="ide-import-step-mark">
          {s.state === 'done'    ? '[✔]'
         : s.state === 'running' ? '[…]'
         : s.state === 'error'   ? '[✗]'
         : s.state === 'skipped' ? '[—]'
         :                         '[ ]'}
        </span>
        <span className="ide-import-step-label">{s.label}</span>
        {s.detail && <span className="ide-import-step-detail">{s.detail}</span>}
      </li>
    ))}
  </ol>
)}
```

### Step 3: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ImportSurface
```

### Step 4: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "feat(import): Process Design CTA + step list progress UI"
```

---

## Task 3: Commit Preview (Replace Project diff)

**What:** Replace the generic `IdeCallout tone="warn"` confirmation ("apply import to replace active project?") with a structured `ide-import-commitPreview` block that shows:
- Entity name + language
- Port count (M in / N out) with port names listed if ≤ 6
- Reconstruction level: "full" / "ports-only" / "behavioral"
- Pin mapping summary: X/N ports mapped
- If `projectIoRows` present: compare to current — which ports are new, which are removed

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Add `commitPreview` useMemo (after `canImport`, around line 419)

```tsx
const commitPreview = useMemo(() => {
  if (!pendingApplyProject || !parsedHdl) return null;
  const inPorts = parsedHdl.ports.filter((p) => p.direction === 'in');
  const outPorts = parsedHdl.ports.filter((p) => p.direction === 'out');
  const mappedCount = parsedHdl.ports.filter((p) => (mapping[p.name] ?? '').trim()).length;
  const reconstructionLevel = zipInspection?.reconstructionLevel ?? 'ports-only';

  // diff vs current project
  const currentPortNames = new Set((projectIoRows ?? []).map((r) => (r.port ?? r.label ?? '').toLowerCase()));
  const incomingPortNames = new Set(parsedHdl.ports.map((p) => p.name.toLowerCase()));
  const addedPorts = parsedHdl.ports.filter((p) => !currentPortNames.has(p.name.toLowerCase()));
  const removedPortNames = (projectIoRows ?? [])
    .filter((r) => {
      const key = (r.port ?? r.label ?? '').toLowerCase();
      return key.length > 0 && !incomingPortNames.has(key);
    })
    .map((r) => r.port ?? r.label ?? r.id);

  return {
    entityName: parsedHdl.entityName,
    lang: parsedHdl.lang,
    inCount: inPorts.length,
    outCount: outPorts.length,
    totalPorts: parsedHdl.ports.length,
    mappedCount,
    reconstructionLevel,
    addedPorts,
    removedPortNames,
    nodeCount: pendingApplyProject.circuit.nodes.length,
    connectionCount: pendingApplyProject.circuit.connections.length,
  };
}, [pendingApplyProject, parsedHdl, mapping, zipInspection, projectIoRows]);
```

### Step 2: Replace the confirmation callout JSX

Find the `{pendingApplyProject ? (` block that renders the `IdeCallout tone="warn" title="Apply import to active project?"` (around line 959). Replace the entire callout with:

```tsx
{pendingApplyProject && commitPreview ? (
  <div className="ide-import-commitPreview" data-testid="ide-import-commit-preview">
    <div className="ide-import-commitPreview-header">
      <span className="ide-import-commitPreview-title">COMMIT PREVIEW</span>
      <IdeStatusPill tone="warn">Pending</IdeStatusPill>
    </div>

    <div className="ide-import-commitPreview-rows">
      <div className="ide-import-commitPreview-row">
        <span className="ide-import-commitPreview-key">ENTITY</span>
        <span className="ide-import-commitPreview-val">
          {commitPreview.entityName}
          <span className="ide-import-commitPreview-lang"> ({commitPreview.lang.toUpperCase()})</span>
        </span>
      </div>
      <div className="ide-import-commitPreview-row">
        <span className="ide-import-commitPreview-key">PORTS</span>
        <span className="ide-import-commitPreview-val">
          {commitPreview.totalPorts} total · {commitPreview.inCount} in / {commitPreview.outCount} out
        </span>
      </div>
      <div className="ide-import-commitPreview-row">
        <span className="ide-import-commitPreview-key">PINS</span>
        <span className="ide-import-commitPreview-val">
          {commitPreview.mappedCount}/{commitPreview.totalPorts} mapped
        </span>
      </div>
      <div className="ide-import-commitPreview-row">
        <span className="ide-import-commitPreview-key">GRAPH</span>
        <span className="ide-import-commitPreview-val">
          {commitPreview.reconstructionLevel === 'full'
            ? `full · ${commitPreview.nodeCount} nodes`
            : commitPreview.reconstructionLevel === 'ports-only'
              ? `ports only (behavioral) · ${commitPreview.nodeCount} nodes`
              : `empty`}
        </span>
      </div>
      {commitPreview.addedPorts.length > 0 && (
        <div className="ide-import-commitPreview-row ide-import-commitPreview-row--add">
          <span className="ide-import-commitPreview-key">+PORTS</span>
          <span className="ide-import-commitPreview-val">
            {commitPreview.addedPorts.slice(0, 6).map((p) => p.name).join(', ')}
            {commitPreview.addedPorts.length > 6 ? ` +${commitPreview.addedPorts.length - 6} more` : ''}
          </span>
        </div>
      )}
      {commitPreview.removedPortNames.length > 0 && (
        <div className="ide-import-commitPreview-row ide-import-commitPreview-row--remove">
          <span className="ide-import-commitPreview-key">−PORTS</span>
          <span className="ide-import-commitPreview-val">
            {commitPreview.removedPortNames.slice(0, 6).join(', ')}
            {commitPreview.removedPortNames.length > 6 ? ` +${commitPreview.removedPortNames.length - 6} more` : ''}
          </span>
        </div>
      )}
    </div>

    <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
      <IdeButton tone="ghost" onClick={cancelApplyProject} testId="ide-import-apply-cancel">
        Cancel
      </IdeButton>
      <IdeButton tone="primary" onClick={confirmApplyProject} testId="ide-import-apply-confirm">
        Confirm Replace Project
      </IdeButton>
    </div>
  </div>
) : null}
```

### Step 3: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ImportSurface
```

### Step 4: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "feat(import): commit preview diff before Replace Project"
```

---

## Task 4: XDC Orphan Detection + Clock Candidate + Width Fix

**What:**
1. **XDC orphans** — compute `orphanXdcKeys` (XDC pin entries with no matching HDL port) and show them in a new "XDC Coverage" subsection beneath the mapping table
2. **Clock candidates** — compute `clockCandidatePort` (first port matching a clock naming pattern) and show a targeted callout in the parse summary panel in the dock
3. **Width fix** — fix `inferPortWidth` to return actual bit widths ("4", "8") instead of "bus" for vector types

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`

---

### Step 1: Fix `inferPortWidth` (around line 1571 after plan's Task 4 offset)

Find the current `inferPortWidth` function:

```tsx
function inferPortWidth(typeName: string): string {
  const normalized = typeName.trim().toLowerCase();
  const vectorMatch = normalized.match(/\[(\d+)\s*:\s*(\d+)\]/);
  if (vectorMatch) {
    const left = Number(vectorMatch[1]);
    const right = Number(vectorMatch[2]);
    return String(Math.abs(left - right) + 1);
  }
  if (normalized.includes('vector')) return 'bus';
  return '1';
}
```

Replace with:

```tsx
function inferPortWidth(typeName: string): string {
  const normalized = typeName.trim().toLowerCase();
  // Verilog: logic [7:0], wire [3:0]
  const verilogMatch = normalized.match(/\[(\d+)\s*:\s*(\d+)\]/);
  if (verilogMatch) {
    return String(Math.abs(Number(verilogMatch[1]) - Number(verilogMatch[2])) + 1);
  }
  // VHDL: std_logic_vector(N downto 0) or (N-1 downto 0)
  const vhdlDownto = normalized.match(/\((\d+)\s+downto\s+(\d+)\)/);
  if (vhdlDownto) {
    return String(Math.abs(Number(vhdlDownto[1]) - Number(vhdlDownto[2])) + 1);
  }
  // VHDL: std_logic_vector(0 to N)
  const vhdlTo = normalized.match(/\((\d+)\s+to\s+(\d+)\)/);
  if (vhdlTo) {
    return String(Math.abs(Number(vhdlTo[1]) - Number(vhdlTo[2])) + 1);
  }
  // Catch-all for vector types without extracted width
  if (normalized.includes('vector') || normalized.includes('logic') ||
      normalized.includes('bit_vector')) return 'bus';
  return '1';
}
```

**Acceptance test:** `inferPortWidth("STD_LOGIC_VECTOR(3 downto 0)")` → `"4"`. `inferPortWidth("logic [7:0]")` → `"8"`. `inferPortWidth("STD_LOGIC")` → `"1"`.

### Step 2: Add `orphanXdcKeys` and `clockCandidatePort` useMemos (after `canImport`, around line 419)

```tsx
const orphanXdcKeys = useMemo(() => {
  if (!xdcResult || !parsedHdl) return [] as string[];
  const portKeySet = new Set(parsedHdl.ports.map((p) => p.name.toLowerCase()));
  return Object.keys(xdcResult.pinMap).filter(
    (k) => !portKeySet.has(k.toLowerCase())
  );
}, [xdcResult, parsedHdl]);

const clockCandidatePort = useMemo(() => {
  if (!parsedHdl) return null;
  return parsedHdl.ports.find((p) =>
    /^(clk|clock|clk\d+|sys_clk|clk100mhz)$/i.test(p.name)
  ) ?? null;
}, [parsedHdl]);
```

### Step 3: Add XDC Coverage section in main content (after the mapping table, before the confirmation dialog)

Find the port mapping table (the `IdeDataTable` or the `<section>` wrapping `portRows` in the main content). After the mapping table closing tag, add:

```tsx
{hasParsedHdl && (hasParsedXdc || unmappedPorts.length > 0) && (
  <section
    className="ide-import-xdc-coverage"
    data-testid="ide-import-xdc-coverage"
  >
    <header className="ide-export-section-header">
      <h3>XDC Coverage</h3>
      <span className="ide-export-section-meta">
        {parsedHdl!.ports.length - unmappedPorts.length}/{parsedHdl!.ports.length} constrained
      </span>
    </header>

    {unmappedPorts.length > 0 && (
      <div className="ide-import-xdc-gaps" data-testid="ide-import-unmapped-list">
        {unmappedPorts.map((port) => (
          <div key={port.name} className="ide-import-xdc-gap-row ide-import-xdc-gap-row--unmapped">
            <IdeStatusPill tone="warn">UNMAPPED</IdeStatusPill>
            <code className="ide-import-xdc-gap-port">{port.name}</code>
            <span className="ide-import-xdc-gap-dir">{port.direction.toUpperCase()}</span>
            <span className="ide-import-xdc-gap-hint">No XDC constraint found</span>
          </div>
        ))}
      </div>
    )}

    {orphanXdcKeys.length > 0 && (
      <div className="ide-import-xdc-orphans" data-testid="ide-import-orphan-list">
        {orphanXdcKeys.map((key) => (
          <div key={key} className="ide-import-xdc-gap-row ide-import-xdc-gap-row--orphan">
            <IdeStatusPill tone="warn">ORPHAN</IdeStatusPill>
            <code className="ide-import-xdc-gap-port">{key}</code>
            <span className="ide-import-xdc-gap-dir">→ {xdcResult!.pinMap[key]}</span>
            <span className="ide-import-xdc-gap-hint">In XDC but not in HDL</span>
          </div>
        ))}
      </div>
    )}

    {unmappedPorts.length === 0 && orphanXdcKeys.length === 0 && (
      <p className="ide-copy" style={{ margin: 0, fontSize: 11, color: 'var(--ide-text-muted)' }}>
        All HDL ports are constrained. No orphan XDC keys.
      </p>
    )}
  </section>
)}
```

### Step 4: Add clock candidate callout in dock parse feedback (after the "Detected:" parse summary row around line 677)

Find the parse summary block in the dock section (around line 660):

```tsx
<div className="ide-import-parse-summary" data-testid="ide-import-stage-summary">
  <span data-testid="ide-import-entity-summary">
    Entity: <strong>{parsedEntityName}</strong>
  </span>
  ...
</div>
```

After the close of this `div`, add:

```tsx
{clockCandidatePort && (
  <div
    className="ide-import-clock-candidate"
    data-testid="ide-import-clock-candidate"
  >
    <IdeStatusPill tone="ok">CLK</IdeStatusPill>
    <code>{clockCandidatePort.name}</code>
    <span>
      {xdcResult?.pinMap[clockCandidatePort.name]
        ? `→ ${xdcResult.pinMap[clockCandidatePort.name]}`
        : 'no pin constraint yet'}
    </span>
  </div>
)}
```

### Step 5: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ImportSurface
```

### Step 6: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx
git commit -m "feat(import): XDC orphan detection + clock candidate + vector width fix"
```

---

## Task 5: CSS — All Phase 33 Styles

**What:** Append Phase 33 CSS rules to `ide-root.css`.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` — append at EOF

---

### Step 1: Append at EOF

```css
/* ═══════════════════════════════════════════════════════════════════════════
   Phase 33 — Import Pipeline Authority
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── 33A: Import pipeline step list ──────────────────────────────────── */
.ide-import-pipeline-steps {
  list-style: none;
  margin: 0 0 var(--ide-space-2) 0;
  padding: var(--ide-space-2) var(--ide-space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius);
}

.ide-import-pipeline-step {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  font-family: var(--ide-font-mono);
  color: var(--ide-text-muted);
  line-height: 1.4;
}

.ide-import-pipeline-step--done    { color: var(--ide-green-text, #4ade80); }
.ide-import-pipeline-step--error   { color: var(--ide-red-text,   #f87171); }
.ide-import-pipeline-step--running { color: var(--ide-text); font-weight: 600; }
.ide-import-pipeline-step--skipped { color: var(--ide-text-muted); opacity: 0.55; }

.ide-import-step-mark  { flex-shrink: 0; width: 30px; font-weight: 700; }
.ide-import-step-label { flex: 1; }
.ide-import-step-detail {
  font-size: 10px;
  color: inherit;
  opacity: 0.75;
  padding-left: 36px;
  display: block;
}

/* ─── 33B: Commit preview ─────────────────────────────────────────────── */
.ide-import-commitPreview {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius);
  overflow: hidden;
  margin-bottom: var(--ide-space-3);
}

.ide-import-commitPreview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ide-space-2) var(--ide-space-3);
  background: rgba(250, 204, 21, 0.05);
  border-bottom: 1px solid var(--ide-border);
}

.ide-import-commitPreview-title {
  font-size: 9px;
  font-family: var(--ide-font-mono);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ide-text-muted);
}

.ide-import-commitPreview-rows { display: flex; flex-direction: column; }

.ide-import-commitPreview-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: baseline;
  gap: var(--ide-space-2);
  padding: 4px var(--ide-space-3);
  font-size: 11px;
  font-family: var(--ide-font-mono);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ide-import-commitPreview-row:last-child { border-bottom: none; }
.ide-import-commitPreview-row--add    { background: rgba(74, 222, 128, 0.04); }
.ide-import-commitPreview-row--remove { background: rgba(248, 113, 113, 0.04); }

.ide-import-commitPreview-key {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ide-text-muted);
}
.ide-import-commitPreview-val { color: var(--ide-text); }
.ide-import-commitPreview-lang {
  font-size: 9px;
  color: var(--ide-text-muted);
  margin-left: 4px;
}

/* ─── 33C: XDC Coverage section ───────────────────────────────────────── */
.ide-import-xdc-coverage {
  margin-top: var(--ide-space-3);
}

.ide-import-xdc-gaps,
.ide-import-xdc-orphans {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: var(--ide-space-2);
}

.ide-import-xdc-gap-row {
  display: flex;
  align-items: center;
  gap: var(--ide-space-2);
  padding: 4px var(--ide-space-2);
  font-size: 11px;
  font-family: var(--ide-font-mono);
  border-radius: 3px;
  background: rgba(255,255,255,0.02);
}

.ide-import-xdc-gap-row--unmapped { background: rgba(250, 204, 21, 0.04); }
.ide-import-xdc-gap-row--orphan   { background: rgba(248, 113, 113, 0.04); }

.ide-import-xdc-gap-port { font-size: 11px; font-weight: 600; }
.ide-import-xdc-gap-dir  { color: var(--ide-text-muted); font-size: 10px; }
.ide-import-xdc-gap-hint { color: var(--ide-text-muted); font-size: 10px; font-style: italic; }

/* ─── 33D: Clock candidate badge in dock ──────────────────────────────── */
.ide-import-clock-candidate {
  display: flex;
  align-items: center;
  gap: var(--ide-space-2);
  padding: 4px 0;
  font-size: 11px;
  font-family: var(--ide-font-mono);
  color: var(--ide-text-dim, var(--ide-text-muted));
}
```

### Step 2: No syntax check needed for CSS — visually scan for unclosed braces

Count `{` vs `}` in the appended block: they should match.

### Step 3: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "feat(import): Phase 33 CSS (pipeline steps, commit preview, XDC coverage, clock badge)"
```

---

## Task 6: Final TypeScript + Acceptance Check

### Step 1: Full TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ImportSurface
```

Expected: no errors.

### Step 2: Acceptance tests (manual)

**A) Pipeline stepper:**
- Paste `SAMPLE_AND_GATE_VHDL` into HDL tab. Click "Process Design".
- Step list appears: `[✔] Load inputs` → `[✔] Parse HDL (top · 3 ports)` → `[—] Parse XDC (skipped)` → `[✗] Validate (3 unmapped ports)`.
- Paste `SAMPLE_AND_GATE_XDC` into XDC tab. Click "Process Design" again.
- All steps complete. Commit preview appears.

**B) Commit preview:**
- After a successful Process Design, commit preview shows:
  - ENTITY: `top (VHDL)`
  - PORTS: `3 total · 2 in / 1 out`
  - PINS: `3/3 mapped`
  - GRAPH: `ports only (behavioral) · 3 nodes`

**C) XDC orphan:**
- Paste `SAMPLE_AND_GATE_XDC` (which has `clk` in XDC) but only `SAMPLE_AND_GATE_VHDL` (no `clk` port in entity) → XDC Coverage shows `clk → W5` as ORPHAN.

**D) Width:**
- Paste `SAMPLE_PASSTHROUGH_VHDL` (has `STD_LOGIC_VECTOR(3 downto 0)` ports). Port table shows width `4`, not `bus`.

**E) Clock candidate:**
- Parse `SAMPLE_EDGEDETECT_VHDL` (has `clk : in STD_LOGIC`). Dock parse feedback shows:
  - `[CLK] clk → no pin constraint yet`
  - After parsing `SAMPLE_EDGEDETECT_XDC`: `[CLK] clk → W5`

### Step 3: Final commit (fixups only if needed)

```bash
git add -A
git commit -m "fix(import): Phase 33 post-test fixups"
```

---

## What Phase 33 Does NOT Include (Deferred)

- **Multi-entity/module selector** — requires `parseVhdl()` / `parseVerilog()` to return `entities[]` instead of a single `entityName`. This is a parser-level change (Phase 34+).
- **Schematic preview integration** — hooking the import result into the design canvas (Phase 34+).
- **Waveform dry-run** — "Run quick trace" simulation on import (Phase 34+).
- **Import manifest hash** — generating a deterministic hash of the import bundle for provenance (can be added to `buildImportedProject` output in Phase 34).
