import JSZip from 'jszip';
import { compareCodepoint } from './codepointSort';

export interface DeterministicZipEntry {
  name: string;
  text: string;
  dir?: boolean;
}

const FIXED_ZIP_DATE_ISO = '2026-01-01T00:00:00.000Z';

function normalizeEntryPath(name: string): string {
  return name.replace(/\\/g, '/');
}

function normalizeDirectoryPath(name: string): string {
  const normalized = normalizeEntryPath(name).replace(/\/+$/g, '');
  return normalized.length > 0 ? `${normalized}/` : normalized;
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
    const normalizedName = entry.dir
      ? normalizeDirectoryPath(entry.name)
      : normalizeEntryPath(entry.name);
    zip.file(normalizedName, entry.dir ? '' : normalizeNewlines(entry.text), {
      createFolders: false,
      date: fixedDate,
      dir: entry.dir === true,
    });
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
    platform: 'DOS',
    comment: '',
  });
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto SHA-256 is unavailable.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
