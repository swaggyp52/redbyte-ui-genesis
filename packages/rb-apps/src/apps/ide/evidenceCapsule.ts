import JSZip from 'jszip';
import type { RBProject } from '../../export/projectFormat';
import { compareCodepoint } from '../../export/codepointSort';
import { stableStringify } from '../../export/stableStringify';
import { hashBytes } from '../../utils/stableSerialize';
import type { ProjectHealthVerifyResult } from './projectHealth';
import type { ExportViewModel } from './viewmodels/buildExportViewModel';

const ZIP_ENTRY_DATE = new Date('2026-01-01T00:00:00.000Z');

export interface EvidenceManifestFile {
  path: string;
  sha256: string;
  sizeBytes: number;
}

export interface EvidenceManifestProject {
  name: string;
  id: string;
}

export interface EvidenceManifestToolchain {
  redbyteVersion: string;
  redbyteCommit: string;
}

export interface EvidenceManifestHashes {
  determinismHash: string;
  exportHash: string;
  verifyHash: string;
  verifyReportHash: string;
}

export interface EvidenceManifestMappingEntry {
  signal: string;
  direction: 'in' | 'out' | 'inout';
  pin: string;
  required: boolean;
  status: 'mapped' | 'missing' | 'unused';
}

export interface EvidenceManifest {
  schemaVersion: 'rb.evidence-capsule.v2';
  createdAtIso: string;
  project: EvidenceManifestProject;
  board: 'basys3';
  toolchain: EvidenceManifestToolchain;
  hashes: EvidenceManifestHashes;
  mappingSummary: EvidenceManifestMappingEntry[];
  files: EvidenceManifestFile[];
  manifestHash: string;
}

export interface BuildEvidenceCapsuleInput {
  project: RBProject;
  exportViewModel: ExportViewModel;
  verifyResult: ProjectHealthVerifyResult;
  deterministicHash: string;
  toolVersion: string;
  toolCommit: string;
  createdAtIso: string;
}

export interface BuildEvidenceCapsuleOutput {
  zipBytes: Uint8Array;
  bundleHash: string;
  manifest: EvidenceManifest;
  filePaths: string[];
}

export async function buildEvidenceCapsule(
  input: BuildEvidenceCapsuleInput
): Promise<BuildEvidenceCapsuleOutput> {
  const topVhd = requireArtifactContent(input.exportViewModel, 'top.vhd');
  const topXdc = requireArtifactContent(input.exportViewModel, 'top.xdc');
  const testbench = requireArtifactContent(input.exportViewModel, 'testbench.vhd');
  const vivadoImportTcl = requireArtifactContent(input.exportViewModel, 'vivado_import.tcl');
  const bringupDoc = requireArtifactContent(input.exportViewModel, 'BRINGUP.md');
  const expectedIo = requireArtifactContent(input.exportViewModel, 'EXPECTED_IO.json');
  const programAndTestTcl = requireArtifactContent(input.exportViewModel, 'program_and_test.tcl');
  const readme = resolveArtifactContent(input.exportViewModel, 'README.txt');
  const verifyReportText = stableStringify(
    input.verifyResult.report ?? {
      status: input.verifyResult.status,
      deterministicHash: input.verifyResult.hash,
      firstFailingTick: input.verifyResult.failingTick,
      ranAtIso: input.verifyResult.ranAtIso,
      reportHash: input.verifyResult.reportHash ?? 'pending',
    }
  );

  const files = new Map<string, string>([
    ['rb-project.json', stableStringify(input.project)],
    ['top.vhd', topVhd],
    ['top.xdc', topXdc],
    ['testbench.vhd', testbench],
    ['vivado_import.tcl', vivadoImportTcl],
    ['BRINGUP.md', bringupDoc],
    ['EXPECTED_IO.json', expectedIo],
    ['program_and_test.tcl', programAndTestTcl],
    ['vectors.json', stableStringify(input.project.vectors ?? [])],
    ['verify-report.json', verifyReportText],
  ]);

  if (readme.trim().length > 0) {
    files.set('README.txt', readme);
  }

  const fileHashes = await computeFileHashes(files);
  const manifestBase = {
    schemaVersion: 'rb.evidence-capsule.v2' as const,
    createdAtIso: input.createdAtIso,
    project: {
      name: input.project.name,
      id: resolveProjectId(input.project),
    },
    board: 'basys3' as const,
    toolchain: {
      redbyteVersion: input.toolVersion,
      redbyteCommit: input.toolCommit,
    },
    hashes: {
      determinismHash: input.deterministicHash,
      exportHash: input.exportViewModel.exportHash ?? 'pending',
      verifyHash: input.verifyResult.hash,
      verifyReportHash: input.verifyResult.reportHash ?? 'pending',
    },
    mappingSummary: buildMappingSummary(input.exportViewModel),
    files: fileHashes,
  };
  const manifestHash = await sha256FromText(stableStringify(manifestBase));
  const manifest: EvidenceManifest = {
    ...manifestBase,
    manifestHash,
  };

  files.set('MANIFEST.json', stableStringify(manifest));

  const zip = new JSZip();
  const sortedPaths = Array.from(files.keys()).sort(compareCodepoint);
  for (const path of sortedPaths) {
    zip.file(path, normalizeNewlines(files.get(path) ?? ''), {
      createFolders: false,
      date: ZIP_ENTRY_DATE,
    });
  }

  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
    platform: 'DOS',
    comment: '',
  });

  return {
    zipBytes,
    bundleHash: await sha256FromBytes(zipBytes),
    manifest,
    filePaths: sortedPaths,
  };
}

function requireArtifactContent(viewModel: ExportViewModel, path: string): string {
  const value = resolveArtifactContent(viewModel, path);
  if (value.trim().length === 0) {
    throw new Error(`required artifact content missing: ${path}`);
  }
  return value;
}

function resolveArtifactContent(viewModel: ExportViewModel, path: string): string {
  const artifact = viewModel.artifacts.find(
    (entry) => entry.path.toLowerCase() === path.toLowerCase()
  );
  return artifact?.content ?? '';
}

function buildMappingSummary(viewModel: ExportViewModel): EvidenceManifestMappingEntry[] {
  return viewModel.pinTable
    .map((row) => ({
      signal: row.port,
      direction: row.direction,
      pin: row.pin ?? '',
      required: row.required,
      status: row.status,
    }))
    .sort((left, right) => compareCodepoint(left.signal, right.signal));
}

function resolveProjectId(project: RBProject): string {
  const projectId = (project.meta?.projectId ?? '').trim();
  if (projectId.length > 0) return projectId;

  const normalized = project.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'rb-project';
}

async function computeFileHashes(files: Map<string, string>): Promise<EvidenceManifestFile[]> {
  const entries: EvidenceManifestFile[] = [];
  const sortedPaths = Array.from(files.keys()).sort(compareCodepoint);

  for (const path of sortedPaths) {
    const content = normalizeNewlines(files.get(path) ?? '');
    const bytes = new TextEncoder().encode(content);
    entries.push({
      path,
      sha256: await sha256FromBytes(bytes),
      sizeBytes: bytes.byteLength,
    });
  }

  return entries;
}

async function sha256FromText(text: string): Promise<string> {
  return sha256FromBytes(new TextEncoder().encode(normalizeNewlines(text)));
}

async function sha256FromBytes(bytes: Uint8Array): Promise<string> {
  const normalized = new Uint8Array(bytes.byteLength);
  normalized.set(bytes);
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digest = await crypto.subtle.digest('SHA-256', normalized);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }
  return hashBytes(normalized.buffer);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
