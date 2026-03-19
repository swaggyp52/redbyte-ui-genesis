import type { IRDiagnostic } from '@redbyte/rb-logic-core';
import { digestValue } from '../../utils/digest';
import type { ImportDiagnostic } from '../../import/importCompiler';
import type { VerifyEvidencePreflightIssue } from './verifyReport';

export type IdeDiagnosticMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';
export type IdeDiagnosticSeverity = 'error' | 'warn' | 'info';
export type IdeDiagnosticOwnerKind = 'node' | 'port' | 'mapping' | 'file';
export type IdeDiagnosticOrigin =
  | 'parser'
  | 'reconstruction'
  | 'constraints'
  | 'manifest'
  | 'archive'
  | 'ir'
  | 'verify-preflight'
  | 'export';
export type IdeDiagnosticStage = 'import' | 'design' | 'sim' | 'verify' | 'export';

export interface IdeDiagnosticOwner {
  kind: IdeDiagnosticOwnerKind;
  nodeId?: string;
  portName?: string;
  mappingKey?: string;
  filePath?: string;
}

export interface IdeDiagnosticLocation {
  filePath?: string;
  line?: number;
  column?: number;
  nodeId?: string;
  port?: string;
  netName?: string;
  signal?: string;
  tick?: number;
  vectorId?: string;
  caseIndex?: number;
  mappingKey?: string;
}

export interface IdeDiagnosticRoutePayload {
  mode: IdeDiagnosticMode;
  nodeId?: string;
  wireId?: string;
  portName?: string;
  mappingKey?: string;
  filePath?: string;
  signal?: string;
  tick?: number;
  panTo?: {
    x: number;
    y: number;
    zoom?: number;
  };
}

export type IdeDiagnosticActionKind = 'select' | 'open-mode' | 'apply-fix';

export interface IdeDiagnosticAction {
  kind: IdeDiagnosticActionKind;
  label: string;
  payload: IdeDiagnosticRoutePayload;
}

export interface IdeDiagnostic {
  id: string;
  severity: IdeDiagnosticSeverity;
  blocking: boolean;
  code: string;
  title: string;
  message: string;
  hint: string[];
  owner: IdeDiagnosticOwner;
  origin: IdeDiagnosticOrigin;
  stage: IdeDiagnosticStage;
  location?: IdeDiagnosticLocation;
  actions: IdeDiagnosticAction[];
}

export interface IdeDiagnosticRouteRequest extends IdeDiagnosticRoutePayload {
  requestId: number;
  diagnosticId: string;
}

interface CreateIdeDiagnosticInput {
  severity: IdeDiagnosticSeverity;
  code: string;
  title: string;
  message: string;
  hint?: string[];
  owner: IdeDiagnosticOwner;
  origin: IdeDiagnosticOrigin;
  stage: IdeDiagnosticStage;
  location?: IdeDiagnosticLocation;
  actions?: IdeDiagnosticAction[];
  blocking?: boolean;
}

interface AdaptIrDiagnosticOptions {
  stage?: IdeDiagnosticStage;
  title?: string;
  hint?: string[];
  owner?: IdeDiagnosticOwner;
  location?: IdeDiagnosticLocation;
  actions?: IdeDiagnosticAction[];
  blocking?: boolean;
}

interface AdaptImportDiagnosticOptions {
  title?: string;
  hint?: string[];
  owner?: IdeDiagnosticOwner;
  location?: IdeDiagnosticLocation;
  actions?: IdeDiagnosticAction[];
  filePath?: string;
  blocking?: boolean;
}

interface AdaptVerifyPreflightIssueOptions {
  title?: string;
  hint?: string[];
  owner?: IdeDiagnosticOwner;
  location?: IdeDiagnosticLocation;
  actions?: IdeDiagnosticAction[];
  blocking?: boolean;
}

const VERIFY_PREFLIGHT_CODE_BY_KIND: Record<VerifyEvidencePreflightIssue['kind'], string> = {
  'missing-output-row': 'VPRE1001',
  'missing-output-node': 'VPRE1002',
  'missing-expected-binding': 'VPRE1003',
  'missing-output-sample': 'VPRE1004',
  'unsupported-temporal': 'VPRE2001',
  'invalid-ir': 'VPRE9001',
};

const IMPORT_CODE_PREFIX_BY_SOURCE: Record<ImportDiagnostic['source'], string> = {
  parser: 'PARSE',
  reconstruction: 'RECON',
  constraints: 'XDC',
  manifest: 'MANI',
  archive: 'ARCH',
};

export function createDiagnosticId(params: {
  code: string;
  owner: IdeDiagnosticOwner;
  message: string;
  hint: string[];
  origin?: IdeDiagnosticOrigin;
  stage?: IdeDiagnosticStage;
  location?: IdeDiagnosticLocation;
}): string {
  const normalizedOwner = {
    kind: params.owner.kind,
    nodeId: normalizeNullable(params.owner.nodeId),
    portName: normalizeNullable(params.owner.portName),
    mappingKey: normalizeNullable(params.owner.mappingKey),
    filePath: normalizeNullable(params.owner.filePath),
  };
  const normalizedLocation = params.location
    ? {
        filePath: normalizeNullable(params.location.filePath),
        line: normalizeFiniteNumber(params.location.line),
        column: normalizeFiniteNumber(params.location.column),
        nodeId: normalizeNullable(params.location.nodeId),
        port: normalizeNullable(params.location.port),
        netName: normalizeNullable(params.location.netName),
        signal: normalizeNullable(params.location.signal),
        tick: normalizeFiniteNumber(params.location.tick),
        vectorId: normalizeNullable(params.location.vectorId),
        caseIndex: normalizeFiniteNumber(params.location.caseIndex),
        mappingKey: normalizeNullable(params.location.mappingKey),
      }
    : null;
  const payload = {
    code: params.code.trim(),
    owner: normalizedOwner,
    origin: params.origin ?? null,
    stage: params.stage ?? null,
    location: normalizedLocation,
    message: params.message.trim(),
    hint: [...params.hint].map((entry) => entry.trim()).sort(),
  };
  return `diag_${digestValue(payload).slice(0, 16)}`;
}

export function createIdeDiagnostic(input: CreateIdeDiagnosticInput): IdeDiagnostic {
  const hint = [...(input.hint ?? [])]
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const location = normalizeLocation(input.location);
  const code = input.code.trim();
  const id = createDiagnosticId({
    code,
    owner: input.owner,
    origin: input.origin,
    stage: input.stage,
    location,
    message: input.message,
    hint,
  });
  return {
    id,
    severity: input.severity,
    blocking: resolveDiagnosticBlocking(input.severity, input.blocking),
    code,
    title: input.title.trim(),
    message: input.message.trim(),
    hint,
    owner: input.owner,
    origin: input.origin,
    stage: input.stage,
    location,
    actions: [...(input.actions ?? [])],
  };
}

export function adaptIrDiagnostic(
  diagnostic: IRDiagnostic,
  options: AdaptIrDiagnosticOptions = {}
): IdeDiagnostic {
  const severity = toIdeSeverity(diagnostic.severity);
  const owner = options.owner ?? ownerFromIrDiagnostic(diagnostic);
  const location = normalizeLocation({
    nodeId: diagnostic.nodeId,
    port: diagnostic.port,
    netName: diagnostic.netName,
    ...(options.location ?? {}),
  });
  return createIdeDiagnostic({
    severity,
    blocking: options.blocking,
    code: diagnostic.code.trim() || synthesizeDiagnosticCode('IR', diagnostic),
    title: options.title ?? defaultIrDiagnosticTitle(severity),
    message: diagnostic.message,
    hint: options.hint ?? [],
    owner,
    origin: 'ir',
    stage: options.stage ?? 'design',
    location,
    actions: options.actions ?? buildDefaultActions(owner, 'design', location),
  });
}

export function adaptImportDiagnostic(
  diagnostic: ImportDiagnostic,
  options: AdaptImportDiagnosticOptions = {}
): IdeDiagnostic {
  const severity = diagnostic.severity === 'error' ? 'error' : 'warn';
  const code =
    diagnostic.code?.trim() ||
    synthesizeDiagnosticCode(IMPORT_CODE_PREFIX_BY_SOURCE[diagnostic.source], {
      source: diagnostic.source,
      message: diagnostic.message,
      line: diagnostic.line,
      column: diagnostic.column,
    });
  const location = normalizeLocation({
    filePath: options.filePath ?? diagnostic.filePath,
    line: diagnostic.line,
    column: diagnostic.column,
    ...(options.location ?? {}),
  });
  const owner =
    options.owner ??
    ({
      kind: 'file',
      filePath: location?.filePath ?? 'import',
    } satisfies IdeDiagnosticOwner);
  return createIdeDiagnostic({
    severity,
    blocking: options.blocking ?? diagnostic.blocking,
    code,
    title: options.title ?? defaultImportDiagnosticTitle(diagnostic.source, severity),
    message: diagnostic.message,
    hint: options.hint ?? [],
    owner,
    origin: diagnostic.source,
    stage: 'import',
    location,
    actions: options.actions ?? buildDefaultActions(owner, 'import', location),
  });
}

/**
 * Unify parser and compiler diagnostics from an import compiler result into a single
 * normalized IdeDiagnostic[]. Use this in zipImport.ts and ImportSurface instead of
 * calling adaptImportDiagnostic / adaptIrDiagnostic inline.
 */
export function unifyImportDiagnostics(
  parserDiagnostics: ImportDiagnostic[],
  compilerDiagnostics: IRDiagnostic[]
): IdeDiagnostic[] {
  return [
    ...parserDiagnostics.map((diagnostic) => adaptImportDiagnostic(diagnostic)),
    ...compilerDiagnostics.map((diagnostic) => adaptIrDiagnostic(diagnostic, { stage: 'import' })),
  ];
}

export function adaptVerifyPreflightIssue(
  issue: VerifyEvidencePreflightIssue,
  options: AdaptVerifyPreflightIssueOptions = {}
): IdeDiagnostic {
  const severity = toIdeSeverity(issue.severity ?? 'error');
  const location = normalizeLocation({
    signal: issue.signal,
    tick: issue.tick,
    vectorId: issue.vectorId,
    caseIndex: issue.caseIndex,
    nodeId: issue.nodeId,
    port: issue.port,
    netName: issue.netName,
    ...(options.location ?? {}),
  });
  const owner =
    options.owner ??
    (issue.nodeId
      ? ({
          kind: 'node',
          nodeId: issue.nodeId,
          portName: issue.port,
        } satisfies IdeDiagnosticOwner)
      : ({
          kind: 'file',
          filePath: 'verify-report.json',
        } satisfies IdeDiagnosticOwner));
  return createIdeDiagnostic({
    severity,
    blocking: options.blocking ?? issue.blocking,
    code: issue.code?.trim() || VERIFY_PREFLIGHT_CODE_BY_KIND[issue.kind],
    title: options.title ?? defaultVerifyPreflightTitle(issue.kind, severity),
    message: issue.message,
    hint: options.hint ?? [],
    owner,
    origin: 'verify-preflight',
    stage: 'verify',
    location,
    actions: options.actions ?? buildDefaultActions(owner, 'verify', location),
  });
}

export function choosePrimaryDiagnosticAction(
  diagnostic: IdeDiagnostic
): IdeDiagnosticAction | undefined {
  if (diagnostic.actions.length === 0) return undefined;
  const applyFix = diagnostic.actions.find((action) => action.kind === 'apply-fix');
  if (applyFix) return applyFix;
  const openMode = diagnostic.actions.find((action) => action.kind === 'open-mode');
  if (openMode) return openMode;
  return diagnostic.actions[0];
}

export function resolveDiagnosticBlocking(
  severity: IdeDiagnosticSeverity,
  override?: boolean
): boolean {
  if (severity === 'info') return false;
  if (severity === 'warn') return false;
  return override ?? true;
}

export function toIdeSeverity(
  severity: IdeDiagnosticSeverity | 'warning'
): IdeDiagnosticSeverity {
  if (severity === 'warning') return 'warn';
  return severity;
}

function ownerFromIrDiagnostic(diagnostic: IRDiagnostic): IdeDiagnosticOwner {
  if (diagnostic.nodeId?.trim()) {
    return {
      kind: 'node',
      nodeId: diagnostic.nodeId.trim(),
      portName: diagnostic.port?.trim() || undefined,
    };
  }
  if (diagnostic.port?.trim()) {
    return {
      kind: 'port',
      portName: diagnostic.port.trim(),
    };
  }
  return {
    kind: 'file',
    filePath: 'design',
  };
}

function buildDefaultActions(
  owner: IdeDiagnosticOwner,
  mode: IdeDiagnosticMode,
  location?: IdeDiagnosticLocation
): IdeDiagnosticAction[] {
  if (owner.kind === 'node') {
    return [
      {
        kind: 'open-mode',
        label: mode === 'design' ? 'Open Design Inspector' : `Open ${capitalizeMode(mode)}`,
        payload: {
          mode,
          nodeId: owner.nodeId,
          portName: owner.portName,
          signal: location?.signal,
          tick: location?.tick,
        },
      },
      {
        kind: 'select',
        label: owner.nodeId ? 'Select node' : 'Open diagnostic',
        payload: {
          mode,
          nodeId: owner.nodeId,
          portName: owner.portName,
          signal: location?.signal,
          tick: location?.tick,
        },
      },
    ];
  }

  return [
    {
      kind: 'open-mode',
      label: `Open ${capitalizeMode(mode)}`,
      payload: {
        mode,
        mappingKey: owner.mappingKey,
        portName: owner.portName,
        filePath: owner.filePath ?? location?.filePath,
        signal: location?.signal,
        tick: location?.tick,
      },
    },
  ];
}

function defaultIrDiagnosticTitle(severity: IdeDiagnosticSeverity): string {
  if (severity === 'error') return 'Compiler error';
  if (severity === 'warn') return 'Compiler warning';
  return 'Compiler note';
}

function defaultImportDiagnosticTitle(
  source: ImportDiagnostic['source'],
  severity: IdeDiagnosticSeverity
): string {
  const prefix =
    source === 'parser'
      ? 'Parser'
      : source === 'reconstruction'
        ? 'Reconstruction'
        : source === 'constraints'
          ? 'Constraint'
          : source === 'manifest'
            ? 'Manifest'
            : 'Archive';
  if (severity === 'error') return `${prefix} error`;
  if (severity === 'warn') return `${prefix} warning`;
  return `${prefix} note`;
}

function defaultVerifyPreflightTitle(
  kind: VerifyEvidencePreflightIssue['kind'],
  severity: IdeDiagnosticSeverity
): string {
  if (kind === 'invalid-ir') return 'Compiler blocked verification';
  if (kind === 'unsupported-temporal') return 'Temporal verification blocker';
  if (severity === 'error') return 'Verification preflight blocker';
  return 'Verification preflight advisory';
}

function synthesizeDiagnosticCode(prefix: string, payload: unknown): string {
  return `${prefix}${digestValue(payload).slice(0, 6).toUpperCase()}`;
}

function normalizeLocation(
  location?: IdeDiagnosticLocation
): IdeDiagnosticLocation | undefined {
  if (!location) return undefined;
  const normalized: IdeDiagnosticLocation = {
    filePath: normalizeOptional(location.filePath),
    line: normalizeFiniteNumber(location.line),
    column: normalizeFiniteNumber(location.column),
    nodeId: normalizeOptional(location.nodeId),
    port: normalizeOptional(location.port),
    netName: normalizeOptional(location.netName),
    signal: normalizeOptional(location.signal),
    tick: normalizeFiniteNumber(location.tick),
    vectorId: normalizeOptional(location.vectorId),
    caseIndex: normalizeFiniteNumber(location.caseIndex),
    mappingKey: normalizeOptional(location.mappingKey),
  };
  return Object.values(normalized).some((value) => value !== undefined) ? normalized : undefined;
}

function normalizeNullable(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeFiniteNumber(value: number | undefined): number | undefined {
  return Number.isFinite(value) ? Number(value) : undefined;
}

function capitalizeMode(mode: IdeDiagnosticMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
