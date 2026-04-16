// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Provenance of an imported project as captured by the ImportSurface commit step.
 *
 * Persisted alongside the project runtime so that the Project Bridge and other
 * truth surfaces remain honest after reload. Prior to persistence this lived
 * only as transient React state on IdeApp, which caused the Bridge to silently
 * degrade to "native" after a refresh of an imported project.
 */

export type IdeImportFidelity = 'full' | 'reconstructed' | 'partial';
export type IdeImportMode = 'manifest' | 'reconstructed';
export type IdeImportReconstructionLevel = 'full' | 'ports-only' | 'empty';

export interface IdeImportMeta {
  fidelity: IdeImportFidelity;
  importMode: IdeImportMode;
  reconstructionLevel: IdeImportReconstructionLevel;
  sourceName: string;
}

const VALID_FIDELITIES: readonly IdeImportFidelity[] = ['full', 'reconstructed', 'partial'];
const VALID_IMPORT_MODES: readonly IdeImportMode[] = ['manifest', 'reconstructed'];
const VALID_RECONSTRUCTION_LEVELS: readonly IdeImportReconstructionLevel[] = [
  'full',
  'ports-only',
  'empty',
];

export function cloneImportMeta(meta: IdeImportMeta | null | undefined): IdeImportMeta | null {
  if (!meta) return null;
  return {
    fidelity: meta.fidelity,
    importMode: meta.importMode,
    reconstructionLevel: meta.reconstructionLevel,
    sourceName: meta.sourceName,
  };
}

export function normalizePersistedImportMeta(
  candidate: unknown
): IdeImportMeta | null {
  if (!candidate || typeof candidate !== 'object') return null;
  const raw = candidate as Partial<IdeImportMeta>;
  if (!raw.fidelity || !VALID_FIDELITIES.includes(raw.fidelity)) return null;
  if (!raw.importMode || !VALID_IMPORT_MODES.includes(raw.importMode)) return null;
  if (
    !raw.reconstructionLevel ||
    !VALID_RECONSTRUCTION_LEVELS.includes(raw.reconstructionLevel)
  ) {
    return null;
  }
  return {
    fidelity: raw.fidelity,
    importMode: raw.importMode,
    reconstructionLevel: raw.reconstructionLevel,
    sourceName: typeof raw.sourceName === 'string' ? raw.sourceName : '',
  };
}
