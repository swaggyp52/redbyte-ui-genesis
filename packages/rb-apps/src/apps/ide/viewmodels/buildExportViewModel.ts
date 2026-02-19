import type { RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  exportProjectAsBasys3,
  type Basys3ExportError,
} from '../../../fpga/boards/basys3/basys3ExportService';

export type ExportDiagnosticSeverity = 'error' | 'warning';
export type ExportPinDirection = 'in' | 'out' | 'inout';
export type ExportPinStatus = 'mapped' | 'missing' | 'unused';

export interface ExportDiagnosticView {
  code: string;
  message: string;
  fix?: string;
  port?: string;
  severity: ExportDiagnosticSeverity;
}

export interface ExportPinTableRow {
  port: string;
  direction: ExportPinDirection;
  pin?: string;
  required: boolean;
  status: ExportPinStatus;
  notes?: string;
  suggestedPin?: string;
}

export interface ExportArtifactView {
  path: string;
  kind: 'vhd' | 'xdc' | 'readme' | 'tb';
  preview: string;
  status: 'ready' | 'blocked' | 'pending';
  note: string;
}

export interface ExportViewModel {
  status: 'ok' | 'blocked';
  errors: ExportDiagnosticView[];
  warnings: ExportDiagnosticView[];
  pinTable: ExportPinTableRow[];
  artifacts: ExportArtifactView[];
  exportHash?: string;
}

interface RequiredPortDescriptor {
  name: string;
  direction: ExportPinDirection;
}

export function buildExportViewModel(project: RBProject): ExportViewModel {
  const exportResult = exportProjectAsBasys3(project);
  const diagnostics = collectDiagnostics(exportResult.errors, exportResult.warnings);
  const errors = diagnostics.filter((entry) => entry.severity === 'error');
  const warnings = diagnostics.filter((entry) => entry.severity === 'warning');
  const requiredPorts = collectRequiredPorts(diagnostics);
  const pinTable = buildPinTable(project, diagnostics, requiredPorts);
  const artifacts = buildArtifacts(project, exportResult, errors.length > 0);

  return {
    status: errors.length > 0 ? 'blocked' : 'ok',
    errors,
    warnings,
    pinTable,
    artifacts,
    exportHash: exportResult.determinismHash,
  };
}

function collectDiagnostics(
  exportErrors: Basys3ExportError[],
  exportWarnings: string[]
): ExportDiagnosticView[] {
  const seen = new Set<string>();
  const diagnostics: ExportDiagnosticView[] = [];

  const push = (severity: ExportDiagnosticSeverity, message: string) => {
    const key = `${severity}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);

    diagnostics.push({
      code: diagnosticCodeFor(message, severity),
      message,
      fix: fixHintFor(message, severity),
      port: extractPortFromMessage(message),
      severity,
    });
  };

  for (const error of exportErrors) {
    push(error.severity === 'error' ? 'error' : 'warning', error.message);
  }
  for (const warning of exportWarnings) {
    push('warning', warning);
  }

  return diagnostics.sort((left, right) => {
    const severityDelta = severityOrder(left.severity) - severityOrder(right.severity);
    if (severityDelta !== 0) return severityDelta;
    const codeDelta = compareCodepoint(left.code, right.code);
    if (codeDelta !== 0) return codeDelta;
    return compareCodepoint(left.message, right.message);
  });
}

function collectRequiredPorts(
  diagnostics: ExportDiagnosticView[]
): Map<string, RequiredPortDescriptor> {
  const required = new Map<string, RequiredPortDescriptor>();
  for (const diagnostic of diagnostics) {
    const requiredMatch = diagnostic.message.match(
      /required (input|output|bidirectional) port "([^"]+)"/i
    );
    if (requiredMatch) {
      const direction = toDirection(requiredMatch[1]);
      const name = requiredMatch[2];
      upsertRequiredPort(required, name, direction);
      continue;
    }

    const declaredMatch = diagnostic.message.match(
      /^(Input|Output|Bidirectional) port "([^"]+)"/i
    );
    if (declaredMatch) {
      const direction = toDirection(declaredMatch[1]);
      const name = declaredMatch[2];
      upsertRequiredPort(required, name, direction);
    }
  }
  return required;
}

function buildPinTable(
  project: RBProject,
  diagnostics: ExportDiagnosticView[],
  requiredPorts: Map<string, RequiredPortDescriptor>
): ExportPinTableRow[] {
  const rows = new Map<string, ExportPinTableRow>();

  const appendMapping = (
    direction: ExportPinDirection,
    entry: { id: string; nodeId: string; port: string; label?: string; pin?: string }
  ) => {
    const portName = resolveMappingPortName(entry);
    const portKey = normalizePort(portName);
    const existing = rows.get(portKey);
    const pin = normalizePin(entry.pin);
    const required = requiredPorts.has(portKey);
    const suggestedPin = suggestPin(portName, direction);

    if (!existing) {
      rows.set(portKey, {
        port: portName,
        direction,
        pin,
        required,
        status: pin ? 'mapped' : 'missing',
        notes: entry.label ? `Signal label: ${entry.label}` : undefined,
        suggestedPin,
      });
      return;
    }

    existing.required = existing.required || required;
    existing.pin = existing.pin || pin;
    existing.direction = mergeDirection(existing.direction, direction);
    existing.suggestedPin = existing.suggestedPin || suggestedPin;
  };

  for (const entry of project.ioMapping?.inputs ?? []) {
    appendMapping('in', entry);
  }
  for (const entry of project.ioMapping?.outputs ?? []) {
    appendMapping('out', entry);
  }

  for (const requiredPort of requiredPorts.values()) {
    const portKey = normalizePort(requiredPort.name);
    const existing = rows.get(portKey);
    if (existing) {
      existing.required = true;
      existing.direction = mergeDirection(existing.direction, requiredPort.direction);
      if (!existing.pin) {
        existing.status = 'missing';
      }
      continue;
    }
    rows.set(portKey, {
      port: requiredPort.name,
      direction: requiredPort.direction,
      pin: undefined,
      required: true,
      status: 'missing',
      notes: 'Required by top-entity export.',
      suggestedPin: suggestPin(requiredPort.name, requiredPort.direction),
    });
  }

  for (const diagnostic of diagnostics) {
    const unusedMatch = diagnostic.message.match(/Unused mapped (input|output) "([^"]+)"/i);
    if (!unusedMatch) continue;
    const key = normalizePort(unusedMatch[2]);
    const existing = rows.get(key);
    if (existing) {
      existing.status = 'unused';
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      status: finalizeRowStatus(row),
    }))
    .sort((left, right) => {
      if (left.required !== right.required) return left.required ? -1 : 1;
      return compareCodepoint(left.port, right.port);
    });
}

function buildArtifacts(
  project: RBProject,
  exportResult: ReturnType<typeof exportProjectAsBasys3>,
  blocked: boolean
): ExportArtifactView[] {
  const artifacts: ExportArtifactView[] = [];
  const bundle = exportResult.bundle;

  if (bundle) {
    artifacts.push({
      path: 'top.vhd',
      kind: 'vhd',
      preview: buildPreview(bundle.topVhd),
      status: blocked ? 'blocked' : 'ready',
      note: 'Canonical top-level VHDL export.',
    });
    artifacts.push({
      path: 'top.xdc',
      kind: 'xdc',
      preview: buildPreview(bundle.topXdc),
      status: blocked ? 'blocked' : 'ready',
      note: 'Deterministic Basys3 constraints generated from IO mapping.',
    });
    artifacts.push({
      path: 'README.txt',
      kind: 'readme',
      preview: buildPreview(bundle.readme),
      status: blocked ? 'blocked' : 'ready',
      note: 'Vivado import instructions.',
    });
    if (bundle.testbench) {
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        preview: buildPreview(bundle.testbench),
        status: blocked ? 'blocked' : 'ready',
        note: 'Deterministic verification schedule mirror.',
      });
    } else {
      const hasVectors = (project.vectors?.length ?? 0) > 0;
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        preview: '',
        status: hasVectors ? 'blocked' : 'pending',
        note: hasVectors
          ? 'Blocked until export validation passes.'
          : 'Pending until vectors are provided.',
      });
    }
  } else {
    artifacts.push({
      path: 'top.vhd',
      kind: 'vhd',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'top.xdc',
      kind: 'xdc',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'README.txt',
      kind: 'readme',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'testbench.vhd',
      kind: 'tb',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
  }

  return artifacts;
}

function severityOrder(severity: ExportDiagnosticSeverity): number {
  return severity === 'error' ? 0 : 1;
}

function normalizePort(value: string): string {
  return value.trim().toLowerCase();
}

function resolveMappingPortName(entry: {
  id: string;
  nodeId: string;
  port: string;
  label?: string;
}): string {
  const label = (entry.label ?? '').trim();
  if (label.length > 0) return label;
  const id = (entry.id ?? '').trim();
  if (id.length > 0) return id;
  return `${entry.nodeId}.${entry.port}`;
}

function normalizePin(value?: string): string | undefined {
  const trimmed = (value ?? '').trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mergeDirection(
  left: ExportPinDirection,
  right: ExportPinDirection
): ExportPinDirection {
  if (left === right) return left;
  return 'inout';
}

function finalizeRowStatus(row: ExportPinTableRow): ExportPinStatus {
  if (row.status === 'unused') return 'unused';
  if (row.pin && row.pin.trim().length > 0) return 'mapped';
  return row.required ? 'missing' : row.status;
}

function upsertRequiredPort(
  required: Map<string, RequiredPortDescriptor>,
  name: string,
  direction: ExportPinDirection
): void {
  const key = normalizePort(name);
  const existing = required.get(key);
  if (!existing) {
    required.set(key, { name, direction });
    return;
  }
  existing.direction = mergeDirection(existing.direction, direction);
}

function toDirection(raw: string): ExportPinDirection {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'output') return 'out';
  if (normalized === 'bidirectional') return 'inout';
  return 'in';
}

function extractPortFromMessage(message: string): string | undefined {
  const quotedPort = message.match(/port "([^"]+)"/i);
  if (quotedPort?.[1]) return quotedPort[1];
  const quotedMapping = message.match(/mapping "([^"]+)"/i);
  if (quotedMapping?.[1]) return quotedMapping[1];
  return undefined;
}

function diagnosticCodeFor(
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  const lowered = message.toLowerCase();
  if (lowered.includes('unmapped required')) return 'RBEX1001';
  if (lowered.includes('declared but has no basys3 pin assignment')) return 'RBEX1002';
  if (lowered.includes('unsupported') && lowered.includes('pin')) return 'RBEX2001';
  if (lowered.includes('questionable') && lowered.includes('mapping')) return 'RBEX2002';
  if (lowered.includes('unused mapped')) return 'RBEX2003';
  if (lowered.includes('ignoring source xdc directive')) return 'RBEX3001';
  return severity === 'error' ? 'RBEX9000' : 'RBEX9001';
}

function fixHintFor(
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  const explicitFix = message.match(/Fix:\s*(.+)$/i);
  if (explicitFix?.[1]) return explicitFix[1];
  const lowered = message.toLowerCase();
  if (lowered.includes('ignoring source xdc directive')) {
    return 'No action required unless you need this constraint represented via IO mapping.';
  }
  if (lowered.includes('unused mapped')) {
    return 'Remove the unused mapping or connect the port in the top entity.';
  }
  if (lowered.includes('questionable') && lowered.includes('mapping')) {
    return 'Move this port to a direction-compatible Basys3 alias.';
  }
  if (severity === 'error') {
    return 'Resolve this blocker before exporting.';
  }
  return 'Review this warning before exporting.';
}

function suggestPin(portName: string, direction: ExportPinDirection): string {
  const normalized = normalizePort(portName);
  if (normalized === 'clk' || normalized === 'clock' || normalized === 'clk100mhz') {
    return 'CLK100MHZ';
  }
  if (direction === 'in') return 'SW0';
  if (direction === 'out') return 'LD0';
  return 'JA1';
}

function buildPreview(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) return '';
  return normalized.split('\n').slice(0, 160).join('\n');
}
