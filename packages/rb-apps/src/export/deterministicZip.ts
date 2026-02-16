import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { compareCodepoint } from './codepointSort';

export interface DeterministicZipEntry {
  name: string;
  text: string;
}

const FIXED_ZIP_DATE_ISO = '2026-01-01T00:00:00.000Z';

function normalizeEntryPath(name: string): string {
  return name.replace(/\\/g, '/');
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export async function buildDeterministicZip(entries: DeterministicZipEntry[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const fixedDate = new Date(FIXED_ZIP_DATE_ISO);

  const sortedEntries = [...entries].sort((left, right) =>
    compareCodepoint(normalizeEntryPath(left.name), normalizeEntryPath(right.name))
  );

  for (const entry of sortedEntries) {
    zip.file(normalizeEntryPath(entry.name), normalizeNewlines(entry.text), {
      createFolders: false,
      date: fixedDate,
    });
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
    platform: 'DOS',
    comment: '',
  });
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
