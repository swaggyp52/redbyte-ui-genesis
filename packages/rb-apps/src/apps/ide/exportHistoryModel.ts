import type {
  ProjectHealthExportDownloadKind,
  ProjectHealthExportResult,
  ProjectHealthExportVerificationTrust,
} from './projectHealth';

/**
 * Read-models over the project store's export ledger (`exportHistory`, a
 * bounded ring appended by recordExport). They format each generation/download
 * event for display and compare two events by their content hashes, so the
 * package workspace can show a provenance list and an exact prev/current
 * comparison. They never own export truth.
 */

export interface ExportHistoryEntryView {
  /** Index into the raw history (0 = oldest). */
  index: number;
  /** 1-based display number, newest = 1. */
  ordinal: number;
  status: 'ok' | 'blocked';
  kind: ProjectHealthExportDownloadKind | 'unknown';
  trust: ProjectHealthExportVerificationTrust | 'unknown';
  atIso?: string;
  packageHash?: string;
  bundleHash?: string;
  manifestHash?: string;
  /** The generated-source fingerprint (sourceHashes.export or the top-level hash). */
  sourceHash?: string;
  raw: ProjectHealthExportResult;
}

function entryView(raw: ProjectHealthExportResult, index: number, ordinal: number): ExportHistoryEntryView {
  return {
    index,
    ordinal,
    status: raw.status,
    kind: raw.downloadKind ?? 'unknown',
    trust: raw.verificationTrust ?? 'unknown',
    atIso: raw.downloadedAtIso ?? raw.ranAtIso,
    packageHash: raw.packageHash,
    bundleHash: raw.bundleHash,
    manifestHash: raw.manifestHash,
    sourceHash: raw.sourceHashes?.export ?? raw.hash,
    raw,
  };
}

/** Newest-first views of the export history. */
export function buildExportHistoryViews(
  history: ProjectHealthExportResult[]
): ExportHistoryEntryView[] {
  // ordinal = 1-based chronological number (oldest = 1); render newest-first.
  return history
    .map((raw, index) => entryView(raw, index, index + 1))
    .reverse();
}

export interface ExportHashChange {
  field: 'package' | 'bundle' | 'manifest' | 'source';
  from?: string;
  to?: string;
}

const COMPARE_FIELDS: Array<{ field: ExportHashChange['field']; read: (v: ExportHistoryEntryView) => string | undefined }> = [
  { field: 'package', read: (v) => v.packageHash },
  { field: 'bundle', read: (v) => v.bundleHash },
  { field: 'manifest', read: (v) => v.manifestHash },
  { field: 'source', read: (v) => v.sourceHash },
];

export interface ExportComparison {
  identical: boolean;
  changes: ExportHashChange[];
}

/** Compare two export events by their content hashes. */
export function compareExportEntries(
  previous: ExportHistoryEntryView,
  current: ExportHistoryEntryView
): ExportComparison {
  const changes: ExportHashChange[] = [];
  for (const { field, read } of COMPARE_FIELDS) {
    const from = read(previous);
    const to = read(current);
    // Only report fields that are present on at least one side AND differ.
    if ((from || to) && from !== to) {
      changes.push({ field, from, to });
    }
  }
  return { identical: changes.length === 0, changes };
}

/** Short display form of a hash (first 12 chars) or an em dash when absent. */
export function shortHash(hash: string | undefined): string {
  if (!hash) return '—';
  return hash.length > 12 ? hash.slice(0, 12) : hash;
}
