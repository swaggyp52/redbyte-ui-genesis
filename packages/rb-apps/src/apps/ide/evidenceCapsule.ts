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

export interface EvidenceManifest {
  schemaVersion: 'rb.evidence-capsule.v1';
  toolVersion: string;
  createdAtIso: string;
  board: 'basys3';
  determinismHash: string;
  exportHash: string;
  verifyHash: string;
  verifyReportHash: string;
  files: EvidenceManifestFile[];
  manifestHash: string;
}

export interface BuildEvidenceCapsuleInput {
  project: RBProject;
  exportViewModel: ExportViewModel;
  verifyResult: ProjectHealthVerifyResult;
  deterministicHash: string;
  toolVersion: string;
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
    ['vectors.json', stableStringify(input.project.vectors ?? [])],
    ['verify-report.json', verifyReportText],
  ]);

  if (readme.trim().length > 0) {
    files.set('README.txt', readme);
  }

  const fileHashes = await computeFileHashes(files);
  const manifestBase = {
    schemaVersion: 'rb.evidence-capsule.v1' as const,
    toolVersion: input.toolVersion,
    createdAtIso: input.createdAtIso,
    board: 'basys3' as const,
    determinismHash: input.determinismHash,
    exportHash: input.exportViewModel.exportHash ?? 'pending',
    verifyHash: input.verifyResult.hash,
    verifyReportHash: input.verifyResult.reportHash ?? 'pending',
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
  const slice = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return hashBytes(slice);
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
