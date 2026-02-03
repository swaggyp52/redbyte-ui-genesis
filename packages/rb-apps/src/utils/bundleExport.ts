// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis

import JSZip from 'jszip';
import {
  buildCapsule,
  normalizeCapsulePath
} from '@redbyte/rb-fpga-signing';

export interface BoardProfile {
  board: string;
  uart_baud: number;
  digital_signals: Record<string, string>;
  analog_signals: Record<string, string>;
}

export interface ExportV2Options {
  labId: string;
  labVersion?: string;
  scaffoldHash?: string;
  studentId?: string;
  studentName?: string;
  redbyteVersion?: string;
  board?: string;
  binSizeMs?: number;
  traceNdjson?: string;
  traceEventCount?: number;
  crcFailures?: number;
  bitstreamBytes?: Uint8Array | Blob;
  boardProfile?: BoardProfile;
  hardwareSnapshots?: any[];
  eventLog?: any[];
}

export interface ExportResult {
  filename: string;
  blob: Blob;
  hash: string;
  timestamp: string;
}

/**
 * Hash computation for integrity
 */
async function computeHash(input: Uint8Array | Blob): Promise<string | undefined> {
  try {
    let buffer: ArrayBuffer;
    if (input instanceof Blob) {
      if (typeof input.arrayBuffer === 'function') {
        buffer = await input.arrayBuffer();
      } else if ((input as any).buffer instanceof ArrayBuffer) {
        buffer = (input as any).buffer as ArrayBuffer;
      } else if ((input as any)._buffer) {
        const raw = (input as any)._buffer;
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
          buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        } else if (raw instanceof ArrayBuffer) {
          buffer = raw;
        } else {
          buffer = new Uint8Array(0).buffer;
        }
      } else if (typeof input.text === 'function') {
        const text = await input.text();
        buffer = new TextEncoder().encode(text).buffer;
      } else if (typeof Response !== 'undefined') {
        buffer = await new Response(input as any).arrayBuffer();
      } else {
        buffer = new Uint8Array(0).buffer;
      }
    } else {
      buffer = input.buffer;
    }
    const bufferSource = (buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer))
      ? buffer
      : new Uint8Array(0);
    // @ts-ignore
    const hashBuffer = await crypto.subtle.digest('SHA-256', bufferSource as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    const shouldLog = typeof process === 'undefined' || process.env?.NODE_ENV !== 'test';
    if (shouldLog) {
      console.warn('Failed to compute hash:', e);
    }
    return undefined;
  }
}

function countNdjsonEvents(ndjson: string): number {
  return ndjson
    .split('\n')
    .filter((line) => line.trim())
    .length;
}

async function toUint8Array(input: string | Uint8Array | Blob): Promise<Uint8Array> {
  if (typeof input === 'string') {
    const encoded = new TextEncoder().encode(input);
    return new Uint8Array(encoded);
  }
  if (input instanceof Uint8Array) {
    return new Uint8Array(input);
  }
  let buffer: ArrayBuffer;
  if (typeof input.arrayBuffer === 'function') {
    buffer = await input.arrayBuffer();
  } else if ((input as any).buffer instanceof ArrayBuffer) {
    buffer = (input as any).buffer as ArrayBuffer;
  } else if ((input as any)._buffer) {
    const raw = (input as any)._buffer;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
      buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    } else if (raw instanceof ArrayBuffer) {
      buffer = raw;
    } else {
      buffer = new Uint8Array(0).buffer;
    }
  } else if (typeof input.text === 'function') {
    const text = await input.text();
    buffer = new TextEncoder().encode(text).buffer;
  } else if (typeof Response !== 'undefined') {
    buffer = await new Response(input as any).arrayBuffer();
  } else {
    buffer = new Uint8Array(0).buffer;
  }
  return new Uint8Array(buffer);
}

/**
 * Trigger download of a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export a valid .rb-lab.zip bundle with schema v2
 */
export async function exportV2Bundle(options: ExportV2Options): Promise<ExportResult> {
  const warnings: Array<{ step: string; message: string; error?: string }> = [];
  const pushWarning = (step: string, message: string, error?: unknown) => {
    warnings.push({
      step,
      message,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
    });
  };

  try {
    const timestamp = new Date().toISOString();
    // @ts-ignore - Handle Vite env if present, otherwise default
    const redbyteVersion = options.redbyteVersion ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_VERSION) ||
      'dev';

    const board = options.board ?? 'basys3';
    const binSizeMs = options.binSizeMs ?? 20;
    const traceNdjson = options.traceNdjson ?? '';
    const traceEventCount = options.traceEventCount ?? countNdjsonEvents(traceNdjson);
    const crcFailures = options.crcFailures ?? 0;
    const bitstreamPresent = !!options.bitstreamBytes;

    const manifest = {
      schema_version: 'v2',
      redbyte_version: redbyteVersion,
      lab_id: options.labId,
      lab_version: options.labVersion ?? 'unversioned',
      scaffold_hash: options.scaffoldHash ?? 'unknown',
      student: {
        id: options.studentId,
        name: options.studentName
      },
      board,
      bin_size_ms: binSizeMs,
      trace_summary: {
        events: traceEventCount,
        crc_failures: crcFailures,
      },
      bitstream_present: bitstreamPresent,
    };

    const boardProfile: BoardProfile = options.boardProfile ?? {
      board,
      uart_baud: 115200,
      digital_signals: { "0": "SW0", "1": "SW1", "2": "BTN0" },
      analog_signals: { "0": "ComparatorOut", "1": "LDR_Level" },
    };

    const zip = new JSZip();
    const capsuleFiles: Array<{ path: string; bytes: Uint8Array }> = [];

    const addFile = async (path: string, data: string | Uint8Array | Blob) => {
      const normalizedPath = normalizeCapsulePath(path);
      const bytes = await toUint8Array(data);
      zip.file(normalizedPath, bytes);
      capsuleFiles.push({ path: normalizedPath, bytes });
    };

    const safeAddFile = async (path: string, data: string | Uint8Array | Blob, step: string) => {
      try {
        await addFile(path, data);
      } catch (error) {
        pushWarning(step, `Failed to add ${path}; continuing without it.`, error);
      }
    };

    await safeAddFile('manifest.json', JSON.stringify(manifest, null, 2), 'manifest');
    await safeAddFile('trace/hw_trace.ndjson', traceNdjson, 'trace');
    await safeAddFile('meta/board_profile.json', JSON.stringify(boardProfile, null, 2), 'board-profile');

    if (options.bitstreamBytes) {
      await safeAddFile('bitstream/design.bit', options.bitstreamBytes, 'bitstream');
    }

    if (options.hardwareSnapshots) {
      await safeAddFile('proofs/snapshots.json', JSON.stringify(options.hardwareSnapshots, null, 2), 'snapshots');
    }

    if (options.eventLog) {
      const ndjson = options.eventLog.map(e => JSON.stringify(e)).join('\n');
      await safeAddFile('proofs/events.ndjson', ndjson, 'events');
    }

    try {
      const { capsuleJsonUtf8 } = await buildCapsule(capsuleFiles);
      zip.file('integrity/capsule.json', new Uint8Array(capsuleJsonUtf8));
    } catch (error) {
      pushWarning('capsule', 'Failed to build integrity capsule; continuing without it.', error);
    }

    if (warnings.length > 0) {
      await safeAddFile(
        'warnings.json',
        JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), warnings }, null, 2),
        'warnings'
      );
    }

    const safeTimestamp = timestamp.replace(/[:.]/g, '-');
    const filename = options.studentId
      ? `${options.labId}-${options.studentId}-${safeTimestamp}.rb-lab.zip`
      : `${options.labId}-${safeTimestamp}.rb-lab.zip`;

    const blob = await zip.generateAsync({ type: 'blob' });
    const hash = await computeHash(blob);
    if (!hash) {
      pushWarning('hash', 'Hash computation failed; using unknown hash.');
    }

    return {
      filename,
      blob,
      hash: hash || 'unknown',
      timestamp,
    };
  } catch (error) {
    const timestamp = new Date().toISOString();
    const zip = new JSZip();
    const warningsPayload = {
      schemaVersion: 1,
      createdAt: timestamp,
      warnings: [
        {
          step: 'export',
          message: 'Export failed; generated recovery bundle instead.',
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
    zip.file('warnings.json', JSON.stringify(warningsPayload, null, 2));
    zip.file('README.txt', 'RedByte export failed. See warnings.json for details.');
    const blob = await zip.generateAsync({ type: 'blob' });
    const safeTimestamp = timestamp.replace(/[:.]/g, '-');
    return {
      filename: `recovery-${safeTimestamp}.rb-lab.zip`,
      blob,
      hash: 'unknown',
      timestamp,
    };
  }
}
