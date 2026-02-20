import { digestValue } from '../../utils/digest';

export type IdeDiagnosticMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';
export type IdeDiagnosticSeverity = 'error' | 'warn' | 'info';
export type IdeDiagnosticOwnerKind = 'node' | 'port' | 'mapping' | 'file';

export interface IdeDiagnosticOwner {
  kind: IdeDiagnosticOwnerKind;
  nodeId?: string;
  portName?: string;
  mappingKey?: string;
  filePath?: string;
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
  code: string;
  title: string;
  message: string;
  hint: string[];
  owner: IdeDiagnosticOwner;
  actions: IdeDiagnosticAction[];
}

export interface IdeDiagnosticRouteRequest extends IdeDiagnosticRoutePayload {
  requestId: number;
  diagnosticId: string;
}

export function createDiagnosticId(params: {
  code: string;
  owner: IdeDiagnosticOwner;
  message: string;
  hint: string[];
}): string {
  const normalizedOwner = {
    kind: params.owner.kind,
    nodeId: normalizeNullable(params.owner.nodeId),
    portName: normalizeNullable(params.owner.portName),
    mappingKey: normalizeNullable(params.owner.mappingKey),
    filePath: normalizeNullable(params.owner.filePath),
  };
  const payload = {
    code: params.code,
    owner: normalizedOwner,
    message: params.message.trim(),
    hint: [...params.hint].map((entry) => entry.trim()).sort(),
  };
  return `diag_${digestValue(payload).slice(0, 16)}`;
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

function normalizeNullable(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
