// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * First-class source / fileset model — the single source-of-truth for HDL and
 * related text sources in a RedByte project.
 *
 * This model is the one *writable* authority for sources; every other view of
 * sources (the legacy `RBProject.hdl` toolchain input, export filesets, the
 * import review) is a projection of it. It is deliberately shape-agnostic about
 * *what the source means* — parsing, capability tiers, and diagnostics arrive in
 * P2-3. Here a source file is opaque text with a language, a fileset, and a
 * library, plus a deterministic normal form so it round-trips through the
 * versioned project format.
 *
 * Design boundaries:
 * - Deterministic: ids are derived from paths (never random), and normalization
 *   sorts stably, so serialization is byte-stable.
 * - Additive: a project without a source model is valid; the model is optional
 *   and empty by default.
 * - Honest: `unknown` is a first-class language, not a guess.
 */

import { compareCodepoint } from '../../export/codepointSort';

/**
 * Source languages RedByte can carry. Capability *tiers* (bounded-subset /
 * read-only / opaque / missing) are layered on in P2-3; this is only the
 * declared language of the text.
 */
export type SourceLanguage =
  | 'vhdl'
  | 'verilog'
  | 'systemverilog'
  | 'xdc'
  | 'tcl'
  | 'vcd'
  | 'unknown';

/**
 * Filesets group sources by role, mirroring the Vivado fileset model:
 * - `design`     — synthesizable RTL (the design under test).
 * - `simulation` — testbenches and simulation-only sources.
 * - `constraint` — XDC / timing / pin constraints.
 * - `utility`    — Tcl and other scripts; never executed by RedByte.
 */
export type FilesetKind = 'design' | 'simulation' | 'constraint' | 'utility';

export interface SourceFile {
  /** Stable id, unique within the model. Derived from `path` when not supplied. */
  id: string;
  /** Logical path, unique within the model (e.g. `rtl/top.vhd`). */
  path: string;
  language: SourceLanguage;
  fileset: FilesetKind;
  /** VHDL/Verilog library. Defaults to `work`. */
  library: string;
  /** The source text, preserved verbatim. */
  text: string;
}

export interface ProjectSourceModel {
  schemaVersion: typeof PROJECT_SOURCE_MODEL_SCHEMA_VERSION;
  files: SourceFile[];
  /** Declared top entity/module name, when the project designates one. */
  topEntity?: string;
}

export const PROJECT_SOURCE_MODEL_SCHEMA_VERSION = '1.0' as const;
export const DEFAULT_SOURCE_LIBRARY = 'work';

const FILESET_KINDS: readonly FilesetKind[] = ['design', 'simulation', 'constraint', 'utility'];
const FILESET_ORDER: Record<FilesetKind, number> = {
  design: 0,
  simulation: 1,
  constraint: 2,
  utility: 3,
};

/** Filesets whose sources participate in the HDL compile order. */
const COMPILE_FILESETS: readonly FilesetKind[] = ['design', 'simulation'];

const LANGUAGES: readonly SourceLanguage[] = [
  'vhdl',
  'verilog',
  'systemverilog',
  'xdc',
  'tcl',
  'vcd',
  'unknown',
];

const EXTENSION_LANGUAGE: Record<string, SourceLanguage> = {
  vhd: 'vhdl',
  vhdl: 'vhdl',
  v: 'verilog',
  verilog: 'verilog',
  sv: 'systemverilog',
  svh: 'systemverilog',
  xdc: 'xdc',
  tcl: 'tcl',
  vcd: 'vcd',
};

const LANGUAGE_DEFAULT_FILESET: Record<SourceLanguage, FilesetKind> = {
  vhdl: 'design',
  verilog: 'design',
  systemverilog: 'design',
  xdc: 'constraint',
  tcl: 'utility',
  vcd: 'simulation',
  unknown: 'utility',
};

export function createEmptyProjectSourceModel(): ProjectSourceModel {
  return { schemaVersion: PROJECT_SOURCE_MODEL_SCHEMA_VERSION, files: [] };
}

/** Detect a source language from a path's extension; `unknown` when unrecognized. */
export function detectSourceLanguage(path: string): SourceLanguage {
  const match = /\.([A-Za-z0-9]+)$/.exec(path.trim());
  if (!match) return 'unknown';
  return EXTENSION_LANGUAGE[match[1]!.toLowerCase()] ?? 'unknown';
}

/** The natural default fileset for a language (used when none is specified). */
export function defaultFilesetForLanguage(language: SourceLanguage): FilesetKind {
  return LANGUAGE_DEFAULT_FILESET[language] ?? 'utility';
}

/** Slugify a path into a stable, filesystem-safe id (no random component). */
export function sourceIdFromPath(path: string): string {
  const slug = path
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `src-${slug}` : 'src';
}

export interface AddSourceFileInput {
  path: string;
  text: string;
  language?: SourceLanguage;
  fileset?: FilesetKind;
  library?: string;
  id?: string;
}

/**
 * Add a source file, returning a new normalized model. Throws when the path (or
 * a supplied id) collides with an existing entry — sources are unique by path.
 */
export function addSourceFile(model: ProjectSourceModel, input: AddSourceFileInput): ProjectSourceModel {
  const path = input.path.trim();
  if (!path) throw new Error('Source file path is required');
  const language = input.language ?? detectSourceLanguage(path);
  const fileset = input.fileset ?? defaultFilesetForLanguage(language);
  const library = (input.library ?? DEFAULT_SOURCE_LIBRARY).trim() || DEFAULT_SOURCE_LIBRARY;
  const id = (input.id ?? sourceIdFromPath(path)).trim() || sourceIdFromPath(path);

  for (const existing of model.files) {
    if (existing.path === path) throw new Error(`Duplicate source path "${path}"`);
    if (existing.id === id) throw new Error(`Duplicate source id "${id}"`);
  }

  const file: SourceFile = { id, path, language, fileset, library, text: input.text };
  return normalizeProjectSourceModel({
    ...model,
    files: [...model.files, file],
  });
}

/**
 * Promote a legacy {@link import('../../fpga/toolchainBackend').ToolchainProjectInput}
 * into the source model: each source lands in its language's natural fileset
 * (RTL → `design`, XDC → `constraint`, Tcl → `utility`) in the `work` library,
 * and the toolchain `top` becomes `topEntity`. This is the seed for the v1 -> v2
 * project-format migration.
 */
export function promoteToolchainInput(
  hdl: { sources?: { path?: unknown; language?: unknown; text?: unknown }[]; top?: unknown } | null | undefined
): ProjectSourceModel {
  if (!hdl || !Array.isArray(hdl.sources)) return createEmptyProjectSourceModel();
  let model = createEmptyProjectSourceModel();
  const topEntity = typeof hdl.top === 'string' && hdl.top.trim() ? hdl.top.trim() : undefined;
  for (const source of hdl.sources) {
    const path = typeof source?.path === 'string' ? source.path.trim() : '';
    if (!path) continue;
    const language = normalizeLanguage(source?.language) ?? detectSourceLanguage(path);
    const text = typeof source?.text === 'string' ? source.text : '';
    // Skip duplicates rather than throw — legacy inputs may repeat a path.
    if (model.files.some((file) => file.path === path)) continue;
    model = addSourceFile(model, { path, text, language, fileset: defaultFilesetForLanguage(language) });
  }
  return topEntity ? { ...model, topEntity } : model;
}

/**
 * Derive the HDL compile order: design sources first, then simulation sources,
 * each group ordered deterministically by library then path. Constraint and
 * utility files are excluded. Dependency-aware (leaf-first) ordering is layered
 * on in P2-3 once source parsing exists; until then this is a stable, explicit
 * ordering.
 */
export function deriveCompileOrder(model: ProjectSourceModel): SourceFile[] {
  return model.files
    .filter((file) => COMPILE_FILESETS.includes(file.fileset))
    .slice()
    .sort((a, b) => {
      const filesetDelta = FILESET_ORDER[a.fileset] - FILESET_ORDER[b.fileset];
      if (filesetDelta !== 0) return filesetDelta;
      const libDelta = compareCodepoint(a.library, b.library);
      if (libDelta !== 0) return libDelta;
      return compareCodepoint(a.path, b.path);
    });
}

/** The distinct libraries referenced by the model's sources, sorted. */
export function listLibraries(model: ProjectSourceModel): string[] {
  return [...new Set(model.files.map((file) => file.library))].sort(compareCodepoint);
}

/** Files grouped by fileset, in canonical fileset order. */
export function filesByFileset(model: ProjectSourceModel): Record<FilesetKind, SourceFile[]> {
  const grouped: Record<FilesetKind, SourceFile[]> = {
    design: [],
    simulation: [],
    constraint: [],
    utility: [],
  };
  for (const file of model.files) grouped[file.fileset].push(file);
  return grouped;
}

export interface SourceModelValidation {
  ok: boolean;
  errors: string[];
}

export function validateProjectSourceModel(model: ProjectSourceModel): SourceModelValidation {
  const errors: string[] = [];
  const paths = new Set<string>();
  const ids = new Set<string>();
  for (const file of model.files) {
    if (!file.path.trim()) errors.push('A source file has an empty path.');
    if (paths.has(file.path)) errors.push(`Duplicate source path "${file.path}".`);
    if (ids.has(file.id)) errors.push(`Duplicate source id "${file.id}".`);
    if (!file.library.trim()) errors.push(`Source "${file.path}" has an empty library.`);
    if (!FILESET_KINDS.includes(file.fileset)) errors.push(`Source "${file.path}" has an invalid fileset.`);
    if (!LANGUAGES.includes(file.language)) errors.push(`Source "${file.path}" has an invalid language.`);
    paths.add(file.path);
    ids.add(file.id);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Normalize an arbitrary value into a valid, deterministically-ordered source
 * model. Tolerant of malformed input (drops invalid entries) so decoding an
 * older or partial document never throws. Files are sorted by fileset, library,
 * then path for byte-stable serialization.
 */
export function normalizeProjectSourceModel(value: unknown): ProjectSourceModel {
  if (!isRecord(value) || !Array.isArray(value.files)) {
    return createEmptyProjectSourceModel();
  }
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const files: SourceFile[] = [];
  for (const entry of value.files) {
    if (!isRecord(entry)) continue;
    const path = typeof entry.path === 'string' ? entry.path.trim() : '';
    if (!path || seenPaths.has(path)) continue;
    const language = normalizeLanguage(entry.language) ?? detectSourceLanguage(path);
    const fileset = normalizeFileset(entry.fileset) ?? defaultFilesetForLanguage(language);
    const library =
      typeof entry.library === 'string' && entry.library.trim() ? entry.library.trim() : DEFAULT_SOURCE_LIBRARY;
    let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : sourceIdFromPath(path);
    if (seenIds.has(id)) id = `${id}-${files.length}`;
    const text = typeof entry.text === 'string' ? entry.text : '';
    seenPaths.add(path);
    seenIds.add(id);
    files.push({ id, path, language, fileset, library, text });
  }
  files.sort((a, b) => {
    const filesetDelta = FILESET_ORDER[a.fileset] - FILESET_ORDER[b.fileset];
    if (filesetDelta !== 0) return filesetDelta;
    const libDelta = compareCodepoint(a.library, b.library);
    if (libDelta !== 0) return libDelta;
    const pathDelta = compareCodepoint(a.path, b.path);
    if (pathDelta !== 0) return pathDelta;
    return compareCodepoint(a.id, b.id);
  });
  const topEntity = typeof value.topEntity === 'string' && value.topEntity.trim() ? value.topEntity.trim() : undefined;
  const model: ProjectSourceModel = { schemaVersion: PROJECT_SOURCE_MODEL_SCHEMA_VERSION, files };
  return topEntity ? { ...model, topEntity } : model;
}

/** True when the model carries no sources and no declared top. */
export function isEmptyProjectSourceModel(model: ProjectSourceModel): boolean {
  return model.files.length === 0 && !model.topEntity;
}

function normalizeLanguage(value: unknown): SourceLanguage | null {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return (LANGUAGES as readonly string[]).includes(lower) ? (lower as SourceLanguage) : null;
}

function normalizeFileset(value: unknown): FilesetKind | null {
  if (typeof value !== 'string') return null;
  const lower = value.trim().toLowerCase();
  return (FILESET_KINDS as readonly string[]).includes(lower) ? (lower as FilesetKind) : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
