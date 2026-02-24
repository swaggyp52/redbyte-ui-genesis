import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IdeExampleDefinition } from '../examplesCatalog';
import type { RBProject } from '../../../export/projectFormat';
import { stableStringify } from '../../../export/stableStringify';
import type { ProjectHealthExportResult, ProjectHealthVerifyResult } from '../projectHealth';
import { createDiagnosticId, type IdeDiagnostic } from '../diagnostics';
import { buildEvidenceCapsule, type EvidenceManifest } from '../evidenceCapsule';
import type { RuntimeVerifyRun } from '../projectRuntime';
import {
  buildExportViewModel,
  type ExportDiagnosticView,
  type ExportArtifactView,
  type ExportPinStatus,
} from '../viewmodels/buildExportViewModel';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface ExportSurfaceProps {
  project: RBProject;
  verifyResult?: ProjectHealthVerifyResult;
  verifyLastRun?: RuntimeVerifyRun;
  dirtySinceVerify?: boolean;
  determinismHash: string;
  onExportBundle?: (artifacts: ExportArtifactView[]) => void;
  onExportResult?: (result: ProjectHealthExportResult) => void;
  onDiagnosticAction?: (diagnostic: IdeDiagnostic) => void;
  onOpenVerify?: () => void;
  example?: IdeExampleDefinition | null;
  onGoToHardware?: () => void;
  onGoToProject?: () => void;
}

const ARTIFACT_PLAN_FILES = [
  { path: 'top.vhd', desc: 'Design source' },
  { path: 'top.xdc', desc: 'Pin constraints' },
  { path: 'vivado_import.tcl', desc: 'Batch import' },
  { path: 'testbench.vhd', desc: 'Simulation source' },
  { path: 'README.txt', desc: 'Build notes' },
] as const;

// ─── Phase 32: Rebuild Pipeline Types ──────────────────────────────────────
type RebuildStepId =
  | 'validate'
  | 'mapping'
  | 'clock'
  | 'bundle'
  | 'manifest'
  | 'capsule'
  | 'zip';

type RebuildStepState = 'idle' | 'running' | 'done' | 'error' | 'skipped';

interface RebuildStep {
  id: RebuildStepId;
  label: string;
  state: RebuildStepState;
  detail?: string;
}

const STEP_ORDER: Array<{ id: RebuildStepId; label: string }> = [
  { id: 'validate', label: 'Validate inputs' },
  { id: 'mapping',  label: 'Validate I/O mapping' },
  { id: 'clock',    label: 'Validate clock domain' },
  { id: 'bundle',   label: 'Build bundle (sources + constraints)' },
  { id: 'manifest', label: 'Generate manifest' },
  { id: 'capsule',  label: 'Seal evidence capsule' },
  { id: 'zip',      label: 'Package .zip' },
];

function makeSteps(): RebuildStep[] {
  return STEP_ORDER.map((s) => ({ id: s.id, label: s.label, state: 'idle' as const }));
}

/** Yields to the event loop so React can flush intermediate step state. */
function tick(ms = 40): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const ExportSurface: React.FC<ExportSurfaceProps> = ({
  project,
  verifyResult,
  verifyLastRun,
  dirtySinceVerify = false,
  determinismHash,
  onExportBundle,
  onExportResult,
  onDiagnosticAction,
  onOpenVerify,
  example,
  onGoToHardware,
  onGoToProject,
}) => {
  const viewModel = useMemo(
    () => buildExportViewModel(project, verifyLastRun),
    [project, verifyLastRun]
  );
  const evidenceDiagnostics = useMemo(
    () => buildEvidenceDiagnostics(verifyResult, dirtySinceVerify),
    [dirtySinceVerify, verifyResult]
  );
  const diagnosticsList = useMemo(
    () => [...evidenceDiagnostics, ...viewModel.errors, ...viewModel.warnings],
    [evidenceDiagnostics, viewModel.errors, viewModel.warnings]
  );
  const [pinOverrides, setPinOverrides] = useState<Record<string, string>>(() =>
    createPinOverrideMap(viewModel.pinTable)
  );
  const [capsuleManifestHash, setCapsuleManifestHash] = useState<string>('pending');
  const [capsuleBundleHash, setCapsuleBundleHash] = useState<string>('pending');
  const [capsuleFileList, setCapsuleFileList] = useState<string[]>([]);
  const [capsuleBuildError, setCapsuleBuildError] = useState<string>('');
  const [capsuleBuildState, setCapsuleBuildState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [capsuleManifest, setCapsuleManifest] = useState<EvidenceManifest | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'command' | 'report' | 'error'>('idle');
  const [highlightedPort, setHighlightedPort] = useState<string | null>(null);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string>(() => {
    const readme = viewModel.artifacts.find((artifact) => artifact.path.toLowerCase() === 'readme.txt');
    return readme?.path ?? viewModel.artifacts[0]?.path ?? '';
  });
  const [openFixPathId, setOpenFixPathId] = useState<string | null>(null);
  // Phase 32: pipeline rebuild state
  const [rebuildSteps, setRebuildSteps] = useState<RebuildStep[]>(() => makeSteps());
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [capsuleSealState, setCapsuleSealState] = useState<'not_sealed' | 'sealing' | 'sealed'>('not_sealed');
  const [capsuleSealPayload, setCapsuleSealPayload] = useState<{
    sig?: string;
    verifyHash?: string;
    exportHash?: string;
    pins?: string;
    ts?: string;
  }>({});
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const pinInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mapSectionRef = useRef<HTMLElement>(null);
  const highlightResetTimer = useRef<number | null>(null);
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    setPinOverrides(createPinOverrideMap(viewModel.pinTable));
  }, [viewModel.pinTable]);

  useEffect(() => {
    if (viewModel.artifacts.length === 0) {
      setSelectedArtifactPath('');
      return;
    }
    const exists = viewModel.artifacts.some((artifact) => artifact.path === selectedArtifactPath);
    if (!exists) {
      const readme = viewModel.artifacts.find((artifact) => artifact.path.toLowerCase() === 'readme.txt');
      setSelectedArtifactPath(readme?.path ?? viewModel.artifacts[0].path);
    }
  }, [viewModel.artifacts, selectedArtifactPath]);

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(highlightResetTimer.current);
      }
      if (copyResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const mappingIndex = useMemo(() => {
    const index = new Map<string, (typeof viewModel.pinTable)[number]>();
    for (const row of viewModel.pinTable) {
      index.set(toPortKey(row.port), row);
    }
    return index;
  }, [viewModel.pinTable]);

  const hasBlockingErrors = diagnosticsList.some((entry) => entry.severity === 'error');
  const hasVerifyPass = verifyResult?.status === 'pass' && !dirtySinceVerify;
  const mappedCount = viewModel.pinTable.filter((row) => {
    const key = toPortKey(row.port);
    const pinValue = (pinOverrides[key] ?? '').trim();
    return row.status !== 'unused' && pinValue.length > 0;
  }).length;
  const requiredCount = viewModel.pinTable.filter((r) => r.required).length;
  const requiredMappedCount = viewModel.pinTable.filter((r) => {
    if (!r.required) return false;
    return (pinOverrides[toPortKey(r.port)] ?? '').trim().length > 0;
  }).length;
  const clockDiag = diagnosticsList.find((d) => /clock/i.test(d.message));
  const artifactMap = useMemo(
    () => new Map(viewModel.artifacts.map((a) => [a.path.toLowerCase(), a])),
    [viewModel.artifacts]
  );
  const applySuggestionCount = useMemo(
    () =>
      viewModel.pinTable.filter(
        (r) => r.suggestedPin && (pinOverrides[toPortKey(r.port)] ?? '').trim().length === 0
      ).length,
    [viewModel.pinTable, pinOverrides]
  );

  // Version constants — defined here so handleBuildEvidenceCapsule can reference them
  // before the gateRows useMemo that depends on handleBuildEvidenceCapsule.
  const appEnv = (import.meta as ImportMeta & {
    env?: { VITE_APP_VERSION?: string; VITE_GIT_SHA?: string };
  }).env;
  const redbyteVersion = (appEnv?.VITE_APP_VERSION ?? 'dev').trim() || 'dev';
  const redbyteCommit = (appEnv?.VITE_GIT_SHA ?? 'local').trim() || 'local';

  // Must be defined before gateRows useMemo because gateRows references it in
  // the Evidence Capsule gate's onAction. Defining it after gateRows causes a
  // temporal dead zone ReferenceError on first render.
  const handleBuildEvidenceCapsule = useCallback(async () => {
    const ranAtIso = new Date().toISOString();
    setCapsuleBuildError('');
    setCapsuleBuildState('running');
    setCapsuleManifest(null);
    if (hasBlockingErrors) {
      setCapsuleBuildError('Resolve blocking diagnostics before building an evidence capsule.');
      setCapsuleBuildState('error');
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((artifact) => artifact.path),
        ranAtIso,
      });
      return;
    }
    if (!verifyResult || verifyResult.status !== 'pass' || dirtySinceVerify) {
      setCapsuleBuildError('Evidence Capsule requires a PASS verification with no pending design changes.');
      setCapsuleBuildState('error');
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((artifact) => artifact.path),
        ranAtIso,
      });
      return;
    }

    try {
      const capsule = await buildEvidenceCapsule({
        project,
        exportViewModel: viewModel,
        verifyResult,
        deterministicHash: determinismHash,
        toolVersion: redbyteVersion,
        toolCommit: redbyteCommit,
        createdAtIso: ranAtIso,
      });
      if (typeof window !== 'undefined') {
        const blob = new Blob([capsule.zipBytes as BlobPart], { type: 'application/zip' });
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
      setCapsuleBuildError(
        `Evidence Capsule build failed: ${reason}. Check export diagnostics and artifact readiness.`
      );
      setCapsuleBuildState('error');
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((artifact) => artifact.path),
        ranAtIso,
      });
    }
  }, [
    hasBlockingErrors, viewModel, verifyResult, dirtySinceVerify,
    determinismHash, redbyteVersion, redbyteCommit,
    project, onExportResult, onExportBundle,
    setCapsuleBuildError, setCapsuleBuildState, setCapsuleManifest,
    setCapsuleManifestHash, setCapsuleBundleHash, setCapsuleFileList,
  ]);

  const gateRows = useMemo(() => {
    const verifyTone = hasVerifyPass
      ? 'ok' as const
      : verifyResult?.status === 'pass' && dirtySinceVerify
        ? 'warn' as const
        : verifyResult
          ? 'error' as const
          : 'idle' as const;
    const verifyDetail = hasVerifyPass
      ? `PASS · ${verifyResult?.hash?.slice(0, 8) ?? ''}`
      : verifyResult?.status === 'pass' && dirtySinceVerify
        ? 'Dirty'
        : verifyResult
          ? typeof verifyResult.failingTick === 'number'
            ? `FAIL · t${verifyResult.failingTick}`
            : 'FAIL'
          : 'No run';
    const mappingTone: 'ok' | 'error' =
      requiredCount === 0 || requiredMappedCount === requiredCount ? 'ok' : 'error';
    const mappingDetail =
      requiredCount === 0 && viewModel.pinTable.length > 0
        ? `${mappedCount}/${viewModel.pinTable.length} mapped`
        : `${requiredMappedCount}/${requiredCount} required`;
    const clockTone = clockDiag ? 'error' as const : 'ok' as const;
    const capsuleTone = !hasBlockingErrors && hasVerifyPass ? 'ok' as const : 'error' as const;
    const gateBlockCount = diagnosticsList.filter((d) => d.severity === 'error').length;
    return [
      {
        id: 'verify',
        label: 'Verify',
        tone: verifyTone,
        detail: verifyDetail,
        actionLabel: verifyResult ? 'Re-run' : 'Run Verify',
        onAction: onOpenVerify ?? undefined,
      },
      {
        id: 'mapping',
        label: 'I/O Mapping',
        tone: mappingTone,
        detail: mappingDetail,
        actionLabel: 'Fix Mapping',
        onAction: () => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      },
      {
        id: 'clock',
        label: 'Clock Domain',
        tone: clockTone,
        detail: clockDiag ? clockDiag.message.slice(0, 55) : 'Single domain',
        actionLabel: 'Details',
        onAction: clockDiag
          ? () => setOpenFixPathId((prev) => (prev === clockDiag.id ? null : clockDiag.id))
          : undefined,
      },
      {
        id: 'capsule',
        label: 'Evidence Capsule',
        tone: capsuleTone,
        detail:
          capsuleTone === 'ok'
            ? 'Ready to build'
            : `${gateBlockCount} gate block${gateBlockCount !== 1 ? 's' : ''}`,
        actionLabel: 'Download',
        onAction: capsuleTone === 'ok' ? handleBuildEvidenceCapsule : undefined,
      },
    ];
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
    handleBuildEvidenceCapsule,
  ]);

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
      pass: requiredCount === 0 || requiredMappedCount >= requiredCount,
    },
    {
      id: 'verify',
      label: 'Verify hash embedded',
      pass: hasVerifyPass,
    },
  ], [clockDiag, diagnosticsList, requiredMappedCount, requiredCount, hasVerifyPass]);
  const selectedArtifact =
    viewModel.artifacts.find((artifact) => artifact.path === selectedArtifactPath) ??
    viewModel.artifacts[0];
  const vivadoCommand =
    'vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log';
  const quickDebugReport = useMemo(() => {
    const mappingLines = [...viewModel.pinTable]
      .map((row) => {
        const portKey = toPortKey(row.port);
        const pinValue = (pinOverrides[portKey] ?? row.pin ?? '').trim();
        const resolvedPin = pinValue.length > 0 ? pinValue : 'UNMAPPED';
        const requiredTag = row.required ? ' required' : ' optional';
        return `${row.port} (${row.direction}, ${row.status}${requiredTag}) -> ${resolvedPin}`;
      })
      .sort((left, right) => left.localeCompare(right));

    const manifestBlock = capsuleManifest ? stableStringify(capsuleManifest) : 'pending';

    return [
      'RedByte Vivado Quick Debug Report',
      `project=${project.name}`,
      `board=basys3`,
      `redbyteVersion=${redbyteVersion}`,
      `redbyteCommit=${redbyteCommit}`,
      `exportHash=${viewModel.exportHash ?? 'pending'}`,
      `verifyHash=${verifyResult?.hash ?? 'pending'}`,
      `manifestHash=${capsuleManifestHash}`,
      `bundleHash=${capsuleBundleHash}`,
      '',
      'mapping:',
      ...mappingLines,
      '',
      'manifest:',
      manifestBlock,
    ].join('\n');
  }, [
    capsuleBundleHash,
    capsuleManifest,
    capsuleManifestHash,
    pinOverrides,
    project.name,
    redbyteCommit,
    redbyteVersion,
    verifyResult?.hash,
    viewModel.exportHash,
    viewModel.pinTable,
  ]);
  const jumpToMapping = (portKey: string) => {
    const row = rowRefs.current[portKey];
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedPort(portKey);
    if (highlightResetTimer.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(highlightResetTimer.current);
    }
    if (typeof window !== 'undefined') {
      highlightResetTimer.current = window.setTimeout(() => {
        setHighlightedPort(null);
      }, 1200);
    }
    pinInputRefs.current[portKey]?.focus();
  };

  const applySuggestion = (portKey: string) => {
    const row = mappingIndex.get(portKey);
    if (!row?.suggestedPin) return;
    setPinOverrides((prev) => ({
      ...prev,
      [portKey]: row.suggestedPin ?? '',
    }));
    jumpToMapping(portKey);
  };

  const applyAllSuggestions = () => {
    setPinOverrides((prev) => {
      const next = { ...prev };
      for (const row of viewModel.pinTable) {
        if (!row.suggestedPin) continue;
        const key = toPortKey(row.port);
        if ((next[key] ?? '').trim().length === 0) next[key] = row.suggestedPin;
      }
      return next;
    });
  };

  // ─── Phase 32: Pipeline helpers ────────────────────────────────────────────
  const markStep = useCallback((id: RebuildStepId, state: RebuildStepState, detail?: string) => {
    setRebuildSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, state, detail } : s))
    );
  }, []);

  const resetSteps = useCallback(() => {
    setRebuildSteps(makeSteps());
    setIsRebuilding(false);
    setCapsuleSealState('not_sealed');
    setCapsuleSealPayload({});
  }, []);

  const handleRebuildExport = useCallback(async () => {
    setIsRebuilding(true);
    resetSteps();
    setCapsuleBuildError('');
    const ranAtIso = new Date().toISOString();

    // re-init steps
    setRebuildSteps(makeSteps());

    try {
      // STEP: validate — check blocking diagnostics
      markStep('validate', 'running');
      await tick();
      if (hasBlockingErrors) {
        markStep('validate', 'error', 'Blocking diagnostics present');
        setCapsuleBuildError('Resolve blocking diagnostics before building an evidence capsule.');
        setCapsuleBuildState('error');
        setIsRebuilding(false);
        return;
      }
      markStep('validate', 'done');

      // STEP: mapping — check required pins covered
      markStep('mapping', 'running');
      await tick();
      if (requiredMappedCount < requiredCount) {
        markStep('mapping', 'error', `${requiredCount - requiredMappedCount} required pin${requiredCount - requiredMappedCount !== 1 ? 's' : ''} unmapped`);
        setCapsuleBuildError(`${requiredCount - requiredMappedCount} required pin${requiredCount - requiredMappedCount !== 1 ? 's' : ''} unmapped.`);
        setCapsuleBuildState('error');
        setIsRebuilding(false);
        return;
      }
      markStep('mapping', 'done');

      // STEP: clock — check verify pass
      markStep('clock', 'running');
      await tick();
      if (!verifyResult || verifyResult.status !== 'pass' || dirtySinceVerify) {
        markStep('clock', 'error', 'Verify PASS required');
        setCapsuleBuildError('Evidence Capsule requires a PASS verification with no pending design changes.');
        setCapsuleBuildState('error');
        setIsRebuilding(false);
        return;
      }
      markStep('clock', 'done');

      // STEPS: bundle + manifest run together inside buildEvidenceCapsule
      markStep('bundle', 'running');
      markStep('manifest', 'running');
      setCapsuleBuildState('running');
      setCapsuleManifest(null);

      const capsule = await buildEvidenceCapsule({
        project,
        exportViewModel: viewModel,
        verifyResult,
        deterministicHash: determinismHash,
        toolVersion: redbyteVersion,
        toolCommit: redbyteCommit,
        createdAtIso: ranAtIso,
      });

      markStep('bundle', 'done');
      markStep('manifest', 'done');

      // STEP: seal capsule
      markStep('capsule', 'running');
      setCapsuleSealState('sealing');
      await tick(80);
      setCapsuleManifestHash(capsule.manifest.manifestHash);
      setCapsuleBundleHash(capsule.bundleHash);
      setCapsuleFileList(capsule.filePaths);
      setCapsuleManifest(capsule.manifest);
      setCapsuleSealState('sealed');
      setCapsuleSealPayload({
        sig:        capsule.manifest.manifestHash.slice(0, 12),
        verifyHash: capsule.manifest.hashes.verifyHash.slice(0, 12),
        exportHash: (capsule.manifest.hashes.exportHash ?? '').slice(0, 12) || 'n/a',
        pins:       String(capsule.manifest.mappingSummary.length),
        ts:         ranAtIso.slice(0, 19).replace('T', ' '),
      });
      markStep('capsule', 'done');

      // STEP: zip — download
      markStep('zip', 'running');
      if (typeof window !== 'undefined') {
        const blob = new Blob([capsule.zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'redbyte-evidence-capsule.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      }
      markStep('zip', 'done');
      setCapsuleBuildState('done');

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
      setCapsuleSealState('not_sealed');
      setRebuildSteps((prev) =>
        prev.map((s) => (s.state === 'running' ? { ...s, state: 'error', detail: reason } : s))
      );
      onExportResult?.({
        status: 'blocked',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((a) => a.path),
        ranAtIso,
      });
    } finally {
      setIsRebuilding(false);
    }
  }, [
    resetSteps, markStep, hasBlockingErrors, requiredMappedCount, requiredCount,
    verifyResult, dirtySinceVerify, project, viewModel, determinismHash,
    redbyteVersion, redbyteCommit, onExportBundle, onExportResult,
  ]);

  const handleDownloadArtifact = (artifact: ExportArtifactView) => {
    if (typeof window === 'undefined' || artifact.content.trim().length === 0) return;
    const blob = new Blob([artifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.path;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copyToClipboard = async (payload: string, target: 'command' | 'report') => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState(target);
      if (copyResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyResetTimer.current);
      }
      if (typeof window !== 'undefined') {
        copyResetTimer.current = window.setTimeout(() => setCopyState('idle'), 1600);
      }
    } catch {
      setCopyState('error');
    }
  };

  return (
    <IdeSurfaceLayout
      mode="export"
      consoleHasBlocking={hasBlockingErrors}
      consoleHasEntries={
        diagnosticsList.length > 0 || capsuleBuildState === 'error' || capsuleBuildState === 'done'
      }
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-export-checks-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Export</h3>
            <IdeStatusPill tone={hasBlockingErrors ? 'error' : 'ok'}>
              {hasBlockingErrors ? 'BLOCKED' : 'READY'}
            </IdeStatusPill>
          </header>
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Errors</span>
              <span>{diagnosticsList.filter((d) => d.severity === 'error').length}</span>
            </div>
            <div className="ide-kv-row">
              <span>Warnings</span>
              <span>{diagnosticsList.filter((d) => d.severity === 'warning').length}</span>
            </div>
          </div>
          <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
            <IdeButton
              tone={hasBlockingErrors ? 'secondary' : 'primary'}
              onClick={() => void handleRebuildExport()}
              disabled={hasBlockingErrors || isRebuilding}
              testId="ide-export-dock-download"
            >
              {isRebuilding ? 'Building…' : 'Build Export Pack'}
            </IdeButton>
          </div>
          <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
            {onGoToHardware && (
              <IdeButton
                tone="secondary"
                onClick={onGoToHardware}
                testId="ide-export-go-hardware"
              >
                Back to Hardware
              </IdeButton>
            )}
            {onGoToProject && (
              <IdeButton tone="secondary" onClick={onGoToProject} testId="ide-export-go-project">
                Go to Project
              </IdeButton>
            )}
          </div>
        </section>
      }
      inspector={
        <>
          {/* Kit sections — only when showcase kit is loaded */}
          {example?.category === 'showcase' && (
            <>
              <IdeInspectorSection title="Kit Summary" defaultOpen testId="ide-export-kit-summary">
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Name</span>
                    <span style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>{example.name}</span>
                  </div>
                  {example.expectedBehavior && (
                    <div className="ide-kv-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--ide-space-1)' }}>
                      <span>Expected</span>
                      <p className="ide-copy" style={{ margin: 0, fontSize: 'var(--rb-font-size-1)' }}>{example.expectedBehavior}</p>
                    </div>
                  )}
                </div>
              </IdeInspectorSection>

              {(example.goals?.length ?? 0) > 0 && (
                <IdeInspectorSection title="Export Goals" defaultOpen={false} testId="ide-export-kit-goals">
                  <ul style={{ margin: 0, paddingLeft: 'var(--ide-space-4)', display: 'grid', gap: 'var(--ide-space-1)' }}>
                    {(example.goals ?? []).slice(0, 6).map((g) => (
                      <li key={g} className="ide-copy" style={{ margin: 0, fontSize: 'var(--rb-font-size-1)' }}>{g}</li>
                    ))}
                  </ul>
                </IdeInspectorSection>
              )}
            </>
          )}

          <IdeInspectorSection title="Export Context" defaultOpen>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Board</span>
                <span>Basys3</span>
              </div>
              <div className="ide-kv-row">
                <span>Export Hash</span>
                <span className="ide-status-mono" data-testid="ide-export-context-export-hash">
                  {viewModel.exportHash ? viewModel.exportHash.slice(0, 16) : 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Verify Hash</span>
                <span className="ide-status-mono" data-testid="ide-export-context-verify-hash">
                  {verifyResult?.hash ? verifyResult.hash.slice(0, 16) : 'pending'}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Manifest Hash</span>
                <span className="ide-status-mono" data-testid="ide-export-context-manifest-hash">
                  {capsuleManifestHash.slice(0, 16)}
                </span>
              </div>
              <div className="ide-kv-row">
                <span>Bundle Hash</span>
                <span className="ide-status-mono">{capsuleBundleHash.slice(0, 16)}</span>
              </div>
              <div className="ide-kv-row">
                <span>Blocking Errors</span>
                <span>{diagnosticsList.filter((entry) => entry.severity === 'error').length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Capsule Files</span>
                <span>{capsuleFileList.length > 0 ? capsuleFileList.length : 'pending'}</span>
              </div>
              <div className="ide-kv-row" data-testid="ide-export-capsule-build-state">
                <span>Capsule State</span>
                <span>{capsuleBuildState.toUpperCase()}</span>
              </div>
              <div className="ide-kv-row ide-kv-row-hidden" data-testid="ide-export-capsule-files">
                <span>Capsule File List</span>
                <code>{capsuleFileList.join(',')}</code>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Artifact Checklist" defaultOpen={false}>
            <div className="ide-export-artifact-list">
              {viewModel.artifacts.map((artifact) => (
                <div key={artifact.path} className="ide-export-artifact-row">
                  <div>
                    <div className="ide-export-artifact-name">{artifact.path}</div>
                    <div className="ide-export-artifact-note">{artifact.note}</div>
                  </div>
                  <IdeStatusPill
                    tone={
                      artifact.status === 'ready'
                        ? 'ok'
                        : artifact.status === 'blocked'
                          ? 'error'
                          : 'warn'
                    }
                  >
                    {artifact.status === 'ready'
                      ? 'Ready'
                      : artifact.status === 'blocked'
                        ? 'Blocked'
                        : 'Pending'}
                  </IdeStatusPill>
                </div>
              ))}
            </div>
          </IdeInspectorSection>
        </>
      }
    >
      <IdePanel
          title={hasBlockingErrors ? 'Export Blocked' : 'Export Ready'}
          description="Compiler output in three steps: status, blockers, and deterministic Vivado-ready artifacts."
          actions={
            <>
              <span data-testid="ide-primary-cta">
                <IdeButton
                  tone="primary"
                  onClick={() => void handleRebuildExport()}
                  disabled={hasBlockingErrors || isRebuilding}
                >
                  {isRebuilding ? 'Building…' : capsuleBuildState === 'done' ? 'Rebuild Export' : 'Build Export Pack'}
                </IdeButton>
              </span>
            </>
          }
          right={
            hasBlockingErrors ? (
              <IdeStatusPill tone="error">Blocked</IdeStatusPill>
            ) : (
              <IdeStatusPill tone="ok">Ready</IdeStatusPill>
            )
          }
          testId="ide-export-panel"
        >
          <div className="ide-export-gate-stack" data-testid="ide-export-gate-stack">
            {gateRows.map((gate) => (
              <div
                key={gate.id}
                className={`ide-export-gate-row ${
                  gate.tone === 'ok' ? 'is-pass' : gate.tone === 'idle' ? 'is-unrun' : 'is-fail'
                }`}
                data-testid={`ide-export-gate-${gate.id}`}
              >
                <IdeStatusPill tone={gate.tone}>
                  {gate.tone === 'ok'
                    ? 'PASS'
                    : gate.tone === 'warn'
                      ? 'DIRTY'
                      : gate.tone === 'idle'
                        ? 'UNRUN'
                        : 'FAIL'}
                </IdeStatusPill>
                <span className="ide-export-gate-label">{gate.label}</span>
                <span className="ide-export-gate-detail">{gate.detail}</span>
                {gate.onAction && (
                  <IdeButton
                    tone="ghost"
                    onClick={gate.onAction}
                    testId={`ide-export-gate-action-${gate.id}`}
                  >
                    {gate.actionLabel}
                  </IdeButton>
                )}
              </div>
            ))}
          </div>
          <div className="ide-export-layout">
            <div className="ide-export-left-col">

              <section className="ide-export-section" data-testid="ide-export-build-output">
                <header className="ide-export-section-header">
                  <h3>Blockers</h3>
                  <span className="ide-export-section-meta">
                    {diagnosticsList.length} diagnostics
                  </span>
                </header>

                {hasBlockingErrors && (
                  <IdeCallout
                    tone="error"
                    title={`${diagnosticsList.filter((d) => d.severity === 'error').length} blocker${diagnosticsList.filter((d) => d.severity === 'error').length !== 1 ? 's' : ''} — export unavailable`}
                    testId="ide-export-blockers-callout"
                  >
                    <p className="ide-copy" style={{ margin: 0 }}>Resolve all mapping and verification issues before downloading.</p>
                    <div style={{ marginTop: 'var(--ide-space-2)', display: 'flex', gap: 'var(--ide-space-2)', flexWrap: 'wrap' }}>
                      {onGoToProject && (
                        <IdeButton tone="secondary" onClick={onGoToProject} testId="ide-export-go-project">
                          Fix in Project
                        </IdeButton>
                      )}
                      {onOpenVerify && diagnosticsList.length > 0 && (
                        <IdeButton tone="secondary" onClick={onOpenVerify} testId="ide-export-go-verify">
                          Re-run Verify
                        </IdeButton>
                      )}
                    </div>
                  </IdeCallout>
                )}

                {capsuleBuildError.length > 0 && (
                  <IdeCallout tone="error" title="Capsule Build Error" testId="ide-export-capsule-error">
                    {capsuleBuildError}
                  </IdeCallout>
                )}

                {!hasBlockingErrors && diagnosticsList.length === 0 && (
                  <IdeCallout tone="success" title="No blockers">
                    Export checks passed.
                  </IdeCallout>
                )}

                <div className="ide-export-diagnostic-list" data-testid="ide-export-blockers-list">
                  {diagnosticsList.map((entry) => {
                    const portKey = entry.port ? toPortKey(entry.port) : undefined;
                    const mappingRow = portKey ? mappingIndex.get(portKey) : undefined;
                    const hasSuggestion =
                      Boolean(mappingRow?.suggestedPin) &&
                      (pinOverrides[portKey ?? ''] ?? '').trim().length === 0;

                    return (
                      <article
                        key={entry.id}
                        className={`ide-export-diagnostic-row ${
                          entry.severity === 'error' ? 'is-error' : 'is-warning'
                        }`}
                        data-testid={`ide-export-diagnostic-${entry.id}`}
                      >
                        <div className="ide-export-diagnostic-meta">
                          <IdeStatusPill tone={entry.severity === 'error' ? 'error' : 'warn'}>
                            {entry.severity === 'error' ? 'ERROR' : 'WARN'}
                          </IdeStatusPill>
                          <code className="ide-export-diagnostic-code" data-diagnostic-code={entry.code}>
                            {entry.code}
                          </code>
                        </div>
                        <p className="ide-export-diagnostic-message">{entry.message}</p>
                        <div className="ide-export-diagnostic-actions">
                          <IdeButton
                            tone="secondary"
                            onClick={() =>
                              setOpenFixPathId((prev) => (prev === entry.id ? null : entry.id))
                            }
                            testId={`ide-export-diagnostic-action-${entry.id}`}
                          >
                            {openFixPathId === entry.id ? 'Hide ▲' : 'Fix path ▼'}
                          </IdeButton>
                          {mappingRow && portKey && hasSuggestion && (
                            <IdeButton tone="ghost" onClick={() => applySuggestion(portKey)}>
                              Auto-suggest
                            </IdeButton>
                          )}
                        </div>
                        {openFixPathId === entry.id && (
                          <div
                            className="ide-export-fixpath-drawer"
                            data-testid={`ide-export-fixpath-${entry.id}`}
                          >
                            <p className="ide-export-fixpath-cause">{entry.message}</p>
                            <ul className="ide-export-fixpath-steps">
                              {(entry.hint ?? []).map((h, i) => (
                                <li key={i} className="ide-export-fixpath-step">{h}</li>
                              ))}
                            </ul>
                            <div className="ide-inline-actions">
                              {(entry.actions ?? []).map((action) => (
                                <IdeButton
                                  key={action.label}
                                  tone="secondary"
                                  onClick={() => onDiagnosticAction?.(entry.canonical)}
                                >
                                  {action.label}
                                </IdeButton>
                              ))}
                              {portKey && mappingRow && (
                                <IdeButton
                                  tone="ghost"
                                  onClick={() => jumpToMapping(portKey)}
                                >
                                  Jump to mapping
                                </IdeButton>
                              )}
                              {portKey && mappingRow && hasSuggestion && (
                                <IdeButton tone="ghost" onClick={() => applySuggestion(portKey)}>
                                  Apply suggestion
                                </IdeButton>
                              )}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>

              <section
                ref={mapSectionRef}
                className="ide-export-section"
                data-testid="ide-export-mapping-table"
              >
                <header className="ide-export-section-header">
                  <h3>I/O Mapping Table</h3>
                  <span className="ide-export-section-meta">
                    {mappedCount}/{viewModel.pinTable.length} mapped
                  </span>
                </header>
                {applySuggestionCount > 0 && (
                  <div className="ide-inline-actions" style={{ marginBottom: 'var(--ide-space-1)' }}>
                    <IdeButton
                      tone="ghost"
                      onClick={applyAllSuggestions}
                      testId="ide-export-apply-suggestions"
                    >
                      Apply {applySuggestionCount} suggestion{applySuggestionCount !== 1 ? 's' : ''}
                    </IdeButton>
                  </div>
                )}
                <div className="ide-table-wrap ide-export-table-wrap">
                  <table className="ide-table ide-export-table">
                    <thead>
                      <tr>
                        <th>Port</th>
                        <th>Direction</th>
                        <th>Bound Pin</th>
                        <th>Status</th>
                        <th>Conf</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewModel.pinTable.map((row) => {
                        const portKey = toPortKey(row.port);
                        const pinValue = pinOverrides[portKey] ?? '';
                        const status = resolveRowStatus(row.status, pinValue);
                        const conf = getPinConfidence(row.suggestedPin, pinValue);
                        return (
                          <tr
                            key={row.port}
                            ref={(node) => {
                              rowRefs.current[portKey] = node;
                            }}
                            className={highlightedPort === portKey ? 'ide-export-row-highlight' : undefined}
                            data-testid={`ide-export-map-row-${portKey}`}
                          >
                            <td>
                              <div className="ide-export-port-cell">
                                <code>{row.port}</code>
                                {row.required && <span className="ide-export-required-tag">Required</span>}
                              </div>
                            </td>
                            <td>
                              <span className={`ide-export-direction ide-export-direction-${row.direction}`}>
                                {row.direction === 'in' ? 'IN' : row.direction === 'out' ? 'OUT' : 'INOUT'}
                              </span>
                            </td>
                            <td>
                              <input
                                ref={(node) => {
                                  pinInputRefs.current[portKey] = node;
                                }}
                                className="ide-export-pin-input"
                                value={pinValue}
                                onChange={(event) =>
                                  setPinOverrides((prev) => ({
                                    ...prev,
                                    [portKey]: event.target.value.toUpperCase(),
                                  }))
                                }
                                placeholder={row.suggestedPin ?? 'PIN'}
                              />
                            </td>
                            <td>
                              <IdeStatusPill tone={statusTone(status)}>
                                {status === 'mapped'
                                  ? 'Mapped'
                                  : status === 'missing'
                                    ? 'Missing'
                                    : 'Unused'}
                              </IdeStatusPill>
                            </td>
                            <td>
                              <span className={`ide-export-conf-badge ide-export-conf-${conf}`}>
                                {conf === 'exact' ? '✓' : conf === 'likely' ? '~' : '?'}
                              </span>
                            </td>
                            <td className="ide-export-notes-cell">
                              {row.notes && <div>{row.notes}</div>}
                              {row.suggestedPin && (
                                <div className="ide-export-suggestion">Suggested: {row.suggestedPin}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ide-export-section" data-testid="ide-export-artifact-preview">
                <header className="ide-export-section-header">
                  <h3>Outputs</h3>
                  <span className="ide-export-section-meta">
                    {viewModel.artifacts.length} files
                  </span>
                </header>

                {viewModel.artifacts.length === 0 && (
                  <div className="ide-empty-stack" data-testid="ide-export-empty-state">
                    <IdeCallout tone="warn" title="No artifact data">
                      Artifact previews appear after a successful export build.
                    </IdeCallout>
                  </div>
                )}

                {viewModel.artifacts.length > 0 && (
                  <>
                    <div className="ide-export-artifact-tabs">
                      {viewModel.artifacts.map((artifact) => (
                        <button
                          key={artifact.path}
                          type="button"
                          className={`ide-export-artifact-tab ${
                            selectedArtifact?.path === artifact.path ? 'is-active' : ''
                          }`}
                          onClick={() => setSelectedArtifactPath(artifact.path)}
                        >
                          {artifact.path}
                        </button>
                      ))}
                    </div>
                    {selectedArtifact && (
                      <div className="ide-export-artifact-preview">
                        <div className="ide-export-artifact-preview-header">
                          <span data-testid="ide-export-preview-path">{selectedArtifact.path}</span>
                          <IdeButton
                            tone="secondary"
                            onClick={() => handleDownloadArtifact(selectedArtifact)}
                            disabled={selectedArtifact.preview.trim().length === 0}
                          >
                            Download
                          </IdeButton>
                        </div>
                        {selectedArtifact.preview.trim().length > 0 ? (
                          <pre className="ide-export-artifact-code">{selectedArtifact.preview}</pre>
                        ) : (
                          <p className="ide-export-artifact-empty">
                            Artifact content unavailable until export validation passes.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="ide-export-section" data-testid="ide-export-vivado-ready">
                <header className="ide-export-section-header">
                  <h3>Vivado Ready</h3>
                  {!hasBlockingErrors && hasVerifyPass
                    ? <IdeStatusPill tone="ok">GO</IdeStatusPill>
                    : <IdeStatusPill tone="error">BLOCKED</IdeStatusPill>
                  }
                </header>

                {!hasBlockingErrors && hasVerifyPass ? (
                  <IdeCallout tone="success" title="Ready for Vivado" testId="ide-export-vivado-ready-callout">
                    <p className="ide-copy" style={{ margin: '0 0 var(--ide-space-1) 0' }}>
                      Board: <code>Basys3</code> · Tool: <code>Vivado 2020.1+</code>
                    </p>
                    <pre
                      className="ide-export-artifact-code ide-export-readme-code"
                      data-testid="ide-export-vivado-command"
                    >
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
                    </div>
                    <p className="ide-copy" style={{ margin: 0, fontSize: 10 }} data-testid="ide-export-copy-command-state">
                      {copyState === 'command' ? 'Copied.' : copyState === 'error' ? 'Clipboard unavailable.' : ''}
                    </p>
                  </IdeCallout>
                ) : (
                  <p
                    className="ide-copy ide-export-vivado-blocked-hint"
                    data-testid="ide-export-vivado-command"
                  >
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

            </div>

            <div className="ide-export-right-col">

              <div className="ide-export-buildCard" data-testid="ide-export-download-block">
                <div className="ide-export-buildCardTop">
                  <span className="ide-export-buildTitle">Export Pack</span>
                  <span data-testid="ide-primary-cta">
                    <IdeButton
                      tone={hasBlockingErrors ? 'secondary' : 'primary'}
                      onClick={() => void handleRebuildExport()}
                      disabled={hasBlockingErrors || isRebuilding}
                      testId="ide-export-rebuild-btn"
                    >
                      {isRebuilding ? 'Building…' : capsuleBuildState === 'done' ? 'Rebuild Export' : 'Build Export Pack'}
                    </IdeButton>
                  </span>
                </div>
                {hasBlockingErrors && (
                  <span
                    className="ide-export-download-gate-note"
                    data-testid="ide-export-download-gate-note"
                  >
                    {gateRows.find((g) => g.tone === 'error' || g.tone === 'warn')?.label ?? 'blockers'} must pass
                  </span>
                )}
                {rebuildSteps.some((s) => s.state !== 'idle') && (
                  <ol className="ide-export-buildSteps" data-testid="ide-export-rebuild-steps">
                    {rebuildSteps.map((s) => (
                      <li
                        key={s.id}
                        className={`ide-export-step ide-export-step--${s.state}`}
                        data-testid={`ide-export-rebuild-step-${s.id}`}
                      >
                        <span className="ide-export-stepMark">
                          {s.state === 'done'    ? '[✔]'
                         : s.state === 'running' ? '[…]'
                         : s.state === 'error'   ? '[✗]'
                         : s.state === 'skipped' ? '[—]'
                         :                         '[ ]'}
                        </span>
                        <span className="ide-export-stepLabel">{s.label}</span>
                        {s.detail && <span className="ide-export-stepDetail">{s.detail}</span>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="ide-export-determinismChecks" data-testid="ide-export-determinism-checks">
                <div className="ide-export-determinismHeader">DETERMINISM</div>
                {deterministicChecks.map((check) => (
                  <div
                    key={check.id}
                    className={`ide-export-determinismRow ${check.pass ? 'is-pass' : 'is-fail'}`}
                    data-testid={`ide-export-determinism-${check.id}`}
                  >
                    <span className="ide-export-determinismIcon">{check.pass ? '✔' : '✗'}</span>
                    <span className="ide-export-determinismLabel">{check.label}</span>
                  </div>
                ))}
              </div>

              <div className="ide-export-artifact-plan" data-testid="ide-export-artifact-plan">
                <div className="ide-export-artifact-plan-header">
                  <span className="ide-export-artifact-plan-title">PACK CONTENTS</span>
                  <span style={{ fontSize: 10, color: 'var(--ide-text-muted)' }}>
                    {viewModel.artifacts.length}/5 ready
                  </span>
                </div>
                {ARTIFACT_PLAN_FILES.map((file) => {
                  const artifactEntry = artifactMap.get(file.path.toLowerCase());
                  const isReady = artifactEntry?.status === 'ready';
                  return (
                    <div
                      key={file.path}
                      className={`ide-export-artifact-plan-row ${isReady ? 'is-ready' : 'is-pending'}`}
                    >
                      <span className="ide-export-plan-row-icon">{isReady ? '✓' : '○'}</span>
                      <div className="ide-export-plan-row-info">
                        <span className="ide-export-plan-row-path">{file.path}</span>
                        <span className="ide-export-plan-row-desc">
                          {!isReady && artifactEntry?.note ? artifactEntry.note : file.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ide-export-capsuleSlab" data-testid="ide-export-capsule-slab">
                <div
                  className={`ide-export-capsuleTop ide-export-capsuleState--${capsuleSealState}`}
                  data-testid="ide-export-seal-bar"
                >
                  <span className="ide-export-capsuleSealIcon">
                    {capsuleSealState === 'sealed' ? '◉' : capsuleSealState === 'sealing' ? '◌' : '○'}
                  </span>
                  <span className="ide-export-capsuleSealLabel">
                    {capsuleSealState === 'sealed' ? 'SEALED'
                     : capsuleSealState === 'sealing' ? 'SEALING…'
                     : 'NOT SEALED'}
                  </span>
                </div>
                {capsuleSealPayload.sig ? (
                  <div className="ide-export-capsuleRows" data-testid="ide-export-capsule-payload">
                    {([
                      { key: 'SIG',    val: capsuleSealPayload.sig },
                      { key: 'VERIFY', val: capsuleSealPayload.verifyHash ?? 'n/a' },
                      { key: 'EXPORT', val: capsuleSealPayload.exportHash ?? 'n/a' },
                      { key: 'PINS',   val: capsuleSealPayload.pins ?? 'n/a' },
                      { key: 'TS',     val: capsuleSealPayload.ts ?? 'n/a' },
                    ] as const).map(({ key, val }) => (
                      <div key={key} className="ide-export-context-row" data-testid={`ide-export-capsule-${key.toLowerCase()}`}>
                        <span className="ide-export-context-key">{key}</span>
                        <span className="ide-export-context-val">{val}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ide-export-capsuleHint">
                    {capsuleBuildState === 'error'
                      ? 'Seal failed — resolve errors and rebuild.'
                      : 'Build the export pack to seal this capsule.'}
                  </p>
                )}
              </div>

              <div className="ide-inline-actions">
                <IdeButton
                  tone="ghost"
                  onClick={() => void copyToClipboard(quickDebugReport, 'report')}
                  testId="ide-export-copy-debug-report"
                >
                  Copy debug report
                </IdeButton>
              </div>
              <p
                className="ide-copy"
                style={{ fontSize: 10, marginTop: 0 }}
                data-testid="ide-export-copy-state"
              >
                {copyState === 'report'
                  ? 'Copied.'
                  : copyState === 'error'
                    ? 'Clipboard error.'
                    : 'Hashes + mapping for TA handoff.'}
              </p>

            </div>
          </div>
        </IdePanel>
    </IdeSurfaceLayout>
  );
};

function createPinOverrideMap(
  rows: ReturnType<typeof buildExportViewModel>['pinTable']
): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const row of rows) {
    overrides[toPortKey(row.port)] = row.pin ?? '';
  }
  return overrides;
}

function buildEvidenceDiagnostics(
  verifyResult: ProjectHealthVerifyResult | undefined,
  dirtySinceVerify: boolean
): ExportDiagnosticView[] {
  const diagnostics: ExportDiagnosticView[] = [];

  if (!verifyResult) {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1000',
      message: 'Evidence Capsule requires a verification run before export.',
      fix: 'Open Verify and run the deterministic vector suite to generate a PASS report.',
    }));
    return diagnostics;
  }

  if (verifyResult.status !== 'pass') {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1001',
      message:
        typeof verifyResult.failingTick === 'number'
          ? `Latest verification failed at tick ${verifyResult.failingTick}.`
          : 'Latest verification failed.',
      fix: 'Open Verify, inspect the failure diff, then rerun until PASS.',
    }));
  }

  if (dirtySinceVerify) {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1002',
      message: 'Design changed since the last PASS verification run.',
      fix: 'Rerun verification to refresh deterministic evidence before export.',
    }));
  }

  return diagnostics;
}

function createEvidenceDiagnostic(input: {
  code: string;
  message: string;
  fix: string;
}): ExportDiagnosticView {
  const canonical: IdeDiagnostic = {
    id: createDiagnosticId({
      code: input.code,
      owner: {
        kind: 'file',
        filePath: 'verify-report.json',
      },
      message: input.message,
      hint: [input.fix],
    }),
    severity: 'error',
    code: input.code,
    title: 'Evidence gate blocker',
    message: input.message,
    hint: [input.fix],
    owner: {
      kind: 'file',
      filePath: 'verify-report.json',
    },
    actions: [
      {
        kind: 'open-mode',
        label: 'Open Verify',
        payload: {
          mode: 'verify',
          filePath: 'verify-report.json',
        },
      },
    ],
  };

  return {
    id: canonical.id,
    code: canonical.code,
    title: canonical.title,
    message: canonical.message,
    hint: canonical.hint,
    fix: input.fix,
    severity: 'error',
    owner: canonical.owner,
    actions: canonical.actions,
    canonical,
  };
}

function toPortKey(value: string): string {
  return value.trim().toLowerCase();
}

function statusTone(status: ExportPinStatus): 'ok' | 'error' | 'warn' {
  if (status === 'mapped') return 'ok';
  if (status === 'missing') return 'error';
  return 'warn';
}

function resolveRowStatus(baseStatus: ExportPinStatus, pinValue: string): ExportPinStatus {
  if (baseStatus === 'unused') return 'unused';
  return pinValue.trim().length > 0 ? 'mapped' : 'missing';
}

function getPinConfidence(
  suggestedPin: string | undefined,
  pinValue: string
): 'exact' | 'likely' | 'unknown' {
  if (!suggestedPin) return 'unknown';
  if (pinValue.trim().toUpperCase() === suggestedPin.toUpperCase()) return 'exact';
  return 'likely';
}
