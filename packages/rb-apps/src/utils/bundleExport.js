// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
import JSZip from 'jszip';
import { buildCapsule, normalizeCapsulePath } from '@redbyte/rb-fpga-signing';
/**
 * Hash computation for integrity
 */
async function computeHash(input) {
    try {
        let buffer;
        if (input instanceof Blob) {
            if (typeof input.arrayBuffer === 'function') {
                buffer = await input.arrayBuffer();
            }
            else if (input.buffer instanceof ArrayBuffer) {
                buffer = input.buffer;
            }
            else if (input._buffer) {
                const raw = input._buffer;
                if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
                    buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
                }
                else if (raw instanceof ArrayBuffer) {
                    buffer = raw;
                }
                else {
                    buffer = new Uint8Array(0).buffer;
                }
            }
            else if (typeof input.text === 'function') {
                const text = await input.text();
                buffer = new TextEncoder().encode(text).buffer;
            }
            else if (typeof Response !== 'undefined') {
                buffer = await new Response(input).arrayBuffer();
            }
            else {
                buffer = new Uint8Array(0).buffer;
            }
        }
        else {
            buffer = input.buffer;
        }
        const bufferSource = (buffer instanceof ArrayBuffer || ArrayBuffer.isView(buffer))
            ? buffer
            : new Uint8Array(0);
        // @ts-ignore
        const hashBuffer = await crypto.subtle.digest('SHA-256', bufferSource);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    catch (e) {
        const shouldLog = typeof process === 'undefined' || process.env?.NODE_ENV !== 'test';
        if (shouldLog) {
            console.warn('Failed to compute hash:', e);
        }
        return undefined;
    }
}
function countNdjsonEvents(ndjson) {
    return ndjson
        .split('\n')
        .filter((line) => line.trim())
        .length;
}
async function toUint8Array(input) {
    if (typeof input === 'string') {
        const encoded = new TextEncoder().encode(input);
        return new Uint8Array(encoded);
    }
    if (input instanceof Uint8Array) {
        return new Uint8Array(input);
    }
    let buffer;
    if (typeof input.arrayBuffer === 'function') {
        buffer = await input.arrayBuffer();
    }
    else if (input.buffer instanceof ArrayBuffer) {
        buffer = input.buffer;
    }
    else if (input._buffer) {
        const raw = input._buffer;
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
            buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        }
        else if (raw instanceof ArrayBuffer) {
            buffer = raw;
        }
        else {
            buffer = new Uint8Array(0).buffer;
        }
    }
    else if (typeof input.text === 'function') {
        const text = await input.text();
        buffer = new TextEncoder().encode(text).buffer;
    }
    else if (typeof Response !== 'undefined') {
        buffer = await new Response(input).arrayBuffer();
    }
    else {
        buffer = new Uint8Array(0).buffer;
    }
    return new Uint8Array(buffer);
}
/**
 * Trigger download of a blob
 */
export function downloadBlob(blob, filename) {
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
export async function exportV2Bundle(options) {
    const timestamp = new Date().toISOString();
    // @ts-ignore - Handle Vite env if present, otherwise default
    const redbyteVersion = options.redbyteVersion ||
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION) ||
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
    const boardProfile = options.boardProfile ?? {
        board,
        uart_baud: 115200,
        digital_signals: { "0": "SW0", "1": "SW1", "2": "BTN0" },
        analog_signals: { "0": "ComparatorOut", "1": "LDR_Level" },
    };
    const zip = new JSZip();
    const capsuleFiles = [];
    const addFile = async (path, data) => {
        const normalizedPath = normalizeCapsulePath(path);
        const bytes = await toUint8Array(data);
        zip.file(normalizedPath, bytes);
        capsuleFiles.push({ path: normalizedPath, bytes });
    };
    await addFile('manifest.json', JSON.stringify(manifest, null, 2));
    await addFile('trace/hw_trace.ndjson', traceNdjson);
    await addFile('meta/board_profile.json', JSON.stringify(boardProfile, null, 2));
    if (options.bitstreamBytes) {
        await addFile('bitstream/design.bit', options.bitstreamBytes);
    }
    if (options.hardwareSnapshots) {
        await addFile('proofs/snapshots.json', JSON.stringify(options.hardwareSnapshots, null, 2));
    }
    if (options.eventLog) {
        const ndjson = options.eventLog.map(e => JSON.stringify(e)).join('\n');
        await addFile('proofs/events.ndjson', ndjson);
    }
    const { capsuleJsonUtf8 } = await buildCapsule(capsuleFiles);
    zip.file('integrity/capsule.json', new Uint8Array(capsuleJsonUtf8));
    const safeTimestamp = timestamp.replace(/[:.]/g, '-');
    const filename = options.studentId
        ? `${options.labId}-${options.studentId}-${safeTimestamp}.rb-lab.zip`
        : `${options.labId}-${safeTimestamp}.rb-lab.zip`;
    const blob = await zip.generateAsync({ type: 'blob' });
    const hash = await computeHash(blob) || 'unknown';
    return {
        filename,
        blob,
        hash,
        timestamp,
    };
}
