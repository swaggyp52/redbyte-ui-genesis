import type { IdeMode } from './workflowStages';

const IDE_MODES = new Set<IdeMode>([
  'project',
  'design',
  'verify',
  'hardware',
  'export',
  'import',
]);

export function isIdeMode(value: unknown): value is IdeMode {
  return typeof value === 'string' && IDE_MODES.has(value as IdeMode);
}

export function normalizeIdeMode(value: unknown, fallback: IdeMode = 'project'): IdeMode {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  return isIdeMode(normalized) ? normalized : fallback;
}

export function resolveRequestedIdeMode(search: string): IdeMode | null {
  const requestedMode = new URLSearchParams(search).get('mode')?.trim().toLowerCase();
  if (!requestedMode) return null;
  return isIdeMode(requestedMode) ? requestedMode : null;
}

export function resolveInitialIdeModeFromSearch(search: string): IdeMode {
  return resolveRequestedIdeMode(search) ?? 'project';
}

export function resolveRestoredIdeMode(search: string): IdeMode {
  return resolveRequestedIdeMode(search) ?? 'project';
}
