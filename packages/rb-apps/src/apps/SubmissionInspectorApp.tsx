// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RedByteApp } from '../types';
import styles from './SubmissionInspectorApp.module.css';
import JSZip from 'jszip';
import {
  replayHardwareTrace,
  evaluateChecks,
  type HardwareTraceEvent,
  type CheckResult,
} from '@redbyte/rb-fpga-proof-core';
import { verifyBundleSignature, type SignatureStatus } from '../utils/bundleSignature';
import { getLabTemplate, type LabTemplate } from '../utils/labTemplates';
import { assertAppOutput, registerAppInvariants } from '../utils/appInvariants';
import { hashEvidence, canonicalizeEvidence } from '../utils/evidenceExport';
import type { EvidenceBundle } from '../evidenceSchema';
import type { RBProject } from '../export/projectFormat';
import { decodeRBProject } from '../export/projectFormat';
import type {
  SubmissionBundleManifest,
  SubmissionGatesArtifact,
  SubmissionReproducibilityReport,
} from '../export/submissionBundle';
import {
  downloadClassroomDiagnosticsBundle,
  generateClassroomDiagnosticsBundle,
} from '../export/classroomDiagnosticsBundle';
import type { ToolchainDoctorReport } from '../fpga/toolchainTypes';
import { getClassroomLockdownState, getRedByteUiMode } from '../utils/uiMode';
import type { SubmissionGateResult } from '../labs/submissionGates';
import { NEO_STATUS } from '../ui/neoGlossary';

const INSPECTOR_INVARIANTS = {
  reads: ['bundle', 'lab_templates'],
  writes: ['replay_cursor'],
  outputs: ['grading-report.json'],
};

registerAppInvariants('submission-inspector', INSPECTOR_INVARIANTS);

interface BundleData {
  manifest: Record<string, any>;
  capsule: Record<string, any> | null;
  events: Array<Record<string, any>>;
  bundleKind?: 'legacy' | 'submission';
  schemaVersion?: 'v1' | 'v2';
  signatureStatus?: SignatureStatus;
  traceEvents?: HardwareTraceEvent[];
  traceReplay?: HardwareTraceEvent[];
  traceFilePresent?: boolean;
  bitstreamFilePresent?: boolean;
  labTemplate?: LabTemplate | null;
  checkResults?: CheckResult[];
  checksPass?: boolean;
  traceStats?: {
    event_count: number;
    hw_tick_min: number | null;
    hw_tick_max: number | null;
    mono_seq_nondecreasing: boolean;
  };
  missingArtifacts?: string[];
  hardware?: Record<string, any>;
  grade?: {
    json?: Record<string, any>;
    md?: string | null;
  };
  fileEntries?: string[];
  submission?: {
    manifest: SubmissionBundleManifest;
    doctorReport: ToolchainDoctorReport | null;
    reproducibility: SubmissionReproducibilityReport | null;
    submissionGates: SubmissionGateResult | null;
    submissionLabId: string | null;
    submissionTimestamp: string | null;
    embeddedProject: RBProject | null;
    targetAppId: 'logic-playground' | 'ece-lab';
    projectArchiveError: string | null;
  };
  // v1-json specific
  circuitSnapshot?: any;
  probesSnapshot?: any[];
}

interface InspectorProps {
  // Props injected by shell if opening with file
  filePath?: string;
  loadSample?: boolean;
  onOpenSubmissionProject?: (payload: {
    project: RBProject;
    targetAppId: 'logic-playground' | 'ece-lab';
  }) => void | Promise<void>;
}

function resolveSubmissionTargetApp(project: RBProject): 'logic-playground' | 'ece-lab' {
  const surface = typeof project.meta?.appSurface === 'string' ? project.meta.appSurface.trim().toLowerCase() : '';
  return surface === 'ece-lab' ? 'ece-lab' : 'logic-playground';
}

function parseOptionalJson<T>(value: string | null): T | null {
  if (value == null) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeSubmissionGates(
  payload: SubmissionGateResult | SubmissionGatesArtifact | null,
): SubmissionGateResult | null {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray((payload as SubmissionGateResult).issues)) {
    return payload as SubmissionGateResult;
  }
  const artifact = payload as SubmissionGatesArtifact;
  if (artifact.schema_version === 'rb_submission_gates_v1' && artifact.result) {
    return artifact.result;
  }
  return null;
}

type InspectorReadinessGateState = 'pass' | 'warn' | 'fail';

interface InspectorReadinessGateSummary {
  id: string;
  label: string;
  state: InspectorReadinessGateState;
  detail: string;
  nextAction: string | null;
}

type InspectorReproStatus = 'pass' | 'fail' | 'skipped';

interface InspectorReproSummary {
  status: InspectorReproStatus;
  reason: string;
}

interface SubmissionGradeSummary {
  verdict: 'ready' | 'not_ready';
  verdictLabel: string;
  verdictDetail: string;
  gates: InspectorReadinessGateSummary[];
  topFailingGates: InspectorReadinessGateSummary[];
  reproducibility: InspectorReproSummary;
}

const READINESS_PRIORITY_ORDER = [
  'toolchain_probe',
  'preflight',
  'implement_plan',
  'toolchain_ui',
  'doctor_export',
] as const;

function normalizeReadinessState(value: unknown): InspectorReadinessGateState {
  if (value === 'pass' || value === 'warn' || value === 'fail') return value;
  return 'fail';
}

function getReadinessPriority(id: string): number {
  const index = READINESS_PRIORITY_ORDER.indexOf(id as (typeof READINESS_PRIORITY_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortReadinessGates(gates: InspectorReadinessGateSummary[]): InspectorReadinessGateSummary[] {
  return [...gates].sort((left, right) => {
    const priorityDelta = getReadinessPriority(left.id) - getReadinessPriority(right.id);
    if (priorityDelta !== 0) return priorityDelta;
    return left.id.localeCompare(right.id);
  });
}

function collectReadinessGates(
  submission: BundleData['submission'] | null | undefined,
): InspectorReadinessGateSummary[] {
  if (!submission) return [];
  const gateMap = new Map<string, InspectorReadinessGateSummary>();

  const manifestGates = Array.isArray(submission.manifest?.readiness?.gates)
    ? submission.manifest.readiness.gates
    : [];
  for (const gate of manifestGates) {
    const id = String(gate.id ?? '').trim();
    if (id.length === 0) continue;
    gateMap.set(id, {
      id,
      label: id,
      state: normalizeReadinessState(gate.state),
      detail: String(gate.detail ?? '').trim() || 'No detail provided.',
      nextAction: null,
    });
  }

  const doctorGates = Array.isArray(submission.doctorReport?.studentReadiness?.gates)
    ? submission.doctorReport?.studentReadiness?.gates ?? []
    : [];
  for (const gate of doctorGates) {
    const id = String(gate.id ?? '').trim();
    if (id.length === 0) continue;
    gateMap.set(id, {
      id,
      label: String(gate.label ?? '').trim() || id,
      state: normalizeReadinessState(gate.state),
      detail: String(gate.detail ?? '').trim() || 'No detail provided.',
      nextAction:
        typeof gate.nextAction === 'string' && gate.nextAction.trim().length > 0
          ? gate.nextAction.trim()
          : null,
    });
  }

  const submissionGateIssues = Array.isArray(submission.submissionGates?.issues)
    ? submission.submissionGates?.issues ?? []
    : [];
  for (const issue of submissionGateIssues) {
    const gateId = `submission_gate:${issue.code}`;
    gateMap.set(gateId, {
      id: gateId,
      label: issue.title || issue.code,
      state: issue.severity === 'block' ? 'fail' : 'warn',
      detail: issue.message,
      nextAction: issue.fixHint ?? null,
    });
  }

  return sortReadinessGates(Array.from(gateMap.values()));
}

function toFirstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() ?? '';
}

function summarizeReproducibility(
  reproducibility: SubmissionReproducibilityReport | null | undefined,
): InspectorReproSummary {
  if (!reproducibility) {
    return {
      status: 'skipped',
      reason: 'Reproducibility report missing.',
    };
  }
  if (reproducibility.status === 'pass') {
    return {
      status: 'pass',
      reason: toFirstLine(reproducibility.detail || 'Replay verification passed.'),
    };
  }
  if (reproducibility.status === 'fail') {
    return {
      status: 'fail',
      reason: toFirstLine(reproducibility.detail || 'Replay verification failed.'),
    };
  }
  return {
    status: 'skipped',
    reason: toFirstLine(reproducibility.detail || 'Replay verification was skipped.'),
  };
}

function buildSubmissionGradeSummary(
  submission: BundleData['submission'] | null | undefined,
): SubmissionGradeSummary {
  const gates = collectReadinessGates(submission);
  const topFailingGates = gates.filter((gate) => gate.state === 'fail').slice(0, 3);
  const reproducibility = summarizeReproducibility(submission?.reproducibility);
  const allGatesPass = gates.length > 0 && gates.every((gate) => gate.state !== 'fail');
  const reproducibilityAcceptable = reproducibility.status !== 'fail';
  const verdict = allGatesPass && reproducibilityAcceptable ? 'ready' : 'not_ready';
  const verdictLabel =
    verdict === 'ready'
      ? reproducibility.status === 'skipped'
        ? `${NEO_STATUS.READY} (NO REPRO)`
        : NEO_STATUS.READY
      : NEO_STATUS.NOT_READY;
  const verdictDetail =
    verdict === 'ready'
      ? reproducibility.status === 'skipped'
        ? 'Readiness gates passed; reproducibility was skipped.'
        : 'Readiness gates and reproducibility checks passed.'
      : topFailingGates.length > 0
        ? `Needs action: ${topFailingGates.map((gate) => gate.label).join(', ')}.`
        : reproducibility.status === 'fail'
          ? 'Reproducibility verification failed.'
          : 'Readiness information is incomplete.';

  return {
    verdict,
    verdictLabel,
    verdictDetail,
    gates,
    topFailingGates,
    reproducibility,
  };
}

export const SubmissionInspectorAppContent: React.FC<InspectorProps> = ({
  loadSample,
  onOpenSubmissionProject,
}) => {
  const [bundle, setBundle] = useState<BundleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'vectors' | 'events' | 'hardware' | 'files'>('summary');
  const [demoMode, setDemoMode] = useState(false);
  const [openingEmbeddedProject, setOpeningEmbeddedProject] = useState(false);
  const [traceCursor, setTraceCursor] = useState(0);
  const [traceCurrent, setTraceCurrent] = useState<HardwareTraceEvent | null>(null);
  const hasAutoLoadedSample = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uiMode = getRedByteUiMode();
  const isTaMode = uiMode === 'ta';
  const classroomLockdownEnabled = getClassroomLockdownState().enabled;
  const isLockdownRestricted = classroomLockdownEnabled && !isTaMode;

  if (isLockdownRestricted) {
    return (
      <div className={styles.container} data-testid="submission-inspector-lockdown">
        <div className={styles.panel}>
          <h1 className={styles.title}>Submission Inspector Locked</h1>
          <p className={styles.description}>
            Classroom Lockdown is enabled. Use TA mode (`rb:mode=ta` or `?ta=1`) to access grading tools.
          </p>
        </div>
      </div>
    );
  }

  const parseJsonEvidence = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text) as EvidenceBundle;

      // Verify Integrity
      const { integrity, ...rest } = json;
      const canonical = canonicalizeEvidence(rest);
      const { hash } = hashEvidence(canonical);

      const isVerified = integrity?.integrityHash === hash;
      const signatureStatus: SignatureStatus = isVerified ? 'Valid' : 'Invalid';

      // Map to BundleData
      setBundle({
        manifest: {
          lab_id: json.context.selectedExampleId || 'Unknown Lab',
          created_at: json.exportedAtIso,
          redbyte_version: json.app.version,
          student: { name: 'Unknown (v1)' },
        },
        capsule: null,
        events: [],
        bundleKind: 'legacy',
        schemaVersion: 'v1', // Using v1 for JSON evidence
        signatureStatus,
        traceEvents: [],
        traceReplay: [],
        traceFilePresent: false,
        bitstreamFilePresent: false,
        missingArtifacts: [],
        checkResults: [],
        checksPass: isVerified,
        traceStats: undefined,
        hardware: undefined,
        grade: undefined,
        circuitSnapshot: json.circuitSnapshot,
        probesSnapshot: json.probesSnapshot,
      });
      setActiveTab('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON evidence');
      setBundle(null);
    }
  }, []);

  const parseBundle = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    if (file.name.endsWith('.json')) {
      await parseJsonEvidence(file);
      setLoading(false);
      return;
    }

    try {
      const zipBytes = new Uint8Array(await file.arrayBuffer());
      const zip = new JSZip();
      const loaded = await zip.loadAsync(zipBytes);
      const fileEntries = Object.keys(loaded.files)
        .filter((entry) => !loaded.files[entry]?.dir)
        .sort((left, right) => left.localeCompare(right));

      // Parse manifest
      const manifestFile = loaded.file('manifest.json');
      if (!manifestFile) throw new Error('manifest.json not found');
      const manifest = JSON.parse(await manifestFile.async('string'));

      if (manifest?.schema_version === 'rb_submission_manifest_v1') {
        const signatureStatus = await verifyBundleSignature(zipBytes);
        const doctorReport = parseOptionalJson<ToolchainDoctorReport>(
          loaded.file('doctor-report.json')
            ? await loaded.file('doctor-report.json')!.async('string')
            : null
        );
        const reproducibility = parseOptionalJson<SubmissionReproducibilityReport>(
          loaded.file('reproducibility.json')
            ? await loaded.file('reproducibility.json')!.async('string')
            : null
        );
        const submissionGatesArtifact = parseOptionalJson<SubmissionGateResult | SubmissionGatesArtifact>(
          loaded.file('submission-gates.json')
            ? await loaded.file('submission-gates.json')!.async('string')
            : null,
        );
        const submissionGates = normalizeSubmissionGates(submissionGatesArtifact);
        const submissionLabId =
          submissionGatesArtifact && typeof submissionGatesArtifact === 'object' && !Array.isArray((submissionGatesArtifact as SubmissionGateResult).issues)
            ? (submissionGatesArtifact as SubmissionGatesArtifact).labId ?? null
            : null;
        const submissionTimestamp =
          submissionGatesArtifact && typeof submissionGatesArtifact === 'object' && !Array.isArray((submissionGatesArtifact as SubmissionGateResult).issues)
            ? (submissionGatesArtifact as SubmissionGatesArtifact).timestamp ?? null
            : null;

        let embeddedProject: RBProject | null = null;
        let projectArchiveError: string | null = null;
        let targetAppId: 'logic-playground' | 'ece-lab' = 'logic-playground';
        const projectArchiveFile = loaded.file('project.rbx.zip');
        if (!projectArchiveFile) {
          projectArchiveError = 'project.rbx.zip missing from submission bundle.';
        } else {
          try {
            const projectArchiveBytes = await projectArchiveFile.async('uint8array');
            const projectArchive = await new JSZip().loadAsync(projectArchiveBytes);
            const rbProjectFile = projectArchive.file('rb-project.json');
            if (!rbProjectFile) {
              projectArchiveError = 'rb-project.json missing inside project.rbx.zip.';
            } else {
              embeddedProject = decodeRBProject(await rbProjectFile.async('string'));
              targetAppId = resolveSubmissionTargetApp(embeddedProject);
            }
          } catch (archiveError) {
            projectArchiveError = archiveError instanceof Error
              ? archiveError.message
              : 'Failed to parse project.rbx.zip.';
          }
        }

        setBundle({
          manifest,
          capsule: null,
          events: [],
          bundleKind: 'submission',
          signatureStatus,
          traceEvents: [],
          traceReplay: [],
          traceFilePresent: false,
          bitstreamFilePresent: false,
          missingArtifacts: [],
          checkResults: [],
          checksPass: reproducibility?.status === 'pass',
          traceStats: undefined,
          hardware: undefined,
          grade: undefined,
          fileEntries,
          submission: {
            manifest: manifest as SubmissionBundleManifest,
            doctorReport,
            reproducibility,
            submissionGates,
            submissionLabId,
            submissionTimestamp,
            embeddedProject,
            targetAppId,
            projectArchiveError,
          },
        });
        setTraceCursor(0);
        setTraceCurrent(null);
        setDemoMode(false);
        setActiveTab('summary');
        return;
      }

      const schemaVersion = manifest.schema_version === 'v2' ? 'v2' : 'v1';

      // Parse capsule (v1 proof capsule only)
      const capsulePath = schemaVersion === 'v2' ? null : 'proofs/capsule.json';
      const capsuleFile = capsulePath ? loaded.file(capsulePath) : null;
      const capsule = capsuleFile ? JSON.parse(await capsuleFile.async('string')) : null;

      // Parse events (NDJSON)
      let events: Array<Record<string, any>> = [];
      let traceEvents: HardwareTraceEvent[] = [];
      let traceFilePresent = false;
      let bitstreamFilePresent = false;
      let traceStats: BundleData['traceStats'] = undefined;
      let missingArtifacts: string[] = [];
      if (schemaVersion === 'v2') {
        const traceFile = loaded.file('trace/hw_trace.ndjson');
        const traceText = traceFile ? await traceFile.async('string') : '';
        traceFilePresent = !!traceFile;
        traceEvents = traceText
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line))
          .filter((event) => typeof event?.hw_tick === 'number' && typeof event?.mono_seq === 'number');
        bitstreamFilePresent = !!loaded.file('bitstream/design.bit');
        if (!traceFilePresent) missingArtifacts.push('trace/hw_trace.ndjson');
        if (!bitstreamFilePresent) missingArtifacts.push('bitstream/design.bit');

        let minTick: number | null = null;
        let maxTick: number | null = null;
        let monoNondecreasing = true;
        let prevSeq: number | null = null;
        for (const event of traceEvents) {
          if (minTick === null || event.hw_tick < minTick) minTick = event.hw_tick;
          if (maxTick === null || event.hw_tick > maxTick) maxTick = event.hw_tick;
          if (prevSeq !== null && event.mono_seq < prevSeq) {
            monoNondecreasing = false;
          }
          prevSeq = event.mono_seq;
        }

        traceStats = {
          event_count: traceEvents.length,
          hw_tick_min: minTick,
          hw_tick_max: maxTick,
          mono_seq_nondecreasing: monoNondecreasing,
        };
      } else {
        const eventsFile = loaded.file('proofs/events.ndjson');
        events = eventsFile
          ? (await eventsFile.async('string'))
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
          : [];
      }

      // Parse hardware if present
      const hardwarePath = schemaVersion === 'v2' ? null : 'proofs/hardware.json';
      const hardwareFile = hardwarePath ? loaded.file(hardwarePath) : null;
      const hardware = hardwareFile ? JSON.parse(await hardwareFile.async('string')) : null;

      // Parse grade artifacts if present
      const gradeJsonFile = loaded.file('grade.json');
      const gradeMdFile = loaded.file('grade.md');
      const grade = {
        json: gradeJsonFile ? JSON.parse(await gradeJsonFile.async('string')) : null,
        md: gradeMdFile ? await gradeMdFile.async('string') : null,
      };

      // Parse circuit snapshot if present
      const circuitSnapshotFile = loaded.file('proofs/circuit_snapshot.json');
      const circuitSnapshot = circuitSnapshotFile
        ? JSON.parse(await circuitSnapshotFile.async('string'))
        : null;

      const signatureStatus = await verifyBundleSignature(zipBytes);
      const traceReplay = traceEvents.length > 0 ? Array.from(replayHardwareTrace(traceEvents)) : [];
      const labTemplate = manifest?.lab_id ? getLabTemplate(String(manifest.lab_id)) : null;
      const checkEvaluation = evaluateChecks(labTemplate, traceReplay);

      setBundle({
        manifest,
        capsule,
        events,
        bundleKind: 'legacy',
        schemaVersion,
        signatureStatus,
        traceEvents,
        traceReplay,
        traceFilePresent,
        bitstreamFilePresent,
        labTemplate,
        checkResults: checkEvaluation.results,
        checksPass: checkEvaluation.pass,
        traceStats,
        missingArtifacts,
        hardware,
        grade,
        circuitSnapshot,
        fileEntries,
      });
      setTraceCursor(0);
      setTraceCurrent(null);
      setActiveTab('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse bundle');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadSample = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/samples/basys3_mvp_sample.rb-lab.zip');
      if (!response.ok) {
        throw new Error('Sample bundle not found');
      }
      const buffer = await response.arrayBuffer();
      const file = new File([buffer], 'basys3_mvp_sample.rb-lab.zip', { type: 'application/zip' });
      await parseBundle(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample bundle');
      setLoading(false);
    }
  }, [parseBundle]);

  useEffect(() => {
    if (!loadSample || hasAutoLoadedSample.current) return;
    hasAutoLoadedSample.current = true;
    handleLoadSample();
  }, [handleLoadSample, loadSample]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      parseBundle(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).style.background = 'rgba(0, 135, 255, 0.1)';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.background = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).style.background = '';
    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (file.name.endsWith('.rb-lab.zip') ||
        file.name.endsWith('.rbx.zip') ||
        file.name.endsWith('.zip') ||
        file.name.endsWith('.json'))
    ) {
      parseBundle(file);
    }
  };

  const handleTraceStep = () => {
    if (!bundle?.traceReplay || bundle.traceReplay.length === 0) return;
    if (traceCursor >= bundle.traceReplay.length) return;
    const next = bundle.traceReplay[traceCursor];
    setTraceCurrent(next);
    setTraceCursor(traceCursor + 1);
  };

  const handleExportGradingReport = () => {
    if (!bundle) return;
    assertAppOutput('submission-inspector', 'grading-report.json');
    const report = {
      schema_version: 'grade_v1',
      bundle: {
        lab_id: bundle.manifest?.lab_id ?? null,
        lab_version: bundle.manifest?.lab_version ?? null,
        signature_status: bundle.signatureStatus ?? 'Unsigned',
        event_count: bundle.traceStats?.event_count ?? 0,
        hw_tick_min: bundle.traceStats?.hw_tick_min ?? null,
        hw_tick_max: bundle.traceStats?.hw_tick_max ?? null,
        mono_seq_monotonic: bundle.traceStats?.mono_seq_nondecreasing ?? null,
      },
      checks: bundle.checkResults ?? [],
      overall_pass: bundle.checksPass ?? true,
      generated_ts_wall: Date.now(),
      redbyte_version: bundle.manifest?.redbyte_version ?? 'unknown',
    };
    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const labId = bundle.manifest?.lab_id ?? 'lab';
    link.href = url;
    link.download = `${labId}_grading_report.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleOpenEmbeddedProject = useCallback(async () => {
    if (!bundle?.submission?.embeddedProject || !onOpenSubmissionProject) {
      return;
    }
    setOpeningEmbeddedProject(true);
    setError(null);
    try {
      await onOpenSubmissionProject({
        project: bundle.submission.embeddedProject,
        targetAppId: bundle.submission.targetAppId,
      });
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Failed to open embedded project');
    } finally {
      setOpeningEmbeddedProject(false);
    }
  }, [bundle, onOpenSubmissionProject]);

  const isSubmissionBundle = bundle?.bundleKind === 'submission';
  const submissionGradeSummary = isSubmissionBundle ? buildSubmissionGradeSummary(bundle?.submission) : null;
  const handleExportDiagnosticsBundle = useCallback(() => {
    if (!bundle) return;
    void (async () => {
      const doctorReport = bundle.submission?.doctorReport ?? null;
      const bundleDiagnostics = await generateClassroomDiagnosticsBundle({
        source: 'submission-inspector',
        mode: uiMode,
        app: {
          envMode: import.meta.env.MODE ?? null,
          appVersion: import.meta.env.VITE_APP_VERSION ?? null,
          buildId: import.meta.env.VITE_GIT_SHA ?? null,
        },
        environment: {
          platform: typeof navigator !== 'undefined' ? navigator.platform : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
        doctorReport,
        readiness: doctorReport?.studentReadiness ?? null,
        probe: doctorReport?.probe ?? null,
        preflight: doctorReport?.preflight ?? null,
        buildPath: doctorReport?.buildPath ?? null,
        logs: doctorReport?.logs ?? [],
        context: {
          bundleKind: bundle.bundleKind ?? null,
          schemaVersion: bundle.schemaVersion ?? null,
          signatureStatus: bundle.signatureStatus ?? null,
          fileEntries: bundle.fileEntries ?? [],
          submissionManifest: bundle.submission?.manifest ?? null,
          reproducibility: bundle.submission?.reproducibility ?? null,
          gradeSummary: submissionGradeSummary
            ? {
                verdict: submissionGradeSummary.verdict,
                verdictLabel: submissionGradeSummary.verdictLabel,
                verdictDetail: submissionGradeSummary.verdictDetail,
                reproducibility: submissionGradeSummary.reproducibility,
                topFailingGateIds: submissionGradeSummary.topFailingGates.map((gate) => gate.id),
              }
            : null,
        },
      });
      downloadClassroomDiagnosticsBundle(bundleDiagnostics);
    })().catch((exportError) => {
      setError(exportError instanceof Error ? exportError.message : 'Failed to export diagnostics bundle');
    });
  }, [bundle, submissionGradeSummary, uiMode]);

  if (!bundle) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Submission Inspector</h1>
          <p className={styles.subtitle}>Open a submission bundle (.rb-lab.zip or rb-submission-*.zip)</p>
        </div>

        <div
          className={`${styles.dropZone} rbEmptyState`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.dropZoneIcon}>📦</div>
          <div className={styles.dropZoneTitle}>Drop submission bundle file here</div>
          <div className={styles.dropZoneOr}>or</div>
          <button
            className={`${styles.browseButton} rbButtonPrimary`}
            onClick={() => fileInputRef.current?.click()}
          >
            Browse for File
          </button>
          <div className={styles.dropZoneOr}>or</div>
          <button
            className={`${styles.browseButton} rbButtonPrimary`}
            onClick={handleLoadSample}
            type="button"
          >
            Load Sample Submission
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".rb-lab.zip,.rbx.zip,.zip,.json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            aria-label="Upload submission file"
          />
        </div>

        {error && (
          <div className={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className={styles.loading}>Loading bundle...</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Submission Inspector</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={styles.closeButton}
            onClick={() => {
              setBundle(null);
              setError(null);
              setDemoMode(false);
            }}
          >
            ← Open Bundle
          </button>
          {isTaMode ? (
            <button
              className={styles.closeButton}
              onClick={handleExportDiagnosticsBundle}
              data-testid="submission-inspector-export-diagnostics-button"
            >
              Export Diagnostics Bundle
            </button>
          ) : null}
          {!isSubmissionBundle ? (
          <button
            className={styles.closeButton}
            onClick={() => setDemoMode(!demoMode)}
            style={{
              background: demoMode ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: demoMode ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255, 255, 255, 0.1)',
              color: demoMode ? '#3B82F6' : '#94a3b8',
            }}
          >
            {demoMode ? '✓ Demo Mode' : 'Demo Mode'}
          </button>
          ) : null}
        </div>
      </div>

      {demoMode && !isSubmissionBundle ? (
        // Demo Mode: Presentation layout
        <div className={styles.demoModeContainer}>
          <div className={styles.demoVerdictSection}>
            <div className={styles.demoVerdictBadge} style={{
              background: bundle.capsule?.summary?.all_passed
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              borderColor: bundle.capsule?.summary?.all_passed
                ? 'rgba(16, 185, 129, 0.5)'
                : 'rgba(239, 68, 68, 0.5)',
              color: bundle.capsule?.summary?.all_passed ? '#10b981' : '#ef4444',
            }}>
              {bundle.capsule?.summary?.all_passed ? 'PASS' : 'FAIL'}
            </div>
          </div>

          <div className={styles.demoHeader}>
            <div>
              <h2 className={styles.demoTitle}>{bundle.manifest.student?.name || 'Unknown Student'}</h2>
              <p className={styles.demoSubtitle}>{bundle.manifest.lab_id}</p>
            </div>
            <div className={styles.demoStats}>
              <div className={styles.demoStat}>
                <span className={styles.demoStatLabel}>Passed</span>
                <span className={styles.demoStatValue} style={{ color: '#10b981' }}>
                  {bundle.capsule?.summary?.passed || 0}
                </span>
              </div>
              <div className={styles.demoStat}>
                <span className={styles.demoStatLabel}>Failed</span>
                <span className={styles.demoStatValue} style={{ color: '#ef4444' }}>
                  {bundle.capsule?.summary?.failed || 0}
                </span>
              </div>
              <div className={styles.demoStat}>
                <span className={styles.demoStatLabel}>Total</span>
                <span className={styles.demoStatValue}>{bundle.capsule?.summary?.total || 0}</span>
              </div>
            </div>
          </div>

          <div className={styles.demoContent}>
            <div className={styles.demoVectors}>
              <h3>Test Vectors</h3>
              <div className={styles.demoVectorsList}>
                {bundle.capsule?.vectors?.map((vec: any, idx: number) => (
                  <div key={idx} className={styles.demoVectorRow}>
                    <span className={styles.demoVectorName}>{vec.name}</span>
                    <span className={`${styles.demoVectorResult} ${vec.pass ? styles.demoResultPass : styles.demoResultFail}`}>
                      {vec.pass ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                )) || <div className={styles.demoEmpty}>No vectors</div>}
              </div>
            </div>

            {bundle.hardware && (
              <div className={styles.demoHardware}>
                <h3>Hardware Snapshots</h3>
                <div className={styles.demoSnapshotGallery}>
                  {bundle.hardware.snapshots?.map((snap: any, idx: number) => (
                    <div key={idx} className={styles.demoSnapshotTile}>
                      <div className={styles.demoSnapshotTime}>{snap.timestamp}</div>
                      <div className={styles.demoSnapshotData}>
                        <div><strong>In:</strong> {JSON.stringify(snap.inputs)}</div>
                        <div><strong>Out:</strong> {JSON.stringify(snap.outputs)}</div>
                      </div>
                    </div>
                  )) || <div className={styles.demoEmpty}>No snapshots</div>}
                </div>
              </div>
            )}

            <div className={styles.demoEvents}>
              <h3>Timeline</h3>
              <div className={styles.demoEventsList}>
                {bundle.events?.slice(0, 10).map((event: any, idx: number) => (
                  <div key={idx} className={styles.demoEventRow}>
                    <span className={styles.demoEventTime}>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span className={styles.demoEventType}>{event.type}</span>
                  </div>
                )) || <div className={styles.demoEmpty}>No events</div>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Normal Mode: Tabs
        <>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              Summary
            </button>
            {!isSubmissionBundle && (
              <button
                className={`${styles.tab} ${activeTab === 'vectors' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('vectors')}
              >
                Vectors ({bundle.capsule?.vectors?.length || 0})
              </button>
            )}
            {!isSubmissionBundle && (
              <button
                className={`${styles.tab} ${activeTab === 'events' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('events')}
              >
                Events ({bundle.events.length})
              </button>
            )}
            {!isSubmissionBundle && bundle.hardware && (
              <button
                className={`${styles.tab} ${activeTab === 'hardware' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('hardware')}
              >
                Hardware ({bundle.hardware.snapshots?.length || 0})
              </button>
            )}
            <button
              className={`${styles.tab} ${activeTab === 'files' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('files')}
            >
              Files
            </button>
          </div>

          <div className={styles.content}>
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className={styles.panel}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{isSubmissionBundle ? 'Grader Summary' : 'Submission Summary'}</h2>
                  {!isSubmissionBundle ? (
                    <button className={styles.exportButton} onClick={handleExportGradingReport}>
                      Export Report
                    </button>
                  ) : null}
                  {isSubmissionBundle && bundle.submission?.embeddedProject && onOpenSubmissionProject ? (
                    <button
                      className={styles.exportButton}
                      onClick={() => void handleOpenEmbeddedProject()}
                      disabled={openingEmbeddedProject}
                      data-testid="submission-inspector-open-embedded-project"
                    >
                      {openingEmbeddedProject ? 'Opening...' : 'Open Embedded Project'}
                    </button>
                  ) : null}
                </div>

                {isSubmissionBundle ? (
                  <div data-testid="submission-inspector-grader-summary">
                    <div
                      className={`${styles.verdictBanner} ${
                        submissionGradeSummary?.verdict === 'ready' ? styles.verdictReady : styles.verdictNotReady
                      }`}
                      data-testid="submission-inspector-grade-verdict"
                    >
                      <div className={styles.verdictLabel} data-testid="submission-inspector-grade-verdict-label">
                        {submissionGradeSummary?.verdictLabel ?? NEO_STATUS.NOT_READY}
                      </div>
                      <div className={styles.verdictDetail}>
                        {submissionGradeSummary?.verdictDetail ?? 'Readiness details unavailable.'}
                      </div>
                    </div>

                    <div className={styles.quickSummaryRow}>
                      <div className={styles.quickSummaryCard} data-testid="submission-inspector-repro-summary">
                        <div className={styles.quickSummaryLabel}>Reproducibility</div>
                        <div
                          className={`${styles.quickSummaryPill} ${
                            submissionGradeSummary?.reproducibility.status === 'pass'
                              ? styles.quickPillPass
                              : submissionGradeSummary?.reproducibility.status === 'fail'
                                ? styles.quickPillFail
                                : styles.quickPillSkipped
                          }`}
                        >
                          {submissionGradeSummary?.reproducibility.status === 'pass'
                            ? 'PASS'
                            : submissionGradeSummary?.reproducibility.status === 'fail'
                              ? 'FAIL'
                              : 'SKIPPED'}
                        </div>
                        <div className={styles.quickSummaryDetail}>
                          {submissionGradeSummary?.reproducibility.reason ?? 'No reproducibility details.'}
                        </div>
                      </div>
                      <div className={styles.quickSummaryCard}>
                        <div className={styles.quickSummaryLabel}>Top Failing Gates</div>
                        {submissionGradeSummary?.topFailingGates.length ? (
                          <div className={styles.quickFailingList} data-testid="submission-inspector-top-failing-gates">
                            {submissionGradeSummary.topFailingGates.map((gate) => (
                              <div
                                key={gate.id}
                                className={styles.quickFailingItem}
                                data-testid={`submission-inspector-failing-gate-${gate.id}`}
                              >
                                <span className={styles.quickFailingLabel}>{gate.label}</span>
                                <span className={styles.quickFailingDetail}>
                                  {gate.nextAction ?? gate.detail}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={styles.quickSummaryDetail}>No failing readiness gates.</div>
                        )}
                      </div>
                    </div>

                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Bundle ID</div>
                        <div className={styles.summaryValue}>{bundle.submission?.manifest.bundleId ?? 'unknown'}</div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Lab ID</div>
                        <div className={styles.summaryValue} data-testid="submission-inspector-summary-lab-id">
                          {bundle.submission?.submissionLabId ?? 'unknown'}
                        </div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Timestamp</div>
                        <div className={styles.summaryValue} data-testid="submission-inspector-summary-timestamp">
                          {bundle.submission?.submissionTimestamp ?? 'unknown'}
                        </div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Status</div>
                        <div className={styles.summaryValue}>{bundle.submission?.manifest.status ?? 'unknown'}</div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Project</div>
                        <div className={styles.summaryValue}>{bundle.submission?.manifest.project?.name ?? 'Unknown'}</div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Readiness</div>
                        <div className={styles.summaryValue}>
                          {submissionGradeSummary?.gates.every((gate) => gate.state === 'pass')
                            ? 'ready'
                            : bundle.submission?.manifest.readiness?.overall ?? 'needs_action'}
                        </div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Reproducibility</div>
                        <div className={styles.summaryValue}>
                          {submissionGradeSummary?.reproducibility.status === 'pass'
                            ? 'pass'
                            : submissionGradeSummary?.reproducibility.status === 'fail'
                              ? 'fail'
                              : 'skipped'}
                        </div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Open Target</div>
                        <div className={styles.summaryValue}>{bundle.submission?.targetAppId ?? 'logic-playground'}</div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Toolchain</div>
                        <div className={styles.summaryValue} data-testid="submission-inspector-summary-toolchain">
                          {bundle.submission?.doctorReport?.backend_id ?? 'unknown'}
                        </div>
                      </div>
                    </div>

                    <div className={styles.summarySection}>
                      <h3>Readiness Gates</h3>
                      {submissionGradeSummary?.gates.length ? (
                        <div className={styles.checkList}>
                          {submissionGradeSummary.gates.map((gate) => (
                            <div key={gate.id} className={styles.checkItem}>
                              <span className={styles.checkLabel}>{gate.label}</span>
                              <span
                                className={`${styles.checkStatus} ${
                                  gate.state === 'pass'
                                    ? styles.checkPass
                                    : gate.state === 'fail'
                                      ? styles.checkFail
                                      : ''
                                }`}
                              >
                                {gate.state}
                              </span>
                              <span className={styles.checkMessage}>{gate.detail}</span>
                              {gate.nextAction ? (
                                <span className={styles.checkMessage}>Next action: {gate.nextAction}</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.empty}>No readiness gates in manifest.</div>
                      )}
                    </div>

                    {bundle.submission?.projectArchiveError ? (
                      <div className={styles.error}>Embedded project error: {bundle.submission.projectArchiveError}</div>
                    ) : null}

                    {!bundle.submission?.embeddedProject ? (
                      <div className={styles.missingItem}>Embedded project archive is unavailable.</div>
                    ) : null}

                    {!onOpenSubmissionProject ? (
                      <div className={styles.missingItem}>Shell import callback unavailable. Open project manually from bundle.</div>
                    ) : null}
                  </div>
                ) : (
                <>
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Lab ID</div>
                    <div className={styles.summaryValue}>{bundle.manifest.lab_id}</div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Schema</div>
                    <div className={styles.summaryValue}>{bundle.schemaVersion || 'unknown'}</div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Lab Version</div>
                    <div className={styles.summaryValue}>{bundle.manifest.lab_version || 'N/A'}</div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Student</div>
                    <div className={styles.summaryValue}>{bundle.manifest.student?.name || 'Unknown'}</div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Student ID</div>
                    <div className={styles.summaryValue}>{bundle.manifest.student?.id || '—'}</div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Created</div>
                    <div className={styles.summaryValue}>
                      {new Date(bundle.manifest.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryLabel}>Signature</div>
                    <div className={styles.summaryValue}>{bundle.signatureStatus || 'Unsigned'}</div>
                  </div>

                  {bundle.schemaVersion === 'v2' && (
                    <>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Trace</div>
                        <div className={styles.summaryValue}>
                          {bundle.traceFilePresent
                            ? `${bundle.traceReplay?.length ?? 0} events`
                            : 'Missing'}
                        </div>
                      </div>
                      <div className={styles.summaryCard}>
                        <div className={styles.summaryLabel}>Bitstream</div>
                        <div className={styles.summaryValue}>
                          {bundle.bitstreamFilePresent ? 'Present' : 'Missing'}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {bundle.schemaVersion === 'v2' && bundle.missingArtifacts && bundle.missingArtifacts.length > 0 && (
                  <div className={styles.missingSection}>
                    {bundle.missingArtifacts.map((artifact) => (
                      <div key={artifact} className={styles.missingItem}>
                        Missing: {artifact}
                      </div>
                    ))}
                  </div>
                )}

                {bundle.capsule && (
                  <div className={styles.summarySection}>
                    <h3>Self-Check Summary</h3>
                    <div className={styles.summaryStats}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Passed</span>
                        <span className={styles.statValue} style={{ color: '#10b981' }}>
                          {bundle.capsule.summary?.passed || 0}
                        </span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Failed</span>
                        <span className={styles.statValue} style={{ color: '#ef4444' }}>
                          {bundle.capsule.summary?.failed || 0}
                        </span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Total</span>
                        <span className={styles.statValue}>{bundle.capsule.summary?.total || 0}</span>
                      </div>
                      {bundle.capsule.summary?.score != null && (
                        <div className={styles.stat}>
                          <span className={styles.statLabel}>Score</span>
                          <span className={styles.statValue}>{bundle.capsule.summary.score}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {bundle.capsule?.completedSteps && (
                  <div className={styles.summarySection}>
                    <h3>Lab Progress</h3>
                    <div className={styles.summaryStats}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Steps Completed</span>
                        <span className={styles.statValue}>{bundle.capsule.completedSteps.length}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Verdict</span>
                        <span className={styles.statValue} style={{
                          color: bundle.capsule.isPass ? '#10b981' : '#ef4444'
                        }}>
                          {bundle.capsule.isPass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                    {bundle.capsule.evidenceHash && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                        Integrity Hash: <code>{bundle.capsule.evidenceHash}</code>
                      </div>
                    )}
                  </div>
                )}

                {bundle.circuitSnapshot && (
                  <div className={styles.summarySection}>
                    <h3>Circuit Snapshot</h3>
                    <div className={styles.summaryStats}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Nodes</span>
                        <span className={styles.statValue}>{bundle.circuitSnapshot.nodeCount ?? '?'}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Wires</span>
                        <span className={styles.statValue}>{bundle.circuitSnapshot.wireCount ?? '?'}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Tick</span>
                        <span className={styles.statValue}>{bundle.circuitSnapshot.tick ?? '?'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {bundle.schemaVersion === 'v2' && (
                  <div className={styles.summarySection}>
                    <h3>Hardware Trace</h3>
                    {bundle.traceReplay && bundle.traceReplay.length > 0 ? (
                      <>
                        <div className={styles.summaryStats}>
                          <div className={styles.stat}>
                            <span className={styles.statLabel}>Events</span>
                            <span className={styles.statValue}>{bundle.traceReplay.length}</span>
                          </div>
                          <div className={styles.stat}>
                            <span className={styles.statLabel}>First hw_tick</span>
                            <span className={styles.statValue}>{bundle.traceReplay[0]?.hw_tick ?? 0}</span>
                          </div>
                          <div className={styles.stat}>
                            <span className={styles.statLabel}>Last hw_tick</span>
                            <span className={styles.statValue}>
                              {bundle.traceReplay[bundle.traceReplay.length - 1]?.hw_tick ?? 0}
                            </span>
                          </div>
                        </div>
                        <button
                          className={styles.closeButton}
                          onClick={handleTraceStep}
                          disabled={traceCursor >= bundle.traceReplay.length}
                        >
                          Next Trace Event
                        </button>
                        {traceCurrent && (
                          <pre className={styles.codeBlock}>{JSON.stringify(traceCurrent, null, 2)}</pre>
                        )}
                      </>
                    ) : (
                      <div className={styles.empty}>No hardware trace in bundle</div>
                    )}
                  </div>
                )}

                {bundle.schemaVersion === 'v2' && bundle.traceStats && (
                  <div className={styles.summarySection}>
                    <h3>Bundle Health</h3>
                    <div className={styles.summaryStats}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Event Count</span>
                        <span className={styles.statValue}>{bundle.traceStats.event_count}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>hw_tick Min</span>
                        <span className={styles.statValue}>
                          {bundle.traceStats.hw_tick_min ?? 'N/A'}
                        </span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>hw_tick Max</span>
                        <span className={styles.statValue}>
                          {bundle.traceStats.hw_tick_max ?? 'N/A'}
                        </span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>mono_seq OK</span>
                        <span className={styles.statValue}>
                          {bundle.traceStats.mono_seq_nondecreasing ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {bundle.checkResults && bundle.checkResults.length > 0 && (
                  <div className={styles.summarySection}>
                    <h3>Checks</h3>
                    <div className={styles.summaryStats}>
                      <div className={styles.stat}>
                        <span className={styles.statLabel}>Overall</span>
                        <span
                          className={`${styles.statValue} ${bundle.checksPass ? styles.checkPass : styles.checkFail
                            }`}
                        >
                          {bundle.checksPass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.checkList}>
                      {bundle.checkResults.map((result) => (
                        <div key={result.id} className={styles.checkItem}>
                          <span
                            className={`${styles.checkStatus} ${result.pass ? styles.checkPass : styles.checkFail
                              }`}
                          >
                            {result.pass ? 'PASS' : 'FAIL'}
                          </span>
                          <span className={styles.checkLabel}>{result.id}</span>
                          <span className={styles.checkMessage}>{result.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bundle.grade?.json && (
                  <div className={styles.summarySection}>
                    <h3>Grade</h3>
                    <pre className={styles.codeBlock}>{JSON.stringify(bundle.grade.json, null, 2)}</pre>
                  </div>
                )}

                {bundle.grade?.md && (
                  <div className={styles.summarySection}>
                    <h3>Grade Details</h3>
                    <pre className={styles.codeBlock}>{bundle.grade.md}</pre>
                  </div>
                )}
              </>
                )}
              </div>
            )}

            {/* Vectors Tab */}
            {!isSubmissionBundle && activeTab === 'vectors' && (
              <div className={styles.panel}>
                <h2 className={styles.sectionTitle}>Test Vectors</h2>
                {bundle.capsule?.vectors && bundle.capsule.vectors.length > 0 ? (
                  <div className={styles.vectorsList}>
                    {bundle.capsule.vectors.map((vec: any, idx: number) => (
                      <div key={idx} className={styles.vectorCard}>
                        <div className={styles.vectorHeader}>
                          <span className={styles.vectorName}>{vec.name}</span>
                          <span className={`${styles.vectorBadge} ${vec.pass ? styles.badgePass : styles.badgeFail}`}>
                            {vec.pass ? 'PASS' : 'FAIL'}
                          </span>
                        </div>
                        {vec.error && (
                          <div className={styles.vectorError}>{vec.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No vectors in this submission</div>
                )}
              </div>
            )}

            {/* Events Tab */}
            {!isSubmissionBundle && activeTab === 'events' && (
              <div className={styles.panel}>
                <h2 className={styles.sectionTitle}>Event Timeline</h2>
                {bundle.events.length > 0 ? (
                  <div className={styles.eventsList}>
                    {bundle.events.map((event: any, idx: number) => (
                      <div key={idx} className={styles.eventCard}>
                        <div className={styles.eventTime}>
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                        <div className={styles.eventType}>{event.type}</div>
                        {Object.keys(event.data || {}).length > 0 && (
                          <pre className={styles.eventData}>{JSON.stringify(event.data, null, 2)}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No events recorded</div>
                )}
              </div>
            )}

            {/* Hardware Tab */}
            {!isSubmissionBundle && activeTab === 'hardware' && (
              <div className={styles.panel}>
                <h2 className={styles.sectionTitle}>Hardware Evidence</h2>
                {bundle.hardware ? (
                  <>
                    <div className={styles.hardwareInfo}>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Bridge Status:</span>
                        <span className={styles.infoValue}>{bundle.hardware.bridge_status}</span>
                      </div>
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>Board Status:</span>
                        <span className={styles.infoValue}>{bundle.hardware.board_status}</span>
                      </div>
                      {bundle.hardware.board_model && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Board Model:</span>
                          <span className={styles.infoValue}>{bundle.hardware.board_model}</span>
                        </div>
                      )}
                    </div>

                    {bundle.hardware.snapshots && bundle.hardware.snapshots.length > 0 ? (
                      <div className={styles.snapshotsList}>
                        <h3>Snapshots ({bundle.hardware.snapshots.length})</h3>
                        {bundle.hardware.snapshots.map((snap: any, idx: number) => (
                          <div key={idx} className={styles.snapshotCard}>
                            <div className={styles.snapshotTime}>
                              {new Date(snap.timestamp).toLocaleTimeString()}
                              {snap.source && (
                                <span className={`${styles.snapshotSource} ${snap.source === 'bridge' ? styles.sourceBridge : styles.sourceManual}`}>
                                  {snap.source}
                                </span>
                              )}
                            </div>
                            <div className={styles.snapshotData}>
                              <div><strong>Inputs:</strong> <code>{JSON.stringify(snap.inputs)}</code></div>
                              <div><strong>Outputs:</strong> <code>{JSON.stringify(snap.outputs)}</code></div>
                              {snap.notes && <div><strong>Notes:</strong> {snap.notes}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.empty}>No snapshots recorded</div>
                    )}
                  </>
                ) : (
                  <div className={styles.empty}>No hardware evidence in this bundle</div>
                )}
              </div>
            )}

            {/* Files Tab */}
            {activeTab === 'files' && (
              <div className={styles.panel}>
                <h2 className={styles.sectionTitle}>Bundle Contents</h2>
                <div className={styles.filesList}>
                  {isSubmissionBundle ? (
                    <>
                      {(bundle.fileEntries ?? []).length > 0 ? (
                        (bundle.fileEntries ?? []).map((entry) => (
                          <div key={entry} className={styles.fileItem}>{entry}</div>
                        ))
                      ) : (
                        <div className={styles.empty}>No files listed in bundle.</div>
                      )}
                    </>
                  ) : bundle.schemaVersion === 'v2' ? (
                    <>
                      <div className={styles.fileItem}>manifest.json</div>
                      <div className={`${styles.fileItem} ${!bundle.traceFilePresent ? styles.fileMissing : ''}`}>
                        trace/hw_trace.ndjson
                      </div>
                      <div className={`${styles.fileItem} ${!bundle.bitstreamFilePresent ? styles.fileMissing : ''}`}>
                        bitstream/design.bit
                      </div>
                      <div className={styles.fileItem}>meta/board_profile.json</div>
                      <div className={styles.fileItem}>integrity/capsule.json</div>
                      <div className={styles.fileItem}>integrity/signature.sig</div>
                    </>
                  ) : (
                    <>
                      <div className={styles.fileItem}>manifest.json</div>
                      <div className={styles.fileItem}>proofs/capsule.json</div>
                      <div className={styles.fileItem}>proofs/events.ndjson</div>
                      {bundle.hardware && <div className={styles.fileItem}>proofs/hardware.json</div>}
                      {bundle.grade?.json && <div className={styles.fileItem}>grade.json</div>}
                      {bundle.grade?.md && <div className={styles.fileItem}>grade.md</div>}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const SubmissionInspectorApp: RedByteApp = {
  manifest: {
    id: 'submission-inspector',
    name: 'Submission Inspector',
    iconId: 'search',
    category: 'tools',
    hidden: true,
    defaultSize: {
      width: 1000,
      height: 750,
    },
  },
  component: SubmissionInspectorAppContent,
};
