import { encodeRBProject, type RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import {
  exportProjectAsBasys3,
  type Basys3ExportError,
} from '../../../fpga/boards/basys3/basys3ExportService';
import { generateTestbenchVhdl } from '../../../fpga/boards/basys3/testbenchGenerator';
import { generateVivadoImportTcl } from '../../../fpga/boards/basys3/vivadoImportTcl';
import type { RuntimeVerifyRun } from '../projectRuntime';
import {
  createDiagnosticId,
  type IdeDiagnostic,
  type IdeDiagnosticAction,
  type IdeDiagnosticOwner,
  type IdeDiagnosticSeverity,
} from '../diagnostics';
import { buildBringUpArtifacts } from '../bringupArtifacts';

export type ExportDiagnosticSeverity = 'error' | 'warning';
export type ExportPinDirection = 'in' | 'out' | 'inout';
export type ExportPinStatus = 'mapped' | 'missing' | 'unused';

export interface ExportDiagnosticView {
  id: string;
  code: string;
  title: string;
  message: string;
  hint: string[];
  fix?: string;
  port?: string;
  severity: ExportDiagnosticSeverity;
  owner: IdeDiagnosticOwner;
  actions: IdeDiagnosticAction[];
  canonical: IdeDiagnostic;
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
  kind: 'vhd' | 'xdc' | 'readme' | 'tb' | 'tcl' | 'md' | 'json';
  content: string;
  preview: string;
  status: 'ready' | 'blocked' | 'pending';
  note: string;
}

export interface ExportViewModel {
  status: 'ok' | 'blocked';
  diagnostics: IdeDiagnostic[];
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

export function buildExportViewModel(
  project: RBProject,
  runtimeVerifyRun?: RuntimeVerifyRun
): ExportViewModel {
  const exportResult = exportProjectAsBasys3(project);
  const diagnostics = collectDiagnostics(project, exportResult.errors, exportResult.warnings);
  const canonicalDiagnostics = diagnostics.map((entry) => entry.canonical);
  const errors = diagnostics.filter((entry) => entry.severity === 'error');
  const warnings = diagnostics.filter((entry) => entry.severity === 'warning');
  const requiredPorts = collectRequiredPorts(diagnostics);
  const pinTable = buildPinTable(project, diagnostics, requiredPorts);
  const artifacts = buildArtifacts(project, exportResult, errors.length > 0, runtimeVerifyRun);

  return {
    status: errors.length > 0 ? 'blocked' : 'ok',
    diagnostics: canonicalDiagnostics,
    errors,
    warnings,
    pinTable,
    artifacts,
    exportHash: exportResult.determinismHash,
  };
}

function collectDiagnostics(
  project: RBProject,
  exportErrors: Basys3ExportError[],
  exportWarnings: string[]
): ExportDiagnosticView[] {
  const seen = new Set<string>();
  const diagnostics: ExportDiagnosticView[] = [];
  const mappingIndex = buildMappingIndex(project);

  const push = (severity: ExportDiagnosticSeverity, message: string) => {
    const normalizedSeverity = normalizeDiagnosticSeverity(severity, message);
    const key = `${normalizedSeverity}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);

    const code = diagnosticCodeFor(message, normalizedSeverity);
    const fix = fixHintFor(message, normalizedSeverity);
    const port = extractPortFromMessage(message);
    const owner = resolveDiagnosticOwner(project, mappingIndex, port, message);
    const actions = buildDiagnosticActions(owner);
    const hint = fix.length > 0 ? [fix] : [];
    const canonicalSeverity: IdeDiagnosticSeverity =
      normalizedSeverity === 'error' ? 'error' : 'warn';
    const title = diagnosticTitleFor(code, message, normalizedSeverity);
    const id = createDiagnosticId({
      code,
      owner,
      message,
      hint,
    });
    const canonical: IdeDiagnostic = {
      id,
      severity: canonicalSeverity,
      code,
      title,
      message,
      hint,
      owner,
      actions,
    };

    diagnostics.push({
      id,
      code,
      title,
      message,
      hint,
      fix,
      port,
      severity: normalizedSeverity,
      owner,
      actions,
      canonical,
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
  blocked: boolean,
  runtimeVerifyRun?: RuntimeVerifyRun
): ExportArtifactView[] {
  const artifacts: ExportArtifactView[] = [];
  const bundle = exportResult.bundle;
  const rbprojJson = encodeRBProject(project);
  const runtimeBackedTestbench = buildRuntimeBackedTestbench(project, runtimeVerifyRun);
  const topEntity = resolveTopEntity(project);
  const vhdlSourcePaths: string[] = ['top.vhd'];
  const vivadoImportTcl = generateVivadoImportTcl({
    projectName: project.name,
    topEntity,
    sourcePaths: vhdlSourcePaths,
    constraintsPath: 'top.xdc',
    simulationPath: 'testbench.vhd',
  });
  const bringUpArtifacts = buildBringUpArtifacts({
    project,
    ioRows: collectBringUpIoRows(project),
    expectedBehavior:
      project.description?.trim() || 'Outputs should reflect deterministic bring-up vectors.',
    exportHash: exportResult.determinismHash,
    verifyHash: runtimeVerifyRun?.deterministicHash,
    verifyReportHash: runtimeVerifyRun?.reportHash,
    verifyGeneratedAtIso: runtimeVerifyRun?.generatedAtIso,
    verifyRows: runtimeVerifyRun?.report.rows,
  });

  if (bundle) {
    artifacts.push({
      path: 'project.rbproj.json',
      kind: 'json',
      content: normalizeArtifactContent(rbprojJson),
      preview: buildPreview(rbprojJson),
      status: 'ready',
      note: 'Canonical RedByte project snapshot for Save/Load roundtrip.',
    });
    artifacts.push({
      path: 'top.vhd',
      kind: 'vhd',
      content: normalizeArtifactContent(bundle.topVhd),
      preview: buildPreview(bundle.topVhd),
      status: blocked ? 'blocked' : 'ready',
      note: 'Canonical top-level VHDL export.',
    });
    artifacts.push({
      path: 'top.xdc',
      kind: 'xdc',
      content: normalizeArtifactContent(bundle.topXdc),
      preview: buildPreview(bundle.topXdc),
      status: blocked ? 'blocked' : 'ready',
      note: 'Deterministic Basys3 constraints generated from IO mapping.',
    });
    artifacts.push({
      path: 'README.txt',
      kind: 'readme',
      content: normalizeArtifactContent(bundle.readme),
      preview: buildPreview(bundle.readme),
      status: blocked ? 'blocked' : 'ready',
      note: 'Vivado import instructions.',
    });
    artifacts.push({
      path: 'vivado_import.tcl',
      kind: 'tcl',
      content: normalizeArtifactContent(vivadoImportTcl),
      preview: buildPreview(vivadoImportTcl),
      status: blocked ? 'blocked' : 'ready',
      note: 'Vivado batch import script for Basys3 project setup.',
    });
    artifacts.push({
      path: 'BRINGUP.md',
      kind: 'md',
      content: normalizeArtifactContent(bringUpArtifacts.bringupMarkdown),
      preview: buildPreview(bringUpArtifacts.bringupMarkdown),
      status: blocked ? 'blocked' : 'ready',
      note: 'Fast board bring-up checklist and mapping summary.',
    });
    artifacts.push({
      path: 'EXPECTED_IO.json',
      kind: 'json',
      content: normalizeArtifactContent(bringUpArtifacts.expectedIoJson),
      preview: buildPreview(bringUpArtifacts.expectedIoJson),
      status: blocked ? 'blocked' : 'ready',
      note: 'Deterministic expected IO behavior for board bring-up vectors.',
    });
    artifacts.push({
      path: 'program_and_test.tcl',
      kind: 'tcl',
      content: normalizeArtifactContent(bringUpArtifacts.programAndTestTcl),
      preview: buildPreview(bringUpArtifacts.programAndTestTcl),
      status: blocked ? 'blocked' : 'ready',
      note: 'Hardware manager programming scaffold for Basys3 bring-up.',
    });
    if (runtimeBackedTestbench) {
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        content: normalizeArtifactContent(runtimeBackedTestbench.content),
        preview: buildPreview(runtimeBackedTestbench.content),
        status: blocked ? 'blocked' : 'ready',
        note: runtimeBackedTestbench.note,
      });
    } else if (bundle.testbench) {
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        content: normalizeArtifactContent(bundle.testbench),
        preview: buildPreview(bundle.testbench),
        status: blocked ? 'blocked' : 'ready',
        note: 'Deterministic verification schedule mirror.',
      });
    } else {
      const hasVectors = (project.vectors?.length ?? 0) > 0;
      artifacts.push({
        path: 'testbench.vhd',
        kind: 'tb',
        content: '',
        preview: '',
        status: hasVectors ? 'blocked' : 'pending',
        note: hasVectors
          ? 'Blocked until export validation passes.'
          : 'Pending until vectors are provided.',
      });
    }
  } else {
    artifacts.push({
      path: 'project.rbproj.json',
      kind: 'json',
      content: normalizeArtifactContent(rbprojJson),
      preview: buildPreview(rbprojJson),
      status: 'ready',
      note: 'Canonical RedByte project snapshot for Save/Load roundtrip.',
    });
    artifacts.push({
      path: 'top.vhd',
      kind: 'vhd',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'top.xdc',
      kind: 'xdc',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'README.txt',
      kind: 'readme',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'vivado_import.tcl',
      kind: 'tcl',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'BRINGUP.md',
      kind: 'md',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'EXPECTED_IO.json',
      kind: 'json',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'program_and_test.tcl',
      kind: 'tcl',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
    artifacts.push({
      path: 'testbench.vhd',
      kind: 'tb',
      content: '',
      preview: '',
      status: 'blocked',
      note: 'Blocked by export diagnostics.',
    });
  }

  return artifacts;
}

function buildRuntimeBackedTestbench(
  project: RBProject,
  runtimeVerifyRun: RuntimeVerifyRun | undefined
): { content: string; note: string } | undefined {
  if (!runtimeVerifyRun || runtimeVerifyRun.status !== 'pass') return undefined;
  if (!project.vectors || project.vectors.length === 0) return undefined;
  const content = generateTestbenchVhdl(project, project.vectors, {
    scheduleOverride: {
      schedule: runtimeVerifyRun.schedule,
      reason: 'verify-last-run',
    },
  });
  return {
    content,
    note: `Deterministic schedule mirrored from latest Verify PASS (${runtimeVerifyRun.schedule}).`,
  };
}

function resolveTopEntity(project: RBProject): string {
  const top =
    (project.hdl?.top ?? project.fpga?.top ?? '')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_');
  return top.length > 0 ? top : 'top';
}

function collectBringUpIoRows(project: RBProject): Array<{
  id: string;
  nodeId?: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}> {
  const rows: Array<{
    id: string;
    nodeId?: string;
    label: string;
    direction: 'in' | 'out';
    pin: string;
    required: boolean;
  }> = [];

  for (const input of project.ioMapping?.inputs ?? []) {
    rows.push({
      id: input.id,
      nodeId: input.nodeId,
      label: (input.label ?? input.id).trim() || input.id,
      direction: 'in',
      pin: input.pin ?? '',
      required: true,
    });
  }

  for (const output of project.ioMapping?.outputs ?? []) {
    rows.push({
      id: output.id,
      nodeId: output.nodeId,
      label: (output.label ?? output.id).trim() || output.id,
      direction: 'out',
      pin: output.pin ?? '',
      required: true,
    });
  }

  return rows;
}

function severityOrder(severity: ExportDiagnosticSeverity): number {
  return severity === 'error' ? 0 : 1;
}

function normalizeDiagnosticSeverity(
  severity: ExportDiagnosticSeverity,
  message: string
): ExportDiagnosticSeverity {
  if (severity !== 'error') return severity;
  if (/bundle validation failed/i.test(message)) return 'warning';
  return severity;
}

interface MappingIndexEntry {
  nodeId: string;
  mappingKey: string;
  portName: string;
}

function buildMappingIndex(project: RBProject): Map<string, MappingIndexEntry> {
  const index = new Map<string, MappingIndexEntry>();
  const upsert = (entry: { id: string; nodeId: string; port: string; label?: string }) => {
    const portName = resolveMappingPortName(entry);
    const mappingKey = normalizePort(portName);
    if (index.has(mappingKey)) return;
    index.set(mappingKey, {
      nodeId: entry.nodeId,
      mappingKey,
      portName,
    });
  };

  for (const input of project.ioMapping?.inputs ?? []) {
    upsert(input);
  }
  for (const output of project.ioMapping?.outputs ?? []) {
    upsert(output);
  }
  return index;
}

function resolveDiagnosticOwner(
  project: RBProject,
  mappingIndex: Map<string, MappingIndexEntry>,
  port: string | undefined,
  message: string
): IdeDiagnosticOwner {
  const directNodeId = extractNodeIdFromMessage(message);
  if (directNodeId) {
    const node = project.circuit.nodes.find((entry) => entry.id === directNodeId);
    if (node) {
      return {
        kind: 'node',
        nodeId: node.id,
        portName: node.label ?? node.id,
      };
    }
  }

  const normalizedPort = normalizePort(port ?? '');
  if (normalizedPort.length > 0) {
    const mapped = mappingIndex.get(normalizedPort);
    if (mapped) {
      return {
        kind: 'mapping',
        nodeId: mapped.nodeId,
        portName: mapped.portName,
        mappingKey: mapped.mappingKey,
      };
    }
    return {
      kind: 'port',
      portName: normalizedPort,
    };
  }

  const referencedNodeType = extractNodeTypeFromMessage(message);
  if (referencedNodeType) {
    const ownerNode = project.circuit.nodes.find(
      (node) => normalizePort(node.type) === normalizePort(referencedNodeType)
    );
    if (ownerNode) {
      return {
        kind: 'node',
        nodeId: ownerNode.id,
        portName: ownerNode.label ?? ownerNode.id,
      };
    }
  }

  return {
    kind: 'file',
    filePath: 'export',
  };
}

function buildDiagnosticActions(owner: IdeDiagnosticOwner): IdeDiagnosticAction[] {
  if (owner.kind === 'mapping') {
    return [
      {
        kind: 'open-mode',
        label: 'Open Project Mapping',
        payload: {
          mode: 'project',
          mappingKey: owner.mappingKey,
          portName: owner.portName,
          nodeId: owner.nodeId,
        },
      },
      {
        kind: 'select',
        label: 'Select mapping row',
        payload: {
          mode: 'project',
          mappingKey: owner.mappingKey,
          portName: owner.portName,
          nodeId: owner.nodeId,
        },
      },
    ];
  }
  if (owner.kind === 'node') {
    return [
      {
        kind: 'open-mode',
        label: 'Open Design Inspector',
        payload: {
          mode: 'design',
          nodeId: owner.nodeId,
          portName: owner.portName,
        },
      },
      {
        kind: 'select',
        label: 'Select node',
        payload: {
          mode: 'design',
          nodeId: owner.nodeId,
          portName: owner.portName,
        },
      },
    ];
  }
  if (owner.kind === 'port') {
    return [
      {
        kind: 'open-mode',
        label: 'Open Project Mapping',
        payload: {
          mode: 'project',
          mappingKey: owner.mappingKey ?? normalizePort(owner.portName ?? ''),
          portName: owner.portName,
        },
      },
    ];
  }
  return [
    {
      kind: 'open-mode',
      label: 'Open Export Diagnostics',
      payload: {
        mode: 'export',
        filePath: owner.filePath,
      },
    },
  ];
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

function extractNodeTypeFromMessage(message: string): string | undefined {
  const typed = message.match(/node type "([^"]+)"/i);
  if (typed?.[1]) return typed[1];
  const fallback = message.match(/unsupported node type\s+([a-zA-Z0-9_]+)/i);
  if (fallback?.[1]) return fallback[1];
  return undefined;
}

function extractNodeIdFromMessage(message: string): string | undefined {
  const direct = message.match(/node "([^"]+)"/i);
  if (direct?.[1]) return direct[1];
  const dotted = message.match(/for "([^"]+)\.[^"]+"/i);
  if (dotted?.[1]) return dotted[1];
  return undefined;
}

function diagnosticCodeFor(
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  const lowered = message.toLowerCase();
  if (lowered.includes('unmapped required')) return 'RBEX1001';
  if (lowered.includes('declared but has no basys3 pin assignment')) return 'RBEX1002';
  if (lowered.includes('unsupported synth subset node type')) return 'RBEX4100';
  if (lowered.includes('multiple drivers detected')) return 'RBEX4101';
  if (lowered.includes('combinational loop detected')) return 'RBEX4102';
  if (lowered.includes('floating output detected')) return 'RBEX4103';
  if (lowered.includes('missing a clock input')) return 'RBEX4200';
  if (lowered.includes('multiple clock domains detected')) return 'RBEX4201';
  if (lowered.includes('multiple clock drivers')) return 'RBEX4202';
  if (lowered.includes('multiple reset drivers')) return 'RBEX4203';
  if (lowered.includes('unsupported reset polarity')) return 'RBEX4204';
  if (lowered.includes('unsupported bus port')) return 'RBEX4300';
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

function diagnosticTitleFor(
  code: string,
  message: string,
  severity: ExportDiagnosticSeverity
): string {
  if (code === 'RBEX1001') return 'Unmapped required port';
  if (code === 'RBEX1002') return 'Declared port missing Basys3 assignment';
  if (code === 'RBEX4100') return 'Unsupported synth subset node';
  if (code === 'RBEX4101') return 'Multiple drivers on input port';
  if (code === 'RBEX4102') return 'Combinational loop detected';
  if (code === 'RBEX4103') return 'Floating output';
  if (code === 'RBEX4200') return 'Sequential node missing clock';
  if (code === 'RBEX4201') return 'Multiple clock domains';
  if (code === 'RBEX4202') return 'Sequential node has multiple clocks';
  if (code === 'RBEX4203') return 'Sequential node has multiple resets';
  if (code === 'RBEX4204') return 'Unsupported reset polarity';
  if (code === 'RBEX4300') return 'Unsupported top-level bus port';
  if (code === 'RBEX2001') return 'Unsupported Basys3 pin alias';
  if (code === 'RBEX2002') return 'Questionable direction mapping';
  if (code === 'RBEX2003') return 'Unused mapped signal';
  if (code === 'RBEX3001') return 'Ignored source XDC directive';
  if (message.length > 0) return message.split('.').at(0) ?? message;
  return severity === 'error' ? 'Export error' : 'Export warning';
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
  const normalized = normalizeArtifactContent(content);
  if (normalized.length === 0) return '';
  return normalized.split('\n').slice(0, 160).join('\n');
}

function normalizeArtifactContent(content: string): string {
  return content.replace(/\r\n/g, '\n').trim();
}
