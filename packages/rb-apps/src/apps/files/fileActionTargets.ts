// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { FileEntry } from './fsTypes';

export interface FileActionTarget {
  id: string;
  name: string;
  appId: string;
  supportedTypes: Array<'file' | 'folder'>;
}

/**
 * Registry of apps that can receive file actions via open-with intents.
 * Single source of truth for "Open With" targets.
 */
export const FILE_ACTION_TARGETS: FileActionTarget[] = [
  {
    id: 'logic-playground',
    name: 'Logic Playground',
    appId: 'logic-playground',
    supportedTypes: ['file'],
  },
  // Future targets:
  // { id: 'text-viewer', name: 'Text Viewer', appId: 'text-viewer', supportedTypes: ['file'] },
  // { id: 'image-viewer', name: 'Image Viewer', appId: 'image-viewer', supportedTypes: ['file'] },
];

/**
 * Get all file action targets that support the given entry type.
 */
export function getFileActionTargets(entry: FileEntry): FileActionTarget[] {
  return FILE_ACTION_TARGETS.filter((target) =>
    target.supportedTypes.includes(entry.type)
  );
}

/**
 * Check if a file action is eligible for the given entry.
 * Returns false for folders (no file actions), true for files with available targets.
 */
export function isFileActionEligible(entry: FileEntry | null): boolean {
  if (!entry) return false;
  if (entry.type === 'folder') return false;
  return getFileActionTargets(entry).length > 0;
}

/**
 * Get the default file action target (Logic Playground).
 */
export function getDefaultFileActionTarget(): FileActionTarget | null {
  return FILE_ACTION_TARGETS.find((t) => t.id === 'logic-playground') || null;
}
