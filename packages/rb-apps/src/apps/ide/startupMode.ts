import type { IdeMode } from './components/IdeLeftRail';

const IDE_MODES = new Set<IdeMode>([
  'project',
  'design',
  'verify',
  'hardware',
  'export',
  'import',
]);

export function resolveRequestedIdeMode(search: string): IdeMode | null {
  const requestedMode = new URLSearchParams(search).get('mode')?.trim().toLowerCase();
  if (!requestedMode) return null;
  return IDE_MODES.has(requestedMode as IdeMode) ? (requestedMode as IdeMode) : null;
}

export function resolveInitialIdeModeFromSearch(search: string): IdeMode {
  return resolveRequestedIdeMode(search) ?? 'project';
}

export function resolveRestoredIdeMode(search: string): IdeMode {
  return resolveRequestedIdeMode(search) ?? 'project';
}
