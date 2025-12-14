// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { SerializedCircuitV1 } from '@redbyte/rb-logic-core';

export interface LogicFile {
  id: string;
  name: string;
  updatedAt: string;
  circuit: SerializedCircuitV1;
}

const STORAGE_KEY = 'rb:files:rblogic:v1';

function loadFiles(): LogicFile[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveFiles(files: LogicFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function listFiles(): LogicFile[] {
  return loadFiles();
}

export function createFile(name: string, circuit: SerializedCircuitV1): LogicFile {
  const files = loadFiles();
  const newFile: LogicFile = {
    id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name,
    updatedAt: new Date().toISOString(),
    circuit,
  };
  files.push(newFile);
  saveFiles(files);
  return newFile;
}

export function renameFile(id: string, newName: string): void {
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    file.name = newName;
    file.updatedAt = new Date().toISOString();
    saveFiles(files);
  }
}

export function deleteFile(id: string): void {
  const files = loadFiles();
  const filtered = files.filter((f) => f.id !== id);
  saveFiles(filtered);
}

export function getFile(id: string): LogicFile | null {
  const files = loadFiles();
  return files.find((f) => f.id === id) ?? null;
}

export function updateFile(id: string, circuit: SerializedCircuitV1): void {
  const files = loadFiles();
  const file = files.find((f) => f.id === id);
  if (file) {
    file.circuit = circuit;
    file.updatedAt = new Date().toISOString();
    saveFiles(files);
  }
}
