import type { LabWorkspaceMode } from '../apps/labWorkspace/workspaceUx';

export const NEO_MODE_ICONS: Record<LabWorkspaceMode, string> = {
  build: '◧',
  simulate: '◩',
  hardware: '◪',
  submit: '◫',
};

export const NEO_ACTION_ICONS = {
  examples: '▣',
  exportEvidence: '▤',
  openEvidence: '▥',
  run: '▷',
  pause: '▌▌',
  step: '▹',
  safeMode: '◈',
  blocking: '■',
  warning: '▲',
} as const;
