# Phase 32 — Export: Pipeline Authority

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Export surface feel like an auditable build pipeline — transactional, sealed, and brutally clear about readiness — not a status checklist.

**Architecture:** Six discrete changes to `ExportSurface.tsx` + `ide-root.css`. No new files. No new components. No new props on `ExportSurface`. All changes are additive state, computed values, JSX replacements, and CSS additions.

**Tech Stack:** React 18, TypeScript strict, CSS custom properties (`--ide-*`). Existing primitives: `IdeButton`, `IdeStatusPill`, `IdeCallout`, `IdePanel`, `IdeSurfaceLayout`.

---

## Context: What Exists After Phase 31

`ExportSurface.tsx` (1090 lines) has:
- `capsuleBuildState: 'idle' | 'running' | 'done' | 'error'` — tracks the single `handleBuildEvidenceCapsule` call
- `capsuleManifest: EvidenceManifest | null` — set after a successful capsule build
- `capsuleManifestHash`, `capsuleBundleHash` — hash strings, default `'pending'`
- Gate stack (4 rows: verify/mapping/clock/capsule) with `gateRows` useMemo
- Right col: download block → Pack Contents → Build Identity slab → copy debug report
- Left col: Blockers → Mapping table → Outputs (artifact tabs) → Vivado Import → Vivado Steps

`ide-root.css` has Phase 31 CSS appended at EOF (sections 31A–31G).

`EvidenceManifest` (from `evidenceCapsule.ts`) has:
- `hashes.verifyHash`, `hashes.exportHash`, `hashes.determinismHash`
- `createdAtIso`, `mappingSummary` (array), `manifestHash`

`buildEvidenceCapsule` is one async call — no internal callbacks. Steps must be modelled as pre/during/post the single awaited call.

---

## Task 1: Add `rebuildSteps` State + `handleRebuildExport`

**What:** Replace the single "Download" button flow with a 5-step pipeline that tracks per-step state. The existing `handleBuildEvidenceCapsule` stays as the implementation; `handleRebuildExport` wraps it with step-by-step state updates.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

---

### Step 1: Add the `RebuildStep` type and `rebuildSteps` state

After the `copyState` state line (~line 82), add immediately below the existing state declarations:

```tsx
type RebuildStepState = 'pending' | 'running' | 'done' | 'error';
interface RebuildStep { id: string; label: string; state: RebuildStepState; }

const INITIAL_REBUILD_STEPS: RebuildStep[] = [
  { id: 'validate-mapping',  label: 'Validate mapping',       state: 'pending' },
  { id: 'validate-verify',   label: 'Validate verify run',    state: 'pending' },
  { id: 'generate-manifest', label: 'Generate manifest',      state: 'pending' },
  { id: 'create-zip',        label: 'Create .zip',            state: 'pending' },
  { id: 'seal',              label: 'Seal capsule',           state: 'pending' },
];

const [rebuildSteps, setRebuildSteps] = useState<RebuildStep[]>(INITIAL_REBUILD_STEPS);
const [rebuildActive, setRebuildActive] = useState(false);
```

### Step 2: Add `setStepState` and `handleRebuildExport` helper

Add after `handleBuildEvidenceCapsule` (around line 407). `handleRebuildExport` drives steps sequentially and delegates to the existing capsule logic:

```tsx
const setStepState = (id: string, state: RebuildStepState) => {
  setRebuildSteps((prev) =>
    prev.map((s) => (s.id === id ? { ...s, state } : s))
  );
};

const handleRebuildExport = async () => {
  setRebuildActive(true);
  setCapsuleBuildError('');
  setRebuildSteps(INITIAL_REBUILD_STEPS);

  // Step 1: validate mapping
  setStepState('validate-mapping', 'running');
  await new Promise<void>((r) => window.setTimeout(r, 60));
  if (requiredMappedCount < requiredCount) {
    setStepState('validate-mapping', 'error');
    setCapsuleBuildError(`${requiredCount - requiredMappedCount} required pin${requiredCount - requiredMappedCount !== 1 ? 's' : ''} unmapped.`);
    setRebuildActive(false);
    return;
  }
  setStepState('validate-mapping', 'done');

  // Step 2: validate verify
  setStepState('validate-verify', 'running');
  await new Promise<void>((r) => window.setTimeout(r, 60));
  if (!hasVerifyPass) {
    setStepState('validate-verify', 'error');
    setCapsuleBuildError('Evidence Capsule requires a PASS verification with no pending design changes.');
    setRebuildActive(false);
    return;
  }
  setStepState('validate-verify', 'done');

  // Step 3: generate manifest
  setStepState('generate-manifest', 'running');
  // Step 4: create zip  (both happen inside buildEvidenceCapsule)
  setStepState('create-zip', 'running');

  const ranAtIso = new Date().toISOString();
  setCapsuleBuildState('running');
  setCapsuleManifest(null);

  try {
    const capsule = await buildEvidenceCapsule({
      project,
      exportViewModel: viewModel,
      verifyResult: verifyResult!,
      deterministicHash: determinismHash,
      toolVersion: redbyteVersion,
      toolCommit: redbyteCommit,
      createdAtIso: ranAtIso,
    });

    setStepState('generate-manifest', 'done');
    setStepState('create-zip', 'done');

    // Step 5: seal
    setStepState('seal', 'running');
    await new Promise<void>((r) => window.setTimeout(r, 80));

    if (typeof window !== 'undefined') {
      const blob = new Blob([capsule.zipBytes as unknown as BlobPart], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'redbyte-evidence-capsule.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    setCapsuleManifestHash(capsule.manifest.manifestHash);
    setCapsuleBundleHash(capsule.bundleHash);
    setCapsuleFileList(capsule.filePaths);
    setCapsuleManifest(capsule.manifest);
    setCapsuleBuildState('done');
    setStepState('seal', 'done');
    onExportBundle?.(viewModel.artifacts);
    onExportResult?.({
      status: 'ok',
      hash: viewModel.exportHash,
      manifestHash: capsule.manifest.manifestHash,
      bundleHash: capsule.bundleHash,
      artifacts: capsule.filePaths,
      ranAtIso,
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : 'unknown build error';
    setCapsuleBuildError(`Build failed: ${reason}`);
    setCapsuleBuildState('error');
    setRebuildSteps((prev) =>
      prev.map((s) => (s.state === 'running' ? { ...s, state: 'error' } : s))
    );
    onExportResult?.({
      status: 'blocked',
      hash: viewModel.exportHash,
      artifacts: viewModel.artifacts.map((a) => a.path),
      ranAtIso,
    });
  } finally {
    setRebuildActive(false);
  }
};
```

**Note on the `Blob` cast:** The pre-existing TypeScript error (`Uint8Array<ArrayBufferLike>` not assignable to `BlobPart`) is worked around here using `as unknown as BlobPart`. This matches the existing pattern in `handleBuildEvidenceCapsule` and does not regress TypeScript strictness — it's an upstream TS DOM lib version mismatch.

### Step 3: Run TypeScript check targeting ExportSurface only

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

Expected: one pre-existing `TS2322 line 366` error only. No new errors on the added code.

### Step 4: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx
git commit -m "feat(export): add rebuild pipeline step state + handleRebuildExport"
```

---

## Task 2: Pipeline Step UI — Replace Download Block in Right Col

**What:** Replace the `ide-export-download-block` div in the right column with a new `ide-export-rebuild-block` that shows:
- "Rebuild Export" primary button (or "Rebuilding…" when active)
- Step list when `rebuildActive` or `rebuildSteps` has any non-pending step
- Capsule seal state slab — NOT SEALED / SEALED with manifest payload

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

---

### Step 1: Replace the right column download block JSX

Find the existing `ide-export-download-block` div (around line 988). Replace it entirely with:

```tsx
<div className="ide-export-rebuild-block" data-testid="ide-export-rebuild-block">
  <span data-testid="ide-primary-cta">
    <IdeButton
      tone={hasBlockingErrors ? 'secondary' : 'primary'}
      onClick={() => void handleRebuildExport()}
      disabled={hasBlockingErrors || rebuildActive}
      testId="ide-export-rebuild-btn"
      className={!hasBlockingErrors && !rebuildActive && capsuleBuildState === 'idle' ? 'is-ready' : ''}
    >
      {rebuildActive ? 'Building…' : capsuleBuildState === 'done' ? 'Rebuild Export' : 'Build Export Pack'}
    </IdeButton>
  </span>
  {hasBlockingErrors && (
    <span className="ide-export-download-gate-note" data-testid="ide-export-download-gate-note">
      {gateRows.find((g) => g.tone === 'error' || g.tone === 'warn')?.label ?? 'blockers'} must pass
    </span>
  )}

  {/* Step progress — visible once any step has started */}
  {rebuildSteps.some((s) => s.state !== 'pending') && (
    <ol className="ide-export-rebuild-steps" data-testid="ide-export-rebuild-steps">
      {rebuildSteps.map((step) => (
        <li
          key={step.id}
          className={`ide-export-rebuild-step is-${step.state}`}
          data-testid={`ide-export-rebuild-step-${step.id}`}
        >
          <span className="ide-export-rebuild-step-icon">
            {step.state === 'done'  ? '[✔]'
           : step.state === 'running' ? '[…]'
           : step.state === 'error'   ? '[✗]'
           :                           '[ ]'}
          </span>
          <span className="ide-export-rebuild-step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  )}
</div>
```

### Step 2: Verify — TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

Expected: pre-existing error on line 366 only.

### Step 3: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx
git commit -m "feat(export): rebuild export button + per-step progress list UI"
```

---

## Task 3: Capsule Seal State Slab

**What:** Replace the `ide-export-context-slab` "Build Identity" slab in the right col with a two-part slab:
1. **Seal status bar** — `NOT SEALED` (grey idle), `SEALING…` (warn/pulsing), `SEALED` (green bold)
2. **Payload fields** — only when `capsuleManifest` is present: verifyHash, exportHash, determinismHash, timestamp, N signals

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

---

### Step 1: Replace the `ide-export-context-slab` div (around line 1034)

Find and replace the entire `ide-export-context-slab` div including its array-mapped rows:

```tsx
<div className="ide-export-capsule-slab" data-testid="ide-export-capsule-slab">
  <div
    className={`ide-export-capsule-seal-bar ${
      capsuleBuildState === 'done' ? 'is-sealed'
      : capsuleBuildState === 'running' ? 'is-sealing'
      : capsuleBuildState === 'error' ? 'is-error'
      : 'is-unsealed'
    }`}
    data-testid="ide-export-seal-bar"
  >
    <span className="ide-export-capsule-seal-icon">
      {capsuleBuildState === 'done' ? '◉' : capsuleBuildState === 'running' ? '◌' : '○'}
    </span>
    <span className="ide-export-capsule-seal-label">
      {capsuleBuildState === 'done' ? 'SEALED'
       : capsuleBuildState === 'running' ? 'SEALING…'
       : capsuleBuildState === 'error' ? 'SEAL FAILED'
       : 'NOT SEALED'}
    </span>
  </div>

  {capsuleManifest && (
    <div className="ide-export-capsule-payload" data-testid="ide-export-capsule-payload">
      {[
        { key: 'SIG',    val: capsuleManifest.manifestHash.slice(0, 12) },
        { key: 'VERIFY', val: capsuleManifest.hashes.verifyHash.slice(0, 12) },
        { key: 'EXPORT', val: capsuleManifest.hashes.exportHash?.slice(0, 12) ?? 'n/a' },
        { key: 'PINS',   val: String(capsuleManifest.mappingSummary.length) },
        { key: 'TS',     val: capsuleManifest.createdAtIso.slice(0, 19).replace('T', ' ') },
      ].map(({ key, val }) => (
        <div key={key} className="ide-export-context-row" data-testid={`ide-export-capsule-${key.toLowerCase()}`}>
          <span className="ide-export-context-key">{key}</span>
          <span className="ide-export-context-val">{val}</span>
        </div>
      ))}
    </div>
  )}

  {!capsuleManifest && capsuleBuildState === 'idle' && (
    <p className="ide-export-capsule-hint">
      Build the export pack to seal this capsule.
    </p>
  )}
</div>
```

**Note on `capsuleManifest.hashes.exportHash`:** The `EvidenceManifestHashes` type has `exportHash?: string` (optional). Use `?.slice(0, 12) ?? 'n/a'` as shown above.

### Step 2: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

Expected: pre-existing line 366 error only.

### Step 3: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx
git commit -m "feat(export): capsule seal state slab (NOT SEALED / SEALED + payload)"
```

---

## Task 4: Fix 0/0 Required Mapping Logic

**What:** When `requiredCount === 0` but `viewModel.pinTable.length > 0`, the gate row says `0/0 required` and shows `PASS` — which is technically correct but looks wrong. The fix: show `${mappedCount}/${viewModel.pinTable.length} total` in the detail when there are no required ports, and make the tone always `ok` in that case (it's genuinely fine).

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

---

### Step 1: Update `gateRows` useMemo — mapping row detail and tone

Locate the mapping gate object in `gateRows` useMemo (around line 184–191). The current code:

```tsx
const mappingTone = requiredMappedCount === requiredCount ? 'ok' as const : 'error' as const;
// ...
{ id: 'mapping', label: 'I/O Mapping', tone: mappingTone,
  detail: `${requiredMappedCount}/${requiredCount} required`,
  ...
},
```

Replace these two lines with:

```tsx
const mappingTone: 'ok' | 'error' =
  requiredCount === 0 || requiredMappedCount === requiredCount ? 'ok' : 'error';
const mappingDetail =
  requiredCount === 0 && viewModel.pinTable.length > 0
    ? `${mappedCount}/${viewModel.pinTable.length} mapped`
    : `${requiredMappedCount}/${requiredCount} required`;
```

Then update the mapping gate row object:

```tsx
{ id: 'mapping', label: 'I/O Mapping', tone: mappingTone,
  detail: mappingDetail,
  actionLabel: 'Fix Mapping',
  onAction: () => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
},
```

Also add `mappedCount` and `viewModel.pinTable.length` to the `gateRows` deps array:

```tsx
}, [
  hasVerifyPass,
  verifyResult,
  dirtySinceVerify,
  requiredMappedCount,
  requiredCount,
  mappedCount,
  viewModel.pinTable.length,
  clockDiag,
  hasBlockingErrors,
  diagnosticsList,
  onOpenVerify,
]);
```

### Step 2: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

### Step 3: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx
git commit -m "fix(export): 0/0 required mapping — show mapped/total when no required pins"
```

---

## Task 5: Merge Vivado Sections + Add "Ready for Vivado" Callout

**What:** Collapse the left col's separate "Vivado Import" section and "Vivado Steps" section into a single "Vivado Ready" section. When all gates pass (`!hasBlockingErrors && hasVerifyPass`), show a green top callout: "Ready for Vivado" with board target and import command inline. When blocked, show the condensed step list only.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

---

### Step 1: Replace the two Vivado sections (lines ~937–982)

Find the `ide-export-vivado-import-panel` section and the `ide-export-vivado-checklist` section. Replace both with a single section:

```tsx
<section className="ide-export-section" data-testid="ide-export-vivado-ready">
  <header className="ide-export-section-header">
    <h3>Vivado Ready</h3>
    {!hasBlockingErrors && hasVerifyPass
      ? <IdeStatusPill tone="ok">GO</IdeStatusPill>
      : <IdeStatusPill tone="error">BLOCKED</IdeStatusPill>
    }
  </header>

  {!hasBlockingErrors && hasVerifyPass && (
    <IdeCallout tone="success" title="Ready for Vivado" testId="ide-export-vivado-ready-callout">
      <p className="ide-copy" style={{ margin: '0 0 var(--ide-space-1) 0' }}>
        Board: <code>Basys3</code> · Tool: <code>Vivado 2020.1+</code>
      </p>
      <pre className="ide-export-artifact-code" data-testid="ide-export-vivado-command">
        {vivadoCommand}
      </pre>
      <div className="ide-export-diagnostic-actions">
        <IdeButton
          tone="secondary"
          onClick={() => void copyToClipboard(vivadoCommand, 'command')}
          testId="ide-export-copy-vivado-command"
        >
          Copy command
        </IdeButton>
        <p className="ide-copy" style={{ margin: 0, fontSize: 10 }} data-testid="ide-export-copy-command-state">
          {copyState === 'command' ? 'Copied.' : copyState === 'error' ? 'Clipboard unavailable.' : ''}
        </p>
      </div>
    </IdeCallout>
  )}

  {(hasBlockingErrors || !hasVerifyPass) && (
    <p className="ide-copy ide-export-vivado-blocked-hint" data-testid="ide-export-vivado-command">
      Resolve all gate blockers to unlock Vivado import.
    </p>
  )}

  <ol className="ide-export-checklist">
    <li>Create a Vivado RTL project for Basys3.</li>
    <li>Add <code>top.vhd</code> as a Design Source.</li>
    <li>Add <code>top.xdc</code> as Constraints.</li>
    <li>Add <code>testbench.vhd</code> as Simulation Source only.</li>
    <li>Run synthesis → implementation → bitstream → program.</li>
  </ol>
</section>
```

### Step 2: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

### Step 3: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx
git commit -m "feat(export): merge Vivado sections + Ready for Vivado callout when gates clear"
```

---

## Task 6: Determinism Indicator in Right Column

**What:** Add a small 4-row checklist above the Pack Contents block in the right column. Each row is a boolean check computed from existing state. This surfaces RedByte's core determinism guarantees as visible proof.

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`

---

### Step 1: Add `deterministicChecks` useMemo

Add after the `gateRows` useMemo (around line 224):

```tsx
const deterministicChecks = useMemo(() => [
  {
    id: 'clock',
    label: 'Single clock domain',
    pass: !clockDiag,
  },
  {
    id: 'floating',
    label: 'No floating drivers',
    pass: !diagnosticsList.some((d) => /float/i.test(d.message)),
  },
  {
    id: 'pins',
    label: 'All mapped pins bound',
    pass: requiredMappedCount >= requiredCount && requiredCount > 0 || requiredCount === 0,
  },
  {
    id: 'verify',
    label: 'Verify hash embedded',
    pass: hasVerifyPass,
  },
], [clockDiag, diagnosticsList, requiredMappedCount, requiredCount, hasVerifyPass]);
```

### Step 2: Add determinism indicator JSX in right column

Insert before the `ide-export-artifact-plan` div in the right column (around line 1007):

```tsx
<div className="ide-export-determinism-checks" data-testid="ide-export-determinism-checks">
  <div className="ide-export-determinism-header">DETERMINISM</div>
  {deterministicChecks.map((check) => (
    <div
      key={check.id}
      className={`ide-export-determinism-row ${check.pass ? 'is-pass' : 'is-fail'}`}
      data-testid={`ide-export-determinism-${check.id}`}
    >
      <span className="ide-export-determinism-icon">{check.pass ? '✔' : '✗'}</span>
      <span className="ide-export-determinism-label">{check.label}</span>
    </div>
  ))}
</div>
```

### Step 3: TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

### Step 4: Commit

```bash
git add packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx
git commit -m "feat(export): determinism indicator checklist in right column"
```

---

## Task 7: CSS — All Phase 32 Styles

**What:** Append Phase 32 CSS rules to `ide-root.css`. Six sections (32A–32F).

**Files:**
- Modify: `packages/rb-apps/src/apps/ide/ide-root.css` — append at EOF

---

### Step 1: Append the following CSS block at the end of `ide-root.css`

```css
/* ─── Phase 32A: Rebuild Pipeline Block ──────────────────────────────── */
.ide-export-rebuild-block {
  display: flex;
  flex-direction: column;
  gap: var(--ide-space-2);
  padding: var(--ide-space-3);
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius);
  background: var(--ide-bg-surface);
}

.ide-export-rebuild-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ide-export-rebuild-step {
  display: flex;
  align-items: center;
  gap: var(--ide-space-1);
  font-size: 11px;
  font-family: var(--ide-font-mono);
  color: var(--ide-text-muted);
}

.ide-export-rebuild-step.is-done   { color: var(--ide-green-text, #4ade80); }
.ide-export-rebuild-step.is-error  { color: var(--ide-red-text,   #f87171); }
.ide-export-rebuild-step.is-running { color: var(--ide-text);
  font-weight: 600; }

.ide-export-rebuild-step-icon { width: 28px; flex-shrink: 0; }
.ide-export-rebuild-step-label { flex: 1; }

/* Primary button "earned" glow when ready */
.ide-export-rebuild-block .ide-btn-primary.is-ready {
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.35);
  transition: box-shadow 0.4s ease;
}

/* ─── Phase 32B: Capsule Seal Slab ───────────────────────────────────── */
.ide-export-capsule-slab {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius);
  overflow: hidden;
}

.ide-export-capsule-seal-bar {
  display: flex;
  align-items: center;
  gap: var(--ide-space-1);
  padding: var(--ide-space-2) var(--ide-space-3);
  background: rgba(255,255,255,0.03);
}

.ide-export-capsule-seal-bar.is-sealed   { background: rgba(74, 222, 128, 0.08); }
.ide-export-capsule-seal-bar.is-sealing  { background: rgba(250, 204, 21, 0.06); }
.ide-export-capsule-seal-bar.is-error    { background: rgba(248, 113, 113, 0.07); }
.ide-export-capsule-seal-bar.is-unsealed { background: rgba(255, 255, 255, 0.02); }

.ide-export-capsule-seal-icon {
  font-size: 13px;
  width: 16px;
  flex-shrink: 0;
}

.ide-export-capsule-seal-label {
  font-family: var(--ide-font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ide-text);
}

.ide-export-capsule-seal-bar.is-sealed   .ide-export-capsule-seal-label { color: var(--ide-green-text, #4ade80); }
.ide-export-capsule-seal-bar.is-sealing  .ide-export-capsule-seal-label { color: var(--ide-warn-text,  #facc15); }
.ide-export-capsule-seal-bar.is-error    .ide-export-capsule-seal-label { color: var(--ide-red-text,   #f87171); }
.ide-export-capsule-seal-bar.is-unsealed .ide-export-capsule-seal-label { color: var(--ide-text-muted); }

.ide-export-capsule-payload {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--ide-border);
}

.ide-export-capsule-hint {
  padding: var(--ide-space-2) var(--ide-space-3);
  font-size: 10px;
  color: var(--ide-text-muted);
  margin: 0;
  font-style: italic;
}

/* ─── Phase 32C: Determinism Indicator ───────────────────────────────── */
.ide-export-determinism-checks {
  border: 1px solid var(--ide-border);
  border-radius: var(--ide-radius);
  overflow: hidden;
}

.ide-export-determinism-header {
  padding: 4px var(--ide-space-3);
  font-size: 9px;
  font-family: var(--ide-font-mono);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--ide-text-muted);
  background: rgba(255,255,255,0.025);
  border-bottom: 1px solid var(--ide-border);
  text-transform: uppercase;
}

.ide-export-determinism-row {
  display: grid;
  grid-template-columns: 18px 1fr;
  align-items: center;
  gap: var(--ide-space-1);
  padding: 4px var(--ide-space-3);
  font-size: 11px;
  font-family: var(--ide-font-mono);
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ide-export-determinism-row:last-child { border-bottom: none; }
.ide-export-determinism-row.is-pass { background: rgba(74, 222, 128, 0.04); }
.ide-export-determinism-row.is-fail { background: rgba(248, 113, 113, 0.04); }

.ide-export-determinism-icon {
  font-size: 10px;
  font-weight: 700;
}
.ide-export-determinism-row.is-pass .ide-export-determinism-icon { color: var(--ide-green-text, #4ade80); }
.ide-export-determinism-row.is-fail .ide-export-determinism-icon { color: var(--ide-red-text,   #f87171); }

.ide-export-determinism-label { color: var(--ide-text-dim, var(--ide-text-muted)); }

/* ─── Phase 32D: Vivado Ready Callout ────────────────────────────────── */
.ide-export-vivado-blocked-hint {
  color: var(--ide-text-muted);
  font-style: italic;
  font-size: 12px;
  margin: 0 0 var(--ide-space-2) 0;
}
```

### Step 2: Verify CSS has no obvious parse errors

Open DevTools (or just run the build) and confirm no CSS syntax errors get flagged. Since there's no CSS linter step, just visually scan the block.

### Step 3: Commit

```bash
git add packages/rb-apps/src/apps/ide/ide-root.css
git commit -m "feat(export): Phase 32 CSS (rebuild pipeline, seal slab, determinism, Vivado ready)"
```

---

## Task 8: Final TypeScript + Visual Smoke Check

### Step 1: Full TypeScript check

```bash
npx tsc --noEmit -p packages/rb-apps/tsconfig.json 2>&1 | grep ExportSurface
```

Expected output: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx(366,32): error TS2322: Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BlobPart'.` — and nothing else related to ExportSurface.

### Step 2: Dev server smoke check (if available)

```bash
npm run dev --workspace=packages/rb-apps 2>&1 | head -20
```

Navigate to Export surface. Verify:
1. Right col shows "NOT SEALED" seal bar (grey, `is-unsealed`)
2. Right col shows 4 determinism checks
3. Gate row for mapping shows `N/N mapped` (not `0/0 required`) when no required pins exist
4. "Build Export Pack" button is primary-toned when gates are clear
5. Clicking it shows step list: `[✔]`, `[…]`, `[✗]` feedback
6. After successful build: seal bar turns green `SEALED`, payload rows appear with SIG/VERIFY/EXPORT/PINS/TS
7. Vivado Ready section shows "GO" pill and "Ready for Vivado" callout when passed

### Step 3: Final commit (if any fixups needed)

```bash
git add -A
git commit -m "fix(export): Phase 32 post-smoke fixups"
```

---

## What Phase 32 Does NOT Include (Deferred)

- **Artifact tree view** (rb-export/ visual directory tree) — Phase 33
- **Export Preview Simulation** (Program & Test script preview) — later
- **Console hide in export mode** — minimal, can be done as a 5-line follow-up
- **Right col "Inspector" section** updates — covered by seal slab + determinism checks
