import JSZip from 'jszip';
import { createHash } from 'node:crypto';

const FIXED_ZIP_DATE_ISO = '2026-01-01T00:00:00.000Z';

function normalizeEntryPath(name) {
  return name.replace(/\\/g, '/');
}

export function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export async function buildDeterministicZip(entries) {
  const zip = new JSZip();
  const fixedDate = new Date(FIXED_ZIP_DATE_ISO);

  const sortedEntries = [...entries].sort((left, right) => normalizeEntryPath(left.name).localeCompare(normalizeEntryPath(right.name)));

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

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
