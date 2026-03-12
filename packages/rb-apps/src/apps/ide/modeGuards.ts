import type { RBProject } from '../../export/projectFormat';
import { stableStringify } from '../../export/stableStringify';
import type { IDEMode } from './IdeContext';

type ProjectField = keyof RBProject;

const PROJECT_FIELDS: readonly ProjectField[] = [
  'kind',
  'version',
  'createdAt',
  'updatedAt',
  'name',
  'description',
  'circuit',
  'hdl',
  'fpga',
  'layout',
  'probes',
  'oscilloscope',
  'recorder',
  'ioMapping',
  'vectors',
  'traceMetadata',
  'submodules',
  'macros',
  'meta',
] as const;

const IMMUTABLE_FIELDS: readonly ProjectField[] = ['kind', 'version', 'createdAt'];
const ALWAYS_ALLOWED_FIELDS: readonly ProjectField[] = ['updatedAt'];

export const MODE_MUTATION_ALLOWLIST: Readonly<Record<IDEMode, readonly ProjectField[]>> = {
  project: ['name', 'description', 'meta', 'layout'],
  design: ['circuit', 'layout', 'submodules', 'macros'],
  verify: ['vectors', 'traceMetadata', 'recorder', 'probes', 'oscilloscope'],
  export: ['hdl', 'fpga', 'ioMapping', 'meta'],
  import: ['name', 'description', 'circuit', 'hdl', 'fpga', 'ioMapping', 'vectors', 'submodules', 'macros', 'layout', 'meta', 'probes', 'oscilloscope', 'recorder', 'traceMetadata'],
};

const serializeValue = (value: unknown): string => {
  if (value === undefined) return '__RB_UNDEFINED__';
  return stableStringify(value);
};

const didFieldChange = (before: RBProject, after: RBProject, field: ProjectField): boolean => {
  return serializeValue(before[field]) !== serializeValue(after[field]);
};

export interface ModeGuardBoundaryResult {
  mode: IDEMode;
  ok: boolean;
  changedFields: ProjectField[];
  disallowedFields: ProjectField[];
}

export interface ModeGuardViolationLog {
  mode: IDEMode;
  message: string;
  changedFields: ProjectField[];
  disallowedFields: ProjectField[];
}

export const evaluateModeMutationBoundary = (
  mode: IDEMode,
  before: RBProject,
  after: RBProject
): ModeGuardBoundaryResult => {
  const changedFields = PROJECT_FIELDS.filter((field) => didFieldChange(before, after, field));
  const allowedFields = new Set<ProjectField>([
    ...MODE_MUTATION_ALLOWLIST[mode],
    ...ALWAYS_ALLOWED_FIELDS,
  ]);

  const disallowedFields = changedFields.filter(
    (field) => IMMUTABLE_FIELDS.includes(field) || !allowedFields.has(field)
  );

  return {
    mode,
    ok: disallowedFields.length === 0,
    changedFields,
    disallowedFields,
  };
};

export const formatModeGuardMessage = (result: ModeGuardBoundaryResult): string => {
  if (result.ok) {
    return `Mode guard passed for mode=${result.mode}.`;
  }
  return `Mode guard blocked illegal mutation in mode=${result.mode}; disallowed fields: ${result.disallowedFields.join(', ')}`;
};

export const logModeGuardViolation = (
  logger: (entry: ModeGuardViolationLog) => void,
  result: ModeGuardBoundaryResult
): void => {
  if (result.ok) return;
  logger({
    mode: result.mode,
    message: formatModeGuardMessage(result),
    changedFields: result.changedFields,
    disallowedFields: result.disallowedFields,
  });
};
