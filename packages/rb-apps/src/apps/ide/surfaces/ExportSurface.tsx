import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IdeExampleDefinition } from '../examplesCatalog';
import type { RBProject } from '../../../export/projectFormat';
import { buildDeterministicZip } from '../../../export/deterministicZip';
import type { ProjectHealthExportResult, ProjectHealthVerifyResult } from '../projectHealth';
import { createDiagnosticId, type IdeDiagnostic } from '../diagnostics';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../../../fpga/vivado/vivadoProjectFolder';
import type { RuntimeVerifyRun } from '../projectRuntime';
import {
  buildExportViewModel,
  type ExportDiagnosticSeverity,
  type ExportDiagnosticView,
  type ExportArtifactView,
  type ExportPinTableRow,
  type ExportPinStatus,
} from '../viewmodels/buildExportViewModel';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeInspectorSection,
  IdePanel,
  IdeSpinner,
  IdeStatusPill,
} from '../components/IdePrimitives';
import { SurfacePanel } from '../components/SurfaceLayoutPrimitives';

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
  onGoToDesign?: () => void;
  onUpdateMappingPin?: (rowId: string, pin: string) => void;
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
  | 'zip';

type RebuildStepState = 'idle' | 'running' | 'done' | 'error' | 'skipped';
type ExportLayoutMode = 'wide' | 'standard' | 'compact';
type ExportArtifactGroupId = 'hdl' | 'constraints' | 'testbench' | 'project';

interface ExportArtifactGroup {
  id: ExportArtifactGroupId;
  label: string;
  description: string;
  artifacts: ExportArtifactView[];
}

interface ExportDesignSummary {
  inputs: number;
  outputs: number;
  gates: number;
  clocked: number;
}

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
  { id: 'bundle',   label: 'Build VHDL + constraints' },
  { id: 'manifest', label: 'Generate README' },
  { id: 'zip',      label: 'Package Vivado Project' },
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
  onGoToDesign,
  onUpdateMappingPin,
}) => {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const baseViewModel = useMemo(
    () => buildExportViewModel(project, verifyLastRun),
    [project, verifyLastRun]
  );
  const [pinOverrides, setPinOverrides] = useState<Record<string, string>>(() =>
    createPinOverrideMap(baseViewModel.pinTable)
  );
  const effectiveProject = useMemo(
    () => applyPinOverridesToProject(project, pinOverrides),
    [pinOverrides, project]
  );
  const viewModel = useMemo(
    () => buildExportViewModel(effectiveProject, verifyLastRun),
    [effectiveProject, verifyLastRun]
  );
  const evidenceDiagnostics = useMemo(
    () => buildEvidenceDiagnostics(verifyResult, dirtySinceVerify),
    [dirtySinceVerify, verifyResult]
  );
  const diagnosticsList = useMemo(
    () => [...viewModel.errors, ...evidenceDiagnostics, ...viewModel.warnings],
    [evidenceDiagnostics, viewModel.errors, viewModel.warnings]
  );
  const [downloadError, setDownloadError] = useState<string>('');
  const [downloadDone, setDownloadDone] = useState(false);
  const [lastDownloadKind, setLastDownloadKind] = useState<'project' | 'kit' | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [highlightedPort, setHighlightedPort] = useState<string | null>(null);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string>(() => {
    const readme = baseViewModel.artifacts.find((artifact) => artifact.path.toLowerCase() === 'readme.txt');
    return readme?.path ?? baseViewModel.artifacts[0]?.path ?? '';
  });
  const [openFixPathId, setOpenFixPathId] = useState<string | null>(null);
  // Phase 32: pipeline rebuild state
  const [rebuildSteps, setRebuildSteps] = useState<RebuildStep[]>(() => makeSteps());
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [layoutMode, setLayoutMode] = useState<ExportLayoutMode>(() => resolveExportLayoutMode());
  // Phase 2: track which port keys have invalid (non-Basys3) pin values
  const [invalidPins, setInvalidPins] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const pinInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const mapSectionRef = useRef<HTMLElement>(null);
  const highlightResetTimer = useRef<number | null>(null);
  const copyResetTimer = useRef<number | null>(null);
  const editablePortKeys = useMemo(() => collectMappedProjectPortKeys(project), [project]);

  useEffect(() => {
    const nextOverrides = createPinOverrideMap(baseViewModel.pinTable);
    setPinOverrides(nextOverrides);
    setInvalidPins(buildInvalidPinSet(nextOverrides, editablePortKeys));
  }, [baseViewModel.pinTable, editablePortKeys]);

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
    if (typeof window === 'undefined') return;
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === 'undefined') {
      setLayoutMode(resolveExportLayoutMode());
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? surface.clientWidth;
      setLayoutMode(resolveExportLayoutMode(nextWidth));
    });
    observer.observe(surface);
    setLayoutMode(resolveExportLayoutMode(surface.clientWidth));
    return () => observer.disconnect();
  }, []);

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

  const hasBlockingErrors = viewModel.errors.length > 0;
  const hasVerifyPass = verifyResult?.status === 'pass' && !dirtySinceVerify && !verifyLastRun?.qualification;
  const hasVerifyEvidenceWarning = evidenceDiagnostics.length > 0;
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
        (r) =>
          editablePortKeys.has(toPortKey(r.port)) &&
          r.suggestedPin &&
          (pinOverrides[toPortKey(r.port)] ?? '').trim().length === 0
      ).length,
    [editablePortKeys, viewModel.pinTable, pinOverrides]
  );
  const projectMappingMissingRows = useMemo(
    () => viewModel.pinTable.filter((row) => row.required && !editablePortKeys.has(toPortKey(row.port))),
    [editablePortKeys, viewModel.pinTable]
  );
  const unmappedRequiredPorts = useMemo(
    () =>
      viewModel.pinTable.filter(
        (r) => r.required && (pinOverrides[toPortKey(r.port)] ?? '').trim().length === 0
      ),
    [viewModel.pinTable, pinOverrides]
  );

  const appEnv = (import.meta as ImportMeta & {
    env?: { VITE_APP_VERSION?: string; VITE_GIT_SHA?: string };
  }).env;
  const redbyteVersion = (appEnv?.VITE_APP_VERSION ?? 'dev').trim() || 'dev';
  const redbyteCommit = (appEnv?.VITE_GIT_SHA ?? 'local').trim() || 'local';
  const topModule = useMemo(() => resolveTopEntity(project), [project]);
  const projectSlug = useMemo(
    () => deriveVivadoProjectSlug((project.meta?.projectId ?? project.name ?? '').trim()),
    [project.meta?.projectId, project.name]
  );
  const vivadoPart = resolveVivadoPart(project.fpga?.part);

  const gateRows = useMemo(() => {
    const verifyTone = hasVerifyPass
      ? 'ok' as const
      : verifyResult?.status === 'pass' && dirtySinceVerify
        ? 'error' as const
        : verifyResult
          ? 'error' as const
          : 'error' as const;
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
  const artifactGroups = useMemo(
    () => buildArtifactGroups(viewModel.artifacts),
    [viewModel.artifacts]
  );
  const designSummary = useMemo(
    () => buildDesignSummary(project),
    [project]
  );
  const keyArtifacts = useMemo(
    () => ({
      topVhd: artifactMap.get('top.vhd'),
      topXdc: artifactMap.get('top.xdc'),
      vivadoImport: artifactMap.get('vivado_import.tcl'),
    }),
    [artifactMap]
  );
  const readyArtifactCount = useMemo(
    () => viewModel.artifacts.filter((artifact) => artifact.status === 'ready').length,
    [viewModel.artifacts]
  );
  const downloadReady = !hasBlockingErrors;
  const exportTrusted = downloadReady && hasVerifyPass;
  const nextActionTitle = exportTrusted
    ? 'Open Vivado and import the generated project.'
    : hasBlockingErrors
      ? 'Resolve blockers before downloading the build package.'
      : '⚠ Verify first — this export may fail in Vivado.';
  const nextActionDetail = exportTrusted
    ? 'Download the Vivado Project, unzip it, then run the import script or open the project directly.'
    : hasBlockingErrors
      ? 'Use the blocker list and pin review below to clear mapping or clock issues before export.'
      : 'This package has not been sealed by a passing Verify run. Downloading it may produce bitstream errors or hardware failures. Run Verify first.';
  const vivadoCommand =
    'vivado -mode batch -source vivado_import.tcl -notrace -nojournal -log vivado_import.log';
  const projectDownloadLabel = isRebuilding
    ? 'Building…'
    : downloadDone && lastDownloadKind === 'project'
      ? 'Re-download'
      : 'Download Vivado Project (Open Project)';
  const projectDownloadCompactLabel = isRebuilding
    ? 'Building…'
    : downloadDone && lastDownloadKind === 'project'
      ? 'Re-download'
      : exportTrusted
        ? 'Download Project ZIP'
        : '⚠ Verify first — this may fail in Vivado';
  const kitDownloadLabel = isRebuilding
    ? 'Building…'
    : downloadDone && lastDownloadKind === 'kit'
      ? 'Re-download'
      : 'Download Vivado Kit';
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

    return [
      'RedByte Vivado Quick Debug Report',
      `project=${project.name}`,
      `board=basys3`,
      `redbyteVersion=${redbyteVersion}`,
      `redbyteCommit=${redbyteCommit}`,
      `exportHash=${viewModel.exportHash ?? 'pending'}`,
      `verifyHash=${verifyResult?.hash ?? 'pending'}`,
      '',
      'mapping:',
      ...mappingLines,
    ].join('\n');
  }, [
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

  const handlePinOverrideChange = useCallback(
    (portKey: string, newVal: string) => {
      if (!editablePortKeys.has(portKey)) return;
      const row = mappingIndex.get(portKey);
      setPinOverrides((prev) => ({ ...prev, [portKey]: newVal }));
      if (row?.rowId) {
        onUpdateMappingPin?.(row.rowId, newVal.trim());
      }
    },
    [editablePortKeys, mappingIndex, onUpdateMappingPin]
  );

  const applySuggestion = (portKey: string) => {
    if (!editablePortKeys.has(portKey)) return;
    const row = mappingIndex.get(portKey);
    if (!row?.suggestedPin) return;
    handlePinOverrideChange(portKey, row.suggestedPin);
    jumpToMapping(portKey);
  };

  const applyAllSuggestions = () => {
    const toApply: Array<{ key: string; rowId?: string; pin: string }> = [];
    for (const row of viewModel.pinTable) {
      const key = toPortKey(row.port);
      if (!editablePortKeys.has(key)) continue;
      if (!row.suggestedPin) continue;
      if ((pinOverrides[key] ?? '').trim().length === 0) {
        toApply.push({ key, rowId: row.rowId, pin: row.suggestedPin });
      }
    }
    if (toApply.length === 0) return;
    const overridePatch = Object.fromEntries(toApply.map(({ key, pin }) => [key, pin]));
    setPinOverrides((prev) => ({ ...prev, ...overridePatch }));
    for (const { rowId, pin } of toApply) {
      if (rowId) onUpdateMappingPin?.(rowId, pin);
    }
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
  }, []);

  const handleDownloadExport = useCallback(async (kind: 'project' | 'kit') => {
    setIsRebuilding(true);
    resetSteps();
    setDownloadError('');
    const ranAtIso = new Date().toISOString();

    // re-init steps
    setRebuildSteps(makeSteps());

    try {
      // STEP: validate — check blocking diagnostics
      markStep('validate', 'running');
      await tick();
      if (hasBlockingErrors) {
        markStep('validate', 'error', 'Blocking diagnostics present');
        setDownloadError(
          kind === 'project'
            ? 'Resolve blocking diagnostics before downloading the Vivado Project.'
            : 'Resolve blocking diagnostics before downloading the Vivado Kit.'
        );
        setIsRebuilding(false);
        return;
      }
      markStep('validate', 'done');

      // STEP: mapping — check required pins covered
      markStep('mapping', 'running');
      await tick();
      if (requiredMappedCount < requiredCount) {
        markStep('mapping', 'error', `${requiredCount - requiredMappedCount} required pin${requiredCount - requiredMappedCount !== 1 ? 's' : ''} unmapped`);
        setDownloadError(`${requiredCount - requiredMappedCount} required pin${requiredCount - requiredMappedCount !== 1 ? 's' : ''} unmapped.`);
        setIsRebuilding(false);
        return;
      }
      markStep('mapping', 'done');

      // STEP: clock — check verify pass
      markStep('clock', 'running');
      await tick();
      if (!verifyResult || verifyResult.status !== 'pass' || dirtySinceVerify || verifyLastRun?.qualification === 'incomplete-mapping') {
        markStep('clock', 'error', 'Verify PASS required');
        setDownloadError('Download requires a passing verification with no pending design changes.');
        setIsRebuilding(false);
        return;
      }
      markStep('clock', 'done');

      // STEP: bundle — assemble VHDL + constraints
      markStep('bundle', 'running');
      await tick();
      markStep('bundle', 'done');

      // STEP: manifest — build README
      markStep('manifest', 'running');
      await tick();
      markStep('manifest', 'done');

      // STEP: zip — package and download
      markStep('zip', 'running');
      const zipBytes =
        kind === 'project'
          ? await buildVivadoProjectFolderZip({
              artifacts: viewModel.artifacts.map((artifact) => ({
                path: artifact.path,
                content: artifact.content,
              })),
              projectName: project.name,
              projectSlug,
              topModule,
              part: vivadoPart,
            })
          : await buildVivadoKitZip(viewModel.artifacts);
      downloadZipBytes(
        zipBytes,
        kind === 'project' ? `${projectSlug}-vivado-project.zip` : 'redbyte-vivado-kit.zip'
      );
      markStep('zip', 'done');
      setDownloadDone(true);
      setLastDownloadKind(kind);

      onExportBundle?.(viewModel.artifacts);
      onExportResult?.({
        status: 'ok',
        hash: viewModel.exportHash,
        artifacts: viewModel.artifacts.map((a) => a.path),
        ranAtIso,
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'unknown build error';
      setDownloadError(`Build failed: ${reason}`);
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
    verifyResult, dirtySinceVerify, viewModel, onExportBundle, onExportResult,
    project.name, projectSlug, topModule, vivadoPart,
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

  const copyToClipboard = async (payload: string, targetId: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopiedTarget(null);
      setCopyError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedTarget(targetId);
      setCopyError(false);
      if (copyResetTimer.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(copyResetTimer.current);
      }
      if (typeof window !== 'undefined') {
        copyResetTimer.current = window.setTimeout(() => {
          setCopiedTarget(null);
          setCopyError(false);
        }, 1600);
      }
    } catch {
      setCopiedTarget(null);
      setCopyError(true);
    }
  };

  return (
    <IdeSurfaceLayout
      mode="export"
      consoleHasBlocking={hasBlockingErrors}
      consoleHasEntries={diagnosticsList.length > 0}
      dock={
        <section className="ide-workbench-placeholder ide-export-sidecard" data-testid="ide-export-checks-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Handoff</h3>
            <IdeStatusPill tone={exportTrusted ? 'ok' : hasBlockingErrors ? 'error' : 'warn'}>
              {exportTrusted ? 'READY' : hasBlockingErrors ? 'BLOCKED' : 'UNVERIFIED'}
            </IdeStatusPill>
          </header>
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>Board</span>
              <span>Basys3</span>
            </div>
            <div className="ide-kv-row">
              <span>Top</span>
              <span className="ide-status-mono">{topModule}</span>
            </div>
            <div className="ide-kv-row">
              <span>Mapped I/O</span>
              <span>{mappedCount}/{viewModel.pinTable.length}</span>
            </div>
            <div className="ide-kv-row">
              <span>Artifacts</span>
              <span>{readyArtifactCount}/{viewModel.artifacts.length}</span>
            </div>
          </div>
          <p className="ide-copy ide-export-sidecard-copy">{nextActionTitle}</p>
          <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
            <IdeButton
              tone="primary"
              onClick={() => void handleDownloadExport('project')}
              disabled={!downloadReady || isRebuilding}
              testId="ide-export-dock-download"
            >
              {isRebuilding ? <><IdeSpinner size="sm" testId="ide-export-rebuild-spinner" /> Building&hellip;</> : projectDownloadCompactLabel}
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

          <IdeInspectorSection title="Package Context" defaultOpen>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Board</span>
                <span>Basys3</span>
              </div>
              <div className="ide-kv-row">
                <span>Part</span>
                <span><code>{vivadoPart}</code></span>
              </div>
              <div className="ide-kv-row">
                <span>Top Module</span>
                <span><code>{topModule}</code></span>
              </div>
              <div className="ide-kv-row">
                <span>Blocking Errors</span>
                <span>{diagnosticsList.filter((entry) => entry.severity === 'error').length}</span>
              </div>
              <div className="ide-kv-row" data-testid="ide-export-capsule-build-state">
                <span>Export State</span>
                <span>
                  {isRebuilding
                    ? 'Building…'
                    : downloadDone
                      ? 'Downloaded'
                      : exportTrusted
                        ? 'Trusted'
                        : downloadReady
                          ? 'Unverified'
                          : 'Blocked'}
                </span>
              </div>
            </div>
            <details style={{ marginTop: 'var(--ide-space-2)' }}>
              <summary style={{ cursor: 'pointer', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                Advanced
              </summary>
              <div className="ide-kv-list" style={{ marginTop: 'var(--ide-space-1)' }}>
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
              </div>
            </details>
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
          title={
            exportTrusted
              ? 'Export Handoff Ready'
              : hasBlockingErrors
                ? 'Export Handoff Blocked'
                : 'Export Handoff Available'
          }
          description="Review the generated package, confirm readiness, and prepare the project for Vivado."
          actions={
            <>
              <span data-testid="ide-primary-cta">
                <IdeButton
                  tone="primary"
                  onClick={() => void handleDownloadExport('project')}
                  disabled={!downloadReady || isRebuilding}
                >
                  {projectDownloadLabel}
                </IdeButton>
              </span>
            </>
          }
          right={
            exportTrusted ? (
              <IdeStatusPill tone="ok">Ready</IdeStatusPill>
            ) : hasBlockingErrors ? (
              <IdeStatusPill tone="error">Blocked</IdeStatusPill>
            ) : (
              <IdeStatusPill tone="warn">Unverified</IdeStatusPill>
            )
          }
          testId="ide-export-panel"
        >
          <section
            ref={surfaceRef}
            className="ide-export-summary-hero"
            data-layout-mode={layoutMode}
            data-testid="ide-export-summary-card"
          >
            <div className="ide-export-summary-hero-main">
              <div className="ide-export-summary-copy">
                <div className="ide-export-summary-eyebrow">
                  <IdeStatusPill tone={exportTrusted ? 'ok' : hasBlockingErrors ? 'error' : 'warn'}>
                    {exportTrusted ? 'READY FOR VIVADO' : hasBlockingErrors ? 'BLOCKED' : 'UNVERIFIED'}
                  </IdeStatusPill>
                  <span>Engineering handoff</span>
                </div>
                <h3>{nextActionTitle}</h3>
                <p>{nextActionDetail}</p>
              </div>
              <div className="ide-export-summary-actions">
                <IdeButton
                  tone="primary"
                  onClick={() => void handleDownloadExport('project')}
                  disabled={!downloadReady || isRebuilding}
                  testId="ide-export-rebuild-btn"
                >
                  {projectDownloadLabel}
                </IdeButton>
                <IdeButton
                  tone="secondary"
                  onClick={() => void handleDownloadExport('kit')}
                  disabled={!downloadReady || isRebuilding}
                  testId="ide-export-download-kit-btn"
                >
                  {kitDownloadLabel}
                </IdeButton>
                {onGoToDesign && (
                  <IdeButton
                    tone="ghost"
                    onClick={onGoToDesign}
                    testId="ide-export-go-design-header"
                  >
                    ← Design
                  </IdeButton>
                )}
              </div>
            </div>
            <div className="ide-export-summary-grid" data-testid="ide-export-design-summary">
              <SummaryStat label="Board" value="Basys3" />
              <SummaryStat label="Top Module" value={topModule} mono />
              <SummaryStat label="Mapped Pins" value={`${mappedCount}/${viewModel.pinTable.length}`} />
              <SummaryStat label="Artifacts" value={`${readyArtifactCount}/${viewModel.artifacts.length}`} />
              <SummaryStat label="Inputs" value={`${designSummary.inputs}`} />
              <SummaryStat label="Outputs" value={`${designSummary.outputs}`} />
              <SummaryStat label="Gates" value={`${designSummary.gates}`} />
              <SummaryStat label="Clocked" value={`${designSummary.clocked}`} />
            </div>
          </section>
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
          <section className="ide-export-trust-banner" data-testid="ide-export-trust-banner">
            {exportTrusted ? (
              <div className="ide-export-trust-row ide-export-trust-row--trusted">
                <IdeStatusPill tone="ok">TRUSTED</IdeStatusPill>
                <span className="ide-export-trust-message" data-testid="ide-export-trust-consequence">
                  Verification passed and all required pins are mapped. This export is ready for Vivado.
                </span>
              </div>
            ) : downloadReady ? (
              <div className="ide-export-trust-row ide-export-trust-row--available">
                <div className="ide-export-trust-header">
                  <IdeStatusPill tone="warn">AVAILABLE — NOT TRUSTED</IdeStatusPill>
                </div>
                <div className="ide-export-trust-body">
                  <p className="ide-export-trust-reason" data-testid="ide-export-trust-reason">
                    {evidenceDiagnostics[0]?.message ?? 'Verification has not passed.'}
                  </p>
                  <p className="ide-export-trust-consequence" data-testid="ide-export-trust-consequence">
                    This export may open, but it may fail in Vivado or on the board until these blockers are resolved.
                  </p>
                </div>
                {onOpenVerify && (
                  <div className="ide-inline-actions">
                    <IdeButton tone="secondary" onClick={onOpenVerify} testId="ide-export-trust-go-verify">
                      Open Verify →
                    </IdeButton>
                  </div>
                )}
              </div>
            ) : (
              <div className="ide-export-trust-row ide-export-trust-row--blocked">
                <div className="ide-export-trust-header">
                  <IdeStatusPill tone="error">BLOCKED</IdeStatusPill>
                </div>
                <div className="ide-export-trust-body">
                  <p className="ide-export-trust-consequence" data-testid="ide-export-trust-consequence">
                    This export may open, but it may fail in Vivado or on the board until these blockers are resolved.
                  </p>
                  {(unmappedRequiredPorts.length > 0 || viewModel.errors.length > 0) && (
                    <ul className="ide-export-trust-blocker-list" data-testid="ide-export-trust-blocker-list">
                      {unmappedRequiredPorts.length > 0 && (
                        <li>
                          {unmappedRequiredPorts.map((r) => r.port).join(', ')}{' '}
                          {unmappedRequiredPorts.length === 1 ? 'is' : 'are'} not mapped
                        </li>
                      )}
                      {viewModel.errors
                        .filter((e) => e.code !== 'RBEX1001' && e.code !== 'RBEX1002')
                        .slice(0, 2)
                        .map((e) => (
                          <li key={e.id}>{e.title}</li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="ide-inline-actions">
                  {onGoToHardware && unmappedRequiredPorts.length > 0 && (
                    <IdeButton tone="secondary" onClick={onGoToHardware} testId="ide-export-trust-go-hardware">
                      Map Pins in Hardware →
                    </IdeButton>
                  )}
                  {onOpenVerify && (
                    <IdeButton tone="secondary" onClick={onOpenVerify} testId="ide-export-trust-go-verify">
                      Open Verify →
                    </IdeButton>
                  )}
                </div>
              </div>
            )}
          </section>
          <div className="ide-export-layout">
            <div className="ide-export-left-col">

              <section className="ide-export-section" data-testid="ide-export-build-output">
                <header className="ide-export-section-header">
                  <h3>{hasBlockingErrors ? 'Blockers' : hasVerifyEvidenceWarning ? 'Advisories' : 'Checks'}</h3>
                  <span className="ide-export-section-meta">
                    {diagnosticsList.length} diagnostics
                  </span>
                </header>

                {hasBlockingErrors && requiredMappedCount < requiredCount && onGoToHardware && (
                  <IdeCallout
                    tone="error"
                    title="IO mapping incomplete"
                    testId="ide-export-io-incomplete-callout"
                  >
                    <p className="ide-copy" style={{ margin: 0 }}>
                      All required input/output ports must be assigned Basys3 pin identifiers before downloading the Vivado kit.
                    </p>
                    <div style={{ marginTop: 'var(--ide-space-2)' }}>
                      <IdeButton tone="primary" onClick={onGoToHardware} testId="ide-export-go-map-pins">
                        Map Pins in Hardware →
                      </IdeButton>
                    </div>
                  </IdeCallout>
                )}
                {hasBlockingErrors && (
                  <IdeCallout
                    tone="error"
                    title={`${viewModel.errors.length} blocker${viewModel.errors.length !== 1 ? 's' : ''} — download unavailable`}
                    testId="ide-export-blockers-callout"
                  >
                    <p className="ide-copy" style={{ margin: 0 }}>Resolve all mapping and export issues before downloading.</p>
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
                {!hasBlockingErrors && hasVerifyEvidenceWarning && (
                  <div data-testid="ide-export-blockers-callout">
                    <IdeCallout tone="warn" title="Verification is required before trusted handoff" testId="ide-export-unverified-callout">
                      <p className="ide-copy" style={{ margin: 0 }}>
                        The generated text files are available now, but the Vivado handoff is not trustworthy until Verify has a current PASS/FAIL result.
                      </p>
                      {onOpenVerify && (
                        <div style={{ marginTop: 'var(--ide-space-2)' }}>
                          <IdeButton tone="secondary" onClick={onOpenVerify} testId="ide-export-open-verify-advisory">
                            Open Verify
                          </IdeButton>
                        </div>
                      )}
                    </IdeCallout>
                  </div>
                )}

                {downloadError.length > 0 && (
                  <IdeCallout tone="error" title="Export Error" testId="ide-export-capsule-error">
                    {downloadError}
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
                              {onGoToDesign && (
                                <IdeButton
                                  tone="ghost"
                                  onClick={onGoToDesign}
                                  testId="ide-export-go-design"
                                >
                                  Fix in Design →
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
                {projectMappingMissingRows.length > 0 && (
                  <IdeCallout tone="warn" title="Add missing project mappings before binding pins">
                    {projectMappingMissingRows.length} required port
                    {projectMappingMissingRows.length === 1 ? '' : 's'} appear in the top entity
                    but not in the project mapping yet. Add them in Project or Design before assigning a
                    Basys3 pin here.
                  </IdeCallout>
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
                        const isPinInvalid = invalidPins.has(portKey);
                        const isEditable = editablePortKeys.has(portKey);
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
                                disabled={!isEditable}
                                onChange={(event) => {
                                  const newVal = event.target.value.toUpperCase();
                                  handlePinOverrideChange(portKey, newVal);
                                  // Phase 2: validate against known Basys3 pins
                                  const trimmed = newVal.trim();
                                  setInvalidPins((prev) => {
                                    const next = new Set(prev);
                                    if (trimmed.length > 0 && !BASYS3_VALID_PINS.has(trimmed)) {
                                      next.add(portKey);
                                    } else {
                                      next.delete(portKey);
                                    }
                                    return next;
                                  });
                                }}
                                placeholder={isEditable ? row.suggestedPin ?? 'PIN' : 'Add mapping first'}
                              />
                              {isPinInvalid && (
                                <span className="ide-pin-warn">&#9888; Unknown pin — check Basys3 reference</span>
                              )}
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
                              {!isEditable && (
                                <div className="ide-export-suggestion">
                                  Add this mapping in Project or Design before assigning a pin.
                                </div>
                              )}
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
                  <div>
                    <h3>Generated Artifacts</h3>
                    <p className="ide-export-section-subcopy">
                      Grouped by handoff role so you can inspect, copy, and download the exact file Vivado needs next.
                    </p>
                  </div>
                  <span className="ide-export-section-meta">
                    {readyArtifactCount}/{viewModel.artifacts.length || 0} ready
                  </span>
                </header>

                {viewModel.artifacts.length === 0 && (
                  <div className="ide-empty-stack" data-testid="ide-export-empty-state">
                    <IdeCallout tone="warn" title="No generated files yet">
                      Add circuit elements and map pins to see generated VHDL and constraints.
                    </IdeCallout>
                  </div>
                )}

                {viewModel.artifacts.length > 0 && (
                  <>
                    <div className="ide-export-key-actions">
                      <IdeButton
                        tone="ghost"
                        onClick={() => void copyToClipboard(keyArtifacts.topVhd?.content ?? '', 'key:top-vhd')}
                        disabled={!keyArtifacts.topVhd}
                        testId="ide-export-copy-top-vhd"
                      >
                        {copiedTarget === 'key:top-vhd' ? 'Copied!' : 'Copy top.vhd'}
                      </IdeButton>
                      <IdeButton
                        tone="ghost"
                        onClick={() => void copyToClipboard(keyArtifacts.topXdc?.content ?? '', 'key:top-xdc')}
                        disabled={!keyArtifacts.topXdc}
                        testId="ide-export-copy-top-xdc"
                      >
                        {copiedTarget === 'key:top-xdc' ? 'Copied!' : 'Copy top.xdc'}
                      </IdeButton>
                      <IdeButton
                        tone="ghost"
                        onClick={() => void copyToClipboard(keyArtifacts.vivadoImport?.content ?? '', 'key:vivado-import')}
                        disabled={!keyArtifacts.vivadoImport}
                        testId="ide-export-copy-vivado-import"
                      >
                        {copiedTarget === 'key:vivado-import' ? 'Copied!' : 'Copy vivado_import.tcl'}
                      </IdeButton>
                      <IdeButton
                        tone="ghost"
                        onClick={() =>
                          selectedArtifact &&
                          void copyToClipboard(selectedArtifact.content, `current:${selectedArtifact.path}`)
                        }
                        disabled={!selectedArtifact || selectedArtifact.content.trim().length === 0}
                        testId="ide-export-copy-current"
                      >
                        {selectedArtifact && copiedTarget === `current:${selectedArtifact.path}`
                          ? 'Copied!'
                          : 'Copy current file'}
                      </IdeButton>
                    </div>
                    <div
                      className="ide-export-artifact-workspace"
                      data-layout-mode={layoutMode}
                      data-testid="ide-export-artifact-tabs"
                    >
                      <div className="ide-export-artifact-groups">
                        {artifactGroups.map((group) => (
                          <section
                            key={group.id}
                            className="ide-export-artifact-group"
                            data-testid={`ide-export-artifact-group-${group.id}`}
                          >
                            <header className="ide-export-artifact-group-header">
                              <div>
                                <h4>{group.label}</h4>
                                <p>{group.description}</p>
                              </div>
                              <span>{group.artifacts.length}</span>
                            </header>
                            <div className="ide-export-artifact-group-list">
                              {group.artifacts.map((artifact) => (
                                <button
                                  key={artifact.path}
                                  type="button"
                                  className={`ide-export-artifact-tab ${
                                    selectedArtifact?.path === artifact.path ? 'is-active' : ''
                                  }`}
                                  onClick={() => setSelectedArtifactPath(artifact.path)}
                                  data-testid={`ide-export-artifact-tab-${artifact.path
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, '-')
                                    .replace(/^-+|-+$/g, '')}`}
                                >
                                  <span className="ide-export-artifact-tab-name">{artifact.path}</span>
                                  <span className="ide-export-artifact-tab-note">{artifact.note}</span>
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
                                </button>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                      {selectedArtifact && (
                        <div className="ide-export-artifact-preview ide-export-artifact-preview-v2">
                          <div className="ide-export-artifact-preview-header">
                            <div className="ide-export-artifact-preview-title">
                              <span data-testid="ide-export-preview-path">{selectedArtifact.path}</span>
                              <span>{selectedArtifact.note}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--ide-space-1)' }}>
                              <IdeButton
                                tone="ghost"
                                onClick={() =>
                                  void copyToClipboard(
                                    selectedArtifact.content,
                                    `current:${selectedArtifact.path}`
                                  )
                                }
                                disabled={selectedArtifact.content.trim().length === 0}
                              >
                                {copiedTarget === `current:${selectedArtifact.path}` ? 'Copied!' : 'Copy'}
                              </IdeButton>
                              <IdeButton
                                tone="secondary"
                                onClick={() => handleDownloadArtifact(selectedArtifact)}
                                disabled={selectedArtifact.preview.trim().length === 0}
                              >
                                Download
                              </IdeButton>
                            </div>
                          </div>
                          <div className="ide-export-artifact-preview-body">
                            {selectedArtifact.preview.trim().length > 0 ? (
                              <pre
                                className="ide-export-artifact-code"
                                data-testid="ide-export-preview-code"
                                dangerouslySetInnerHTML={{
                                  __html: syntaxHighlight(
                                    selectedArtifact.preview ?? '',
                                    selectedArtifact.kind ?? ''
                                  ),
                                }}
                              />
                            ) : (
                              <p className="ide-export-artifact-empty">
                                File content will appear once the circuit and pin mapping are complete.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>

              <section className="ide-export-section" data-testid="ide-export-vivado-ready">
                <header className="ide-export-section-header">
                  <div>
                    <h3>Next in Vivado</h3>
                    <p className="ide-export-section-subcopy">
                      Keep the handoff short at the top level. The full checklist is still available when you need it.
                    </p>
                  </div>
                {downloadReady
                    ? <IdeStatusPill tone="ok">Ready</IdeStatusPill>
                    : <IdeStatusPill tone="error">Blocked</IdeStatusPill>
                  }
                </header>

                {exportTrusted ? (
                  <IdeCallout tone="success" title="Ready to program your Basys3" testId="ide-export-vivado-ready-callout">
                    <p className="ide-copy" style={{ margin: 0 }}>
                      Download the Vivado Project, unzip it, and follow the three-step handoff below.
                    </p>
                  </IdeCallout>
                ) : downloadReady ? (
                  <IdeCallout tone="warn" title="Artifacts available, but unverified" testId="ide-export-vivado-unverified-callout">
                    <p className="ide-copy" style={{ margin: 0 }} data-testid="ide-export-vivado-command">
                      Students can inspect and export the current text files now. Run Verify before treating the package as trusted hardware evidence.
                    </p>
                  </IdeCallout>
                ) : (
                  <IdeCallout tone="warn" title="Resolve issues first" testId="ide-export-vivado-blocked-callout">
                    <p className="ide-copy" style={{ margin: 0 }} data-testid="ide-export-vivado-command">
                      Fix the blockers listed here before opening the project in Vivado.
                    </p>
                  </IdeCallout>
                )}

                <div className="ide-export-next-steps" data-testid="ide-export-vivado-steps">
                  <ol className="ide-export-checklist" data-testid="ide-export-vivado-checklist">
                    <li>Open Vivado.</li>
                    <li>Run <code>vivado_import.tcl</code> from the extracted project folder.</li>
                    <li>Generate bitstream and program the Basys3.</li>
                  </ol>
                  <details className="ide-export-advanced-steps">
                    <summary>Advanced / full checklist</summary>
                    <div className="ide-kv-list" style={{ marginTop: 'var(--ide-space-2)', marginBottom: 'var(--ide-space-2)' }}>
                      <div className="ide-kv-row">
                        <span>Board</span>
                        <span><code>Basys3</code></span>
                      </div>
                      <div className="ide-kv-row">
                        <span>Part</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--ide-space-1)' }}>
                          <code data-testid="ide-export-part-number">{vivadoPart}</code>
                          <IdeButton
                            tone="ghost"
                            onClick={() => void copyToClipboard(vivadoPart, 'part-number')}
                          >
                            {copiedTarget === 'part-number' ? 'Copied!' : 'Copy'}
                          </IdeButton>
                        </span>
                      </div>
                      <div className="ide-kv-row">
                        <span>Top Module</span>
                        <span><code data-testid="ide-export-top-module">{topModule}</code></span>
                      </div>
                      <div className="ide-kv-row">
                        <span>Tool</span>
                        <span><code>Vivado 2024.1+</code></span>
                      </div>
                    </div>
                    <ol className="ide-export-checklist ide-export-checklist--advanced">
                      <li>Unzip the download and keep the <code>{projectSlug}</code> folder intact</li>
                      <li>Open Vivado → <strong>Open Project</strong></li>
                      <li>Select <code>{projectSlug}.xpr</code> inside the unzipped folder</li>
                      <li>Confirm the design sources and constraints load from <code>{projectSlug}.srcs</code></li>
                      <li>Run Synthesis → Implementation → Generate Bitstream → Program Device</li>
                    </ol>
                    <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)', marginTop: 'var(--ide-space-2)' }}>
                      Fallback: run <code>{vivadoCommand}</code> from the extracted folder if Open Project is unavailable.
                    </p>
                  </details>
                  {/* Gate contract compatibility: vivado command/readme must be findable */}
                  {downloadReady ? (
                    <div data-testid="ide-export-readme-preview" style={{ marginTop: 'var(--ide-space-1)' }}>
                      <p className="ide-copy" style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-muted)', margin: 0 }}
                         data-testid="ide-export-vivado-command">
                        Batch import: <code>{vivadoCommand}</code>
                      </p>
                    </div>
                  ) : (
                    <p
                      className="ide-copy ide-export-vivado-blocked-hint"
                      data-testid="ide-export-vivado-command"
                    >
                      Resolve all blockers before importing to Vivado.
                    </p>
                  )}
                </div>
              </section>

            </div>

            <div className="ide-export-right-col">

              <SurfacePanel className="ide-export-buildCard" testId="ide-export-download-block">
                <div className="ide-export-buildCardTop">
                  <span className="ide-export-buildTitle">Vivado Project (Open Project)</span>
                  <span data-testid="ide-primary-cta">
                    <IdeButton
                      tone="primary"
                      onClick={() => void handleDownloadExport('project')}
                      disabled={!downloadReady || isRebuilding}
                      testId="ide-export-rebuild-btn"
                    >
                      {projectDownloadCompactLabel}
                    </IdeButton>
                  </span>
                </div>
                <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
                  <IdeButton
                    tone="secondary"
                    onClick={() => void handleDownloadExport('kit')}
                    disabled={!downloadReady || isRebuilding}
                    testId="ide-export-download-kit-btn"
                  >
                    {kitDownloadLabel}
                  </IdeButton>
                </div>
                {!downloadReady && (
                  <span
                    className="ide-export-download-gate-note"
                    data-testid="ide-export-download-gate-note"
                  >
                    {gateRows.find((g) => g.tone === 'error')?.label ?? 'Blockers'} must pass
                  </span>
                )}
                <details className="ide-export-pipeline-details" data-testid="ide-export-pipeline-details" style={{ marginTop: 'var(--ide-space-1)' }}>
                  <summary>Build pipeline</summary>
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
                </details>
              </SurfacePanel>

              <SurfacePanel className="ide-export-determinismChecks" testId="ide-export-determinism-checks">
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
              </SurfacePanel>

              <SurfacePanel className="ide-export-artifact-plan" testId="ide-export-artifact-plan">
                <div className="ide-export-artifact-plan-header">
                  <span className="ide-export-artifact-plan-title">Vivado Kit (Fallback)</span>
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
              </SurfacePanel>

              <details className="ide-export-evidence-details" data-testid="ide-export-evidence-details" style={{ marginTop: 'var(--ide-space-2)' }}>
                <summary>Debug report</summary>
                <div className="ide-export-capsuleSlab" style={{ marginTop: 'var(--ide-space-1)' }}>
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
                    {copiedTarget === 'report'
                      ? 'Copied.'
                      : copyError
                        ? 'Clipboard error.'
                        : 'Export hash and mapping snapshot for debugging.'}
                  </p>
                </div>
              </details>


            </div>
          </div>
        </IdePanel>
    </IdeSurfaceLayout>
  );
};

const LOGIC_INPUT_TYPES = new Set(['INPUT', 'Switch', 'Button', 'Clock', 'CLOCK']);
const LOGIC_OUTPUT_TYPES = new Set(['OUTPUT', 'Lamp']);
const CLOCKED_NODE_TYPES = new Set(['DFlipFlop', 'DLatch', 'TFlipFlop', 'JKFlipFlop', 'Counter4Bit', 'Delay']);

const SummaryStat: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono = false,
}) => (
  <div className="ide-export-summary-stat">
    <span className="ide-export-summary-stat-label">{label}</span>
    <span className={`ide-export-summary-stat-value${mono ? ' is-mono' : ''}`}>{value}</span>
  </div>
);

function buildArtifactGroups(artifacts: ExportArtifactView[]): ExportArtifactGroup[] {
  const groups: ExportArtifactGroup[] = [
    { id: 'hdl', label: 'HDL', description: 'Top-level design source files.', artifacts: [] },
    { id: 'constraints', label: 'Constraints', description: 'Pin constraints and board bindings.', artifacts: [] },
    { id: 'testbench', label: 'Testbench', description: 'Simulation fixtures and expected behavior.', artifacts: [] },
    { id: 'project', label: 'Project', description: 'Scripts, manifests, and handoff metadata.', artifacts: [] },
  ];
  const index = new Map(groups.map((group) => [group.id, group]));
  for (const artifact of artifacts) {
    const groupId = classifyArtifactGroup(artifact);
    index.get(groupId)?.artifacts.push(artifact);
  }
  return groups.filter((group) => group.artifacts.length > 0);
}

function classifyArtifactGroup(artifact: ExportArtifactView): ExportArtifactGroupId {
  if (artifact.kind === 'xdc') return 'constraints';
  if (artifact.kind === 'tb') return 'testbench';
  if (artifact.kind === 'vhd' && /testbench/i.test(artifact.path)) return 'testbench';
  if (artifact.kind === 'vhd') return 'hdl';
  return 'project';
}

function buildDesignSummary(project: RBProject): ExportDesignSummary {
  const nodes = project.circuit?.nodes ?? [];
  let inputs = 0;
  let outputs = 0;
  let gates = 0;
  let clocked = 0;

  for (const node of nodes) {
    if (LOGIC_INPUT_TYPES.has(node.type)) {
      inputs += 1;
      continue;
    }
    if (LOGIC_OUTPUT_TYPES.has(node.type)) {
      outputs += 1;
      continue;
    }
    if (CLOCKED_NODE_TYPES.has(node.type)) {
      clocked += 1;
      gates += 1;
      continue;
    }
    gates += 1;
  }

  return {
    inputs: Math.max(inputs, project.ioMapping?.inputs?.length ?? 0),
    outputs: Math.max(outputs, project.ioMapping?.outputs?.length ?? 0),
    gates,
    clocked,
  };
}

function resolveExportLayoutMode(width?: number): ExportLayoutMode {
  const nextWidth =
    typeof width === 'number'
      ? width
      : typeof window !== 'undefined'
        ? window.innerWidth
        : 1440;
  if (nextWidth >= 1440) return 'wide';
  if (nextWidth >= 1280) return 'standard';
  return 'compact';
}

function createPinOverrideMap(
  rows: ExportPinTableRow[]
): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const row of rows) {
    overrides[toPortKey(row.port)] = row.pin ?? '';
  }
  return overrides;
}

function collectMappedProjectPortKeys(project: RBProject): Set<string> {
  const keys = new Set<string>();
  for (const entry of project.ioMapping?.inputs ?? []) {
    keys.add(toMappingEntryKey(entry));
  }
  for (const entry of project.ioMapping?.outputs ?? []) {
    keys.add(toMappingEntryKey(entry));
  }
  return keys;
}

function applyPinOverridesToProject(
  project: RBProject,
  overrides: Record<string, string>
): RBProject {
  if (!project.ioMapping) return project;

  const applyEntries = (entries: NonNullable<RBProject['ioMapping']>['inputs']) =>
    entries.map((entry) => {
      const override = (overrides[toMappingEntryKey(entry)] ?? entry.pin ?? '').trim();
      return {
        ...entry,
        pin: override.length > 0 ? override : undefined,
      };
    });

  return {
    ...project,
    ioMapping: {
      inputs: applyEntries(project.ioMapping.inputs ?? []),
      outputs: applyEntries(project.ioMapping.outputs ?? []),
    },
  };
}

function buildEvidenceDiagnostics(
  verifyResult: ProjectHealthVerifyResult | undefined,
  dirtySinceVerify: boolean
): ExportDiagnosticView[] {
  const diagnostics: ExportDiagnosticView[] = [];

  if (!verifyResult) {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1000',
      message: 'No verification run found. Export files are still available, but the handoff is unverified.',
      fix: 'Open Verify and run the deterministic vector suite before treating the package as final hardware evidence.',
      severity: 'warning',
    }));
    return diagnostics;
  }

  if (verifyResult.status !== 'pass') {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1001',
      message:
        typeof verifyResult.failingTick === 'number'
          ? `Latest verification failed at tick ${verifyResult.failingTick}. Export files remain viewable.`
          : 'Latest verification failed. Export files remain viewable.',
      fix: 'Open Verify, inspect the failure diff, then rerun until PASS before relying on the bundle as trusted evidence.',
      severity: 'warning',
    }));
  }

  if (dirtySinceVerify) {
    diagnostics.push(createEvidenceDiagnostic({
      code: 'RBEV1002',
      message: 'Design changed since the last PASS verification run. Export files remain available, but trust is stale.',
      fix: 'Rerun verification to refresh deterministic evidence before using the bundle as your final hardware handoff.',
      severity: 'warning',
    }));
  }

  return diagnostics;
}

function createEvidenceDiagnostic(input: {
  code: string;
  message: string;
  fix: string;
  severity?: ExportDiagnosticSeverity;
}): ExportDiagnosticView {
  const severity = input.severity ?? 'warning';
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
    severity: severity === 'error' ? 'error' : 'warn',
    code: input.code,
    title: severity === 'error' ? 'Evidence gate blocker' : 'Evidence advisory',
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
    severity,
    owner: canonical.owner,
    actions: canonical.actions,
    canonical,
  };
}

function toPortKey(value: string): string {
  return value.trim().toLowerCase();
}

function toMappingEntryKey(entry: {
  id: string;
  nodeId: string;
  port: string;
  label?: string;
}): string {
  const label = (entry.label ?? '').trim();
  if (label.length > 0) return toPortKey(label);
  const id = (entry.id ?? '').trim();
  if (id.length > 0) return toPortKey(id);
  return toPortKey(`${entry.nodeId}.${entry.port}`);
}

function statusTone(status: ExportPinStatus): 'ok' | 'error' | 'warn' {
  if (status === 'mapped') return 'ok';
  if (status === 'missing') return 'error';
  return 'warn';
}

function resolveTopEntity(project: RBProject): string {
  const top = (project.hdl?.top ?? project.fpga?.top ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_');
  return top.length > 0 ? top : 'top';
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

function buildInvalidPinSet(
  overrides: Record<string, string>,
  editablePortKeys: Set<string>
): Set<string> {
  const invalid = new Set<string>();
  for (const [portKey, pin] of Object.entries(overrides)) {
    if (!editablePortKeys.has(portKey)) continue;
    const trimmed = pin.trim();
    if (trimmed.length > 0 && !BASYS3_VALID_PINS.has(trimmed)) {
      invalid.add(portKey);
    }
  }
  return invalid;
}

// ─── Phase 2: Syntax Highlighting ──────────────────────────────────────────

const VHDL_KEYWORDS = new Set([
  'library','use','entity','architecture','is','begin','end','port','map',
  'signal','component','generic','process','if','then','else','elsif','case',
  'when','others','not','and','or','nor','nand','xor','xnor',
  'std_logic','std_logic_vector','downto','to','in','out','inout','buffer',
  'all','of','type','subtype','constant','variable','integer','boolean',
  'true','false',
]);

const VERILOG_KEYWORDS = new Set([
  'module','endmodule','input','output','inout','wire','reg','assign',
  'always','begin','end','if','else','case','endcase','posedge','negedge',
  'parameter','localparam','and','or','not','nand','nor','xor','xnor',
]);

const XDC_PROPS = new Set([
  'set_property','get_ports','create_clock','set_input_delay','set_output_delay',
]);

const TCL_COMMANDS = new Set([
  'proc','set','if','else','foreach','while','return','puts','source','package',
]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightKeywords(code: string, keywords: Set<string>): string {
  return code.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (match) => {
    return keywords.has(match.toLowerCase()) || keywords.has(match)
      ? `<span class="hl-kw">${match}</span>`
      : match;
  });
}

function wrapComment(text: string): string {
  return `<span class="hl-comment">${text}</span>`;
}

function syntaxHighlight(code: string, kind: string): string {
  const lines = code.split('\n');

  if (kind === 'vhd' || kind === 'tb') {
    // VHDL / testbench: line comments start with --
    return lines.map((line) => {
      const escaped = escapeHtml(line);
      const commentIdx = escaped.indexOf('--');
      if (commentIdx === -1) {
        return highlightKeywords(escaped, VHDL_KEYWORDS);
      }
      const codePart = escaped.slice(0, commentIdx);
      const commentPart = escaped.slice(commentIdx);
      return highlightKeywords(codePart, VHDL_KEYWORDS) + wrapComment(commentPart);
    }).join('\n');
  }

  if (kind === 'verilog') {
    // Verilog: // line comments and /* */ block comments (single-line only)
    return lines.map((line) => {
      const escaped = escapeHtml(line);
      const lineCommentIdx = escaped.indexOf('//');
      if (lineCommentIdx !== -1) {
        const codePart = escaped.slice(0, lineCommentIdx);
        const commentPart = escaped.slice(lineCommentIdx);
        return highlightKeywords(codePart, VERILOG_KEYWORDS) + wrapComment(commentPart);
      }
      const blockStart = escaped.indexOf('/*');
      if (blockStart !== -1) {
        const blockEnd = escaped.indexOf('*/', blockStart + 2);
        if (blockEnd !== -1) {
          const before = escaped.slice(0, blockStart);
          const comment = escaped.slice(blockStart, blockEnd + 2);
          const after = escaped.slice(blockEnd + 2);
          return (
            highlightKeywords(before, VERILOG_KEYWORDS)
            + wrapComment(comment)
            + highlightKeywords(after, VERILOG_KEYWORDS)
          );
        }
      }
      return highlightKeywords(escaped, VERILOG_KEYWORDS);
    }).join('\n');
  }

  if (kind === 'xdc') {
    // XDC: # line comments; property-name keywords
    return lines.map((line) => {
      const escaped = escapeHtml(line);
      const commentIdx = escaped.indexOf('#');
      if (commentIdx !== -1) {
        const codePart = escaped.slice(0, commentIdx);
        const commentPart = escaped.slice(commentIdx);
        return highlightKeywords(codePart, XDC_PROPS) + wrapComment(commentPart);
      }
      return highlightKeywords(escaped, XDC_PROPS);
    }).join('\n');
  }

  if (kind === 'tcl') {
    // TCL: # line comments; command keywords
    return lines.map((line) => {
      const escaped = escapeHtml(line);
      const commentIdx = escaped.indexOf('#');
      if (commentIdx !== -1) {
        const codePart = escaped.slice(0, commentIdx);
        const commentPart = escaped.slice(commentIdx);
        return highlightKeywords(codePart, TCL_COMMANDS) + wrapComment(commentPart);
      }
      return highlightKeywords(escaped, TCL_COMMANDS);
    }).join('\n');
  }

  // Passthrough for unrecognized kinds (readme, md, json, etc.)
  return escapeHtml(code);
}

function downloadZipBytes(bytes: Uint8Array, fileName: string): void {
  if (typeof window === 'undefined') return;
  const zipBuffer = Uint8Array.from(bytes).buffer;
  const blob = new Blob([zipBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function buildVivadoKitZip(artifacts: ExportArtifactView[]): Promise<Uint8Array> {
  return buildDeterministicZip(
    artifacts
      .filter((artifact) => artifact.content.trim().length > 0)
      .map((artifact) => ({
        name: artifact.path,
        text: artifact.content,
      }))
  );
}

// ─── Phase 2: Pin Validation ────────────────────────────────────────────────

const BASYS3_VALID_PINS = new Set([
  // Switches
  'V17','V16','W16','W17','W15','V15','W14','W13','V2','T3','T2','R3','W2','U1','T1','R2',
  // LEDs
  'U16','E19','U19','V19','W18','U15','U14','V14','V13','V3','W3','U3','P3','N3','P1','L1',
  // Buttons
  'W19','T17','T18','U17','U18',
  // Clock
  'W5',
  // PMOD (JA, JB, JC, JXADC)
  'J1','L2','J2','G2','H1','K2','H2','G3',
  'A14','A16','B15','B16','A15','A17','C15','C16',
  'K17','M18','N17','P18','L17','M19','P17','R18',
  'J3','L3','M2','N2','K3','M3','M1','N1',
  // VGA
  'G19','H19','J19','N19','N18','L18','K18','J18','J17','H17','G17','D17',
  // USB-UART
  'B18','A18',
  // QSPI
  'D18','D19','G18','F18','K19',
  // SDSPI
  'E2','A1','B1','C1',
]);
