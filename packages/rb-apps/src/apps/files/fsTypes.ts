// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export interface FileEntry {
  id: string;
  name: string;
  type: 'folder' | 'file';
  modified: string;
}

export interface FolderData {
  id: string;
  name: string;
  entries: FileEntry[];
}

export interface FileSystemState {
  folders: Record<string, FolderData>;
  nextId: number;
  roots: string[]; // Protected folders that cannot be renamed or deleted
}
