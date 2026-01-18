// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Bundle export utility: generates .rb-lab.zip with all required files
// Schema: STUDENT_EXPORT_SCHEMA.md (IMMUTABLE v1)

import JSZip from 'jszip';

interface EventEntry {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface CapsuleVector {
  id: string;
  name: string;
  pass: boolean;
  error?: string;
}

interface HardwareSnapshot {
  timestamp: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  notes?: string;
  source: 'bridge' | 'manual';
}

interface HardwareEvidence {
  bridgeStatus: 'online' | 'offline';
  boardStatus: 'connected' | 'disconnected';
  boardModel?: string;
  snapshots: HardwareSnapshot[];
}

interface ExportOptions {
  labId: string;
  studentId: string;
  studentName: string;
  eventLog: EventEntry[];
  capsuleVectors: CapsuleVector[];
  selfCheckSummary: {
    pass: number;
    fail: number;
    total: number;
  };
  presetId?: string;
  presetName?: string;
  hardwareEvidence?: HardwareEvidence;
}

export interface ExportResult {
  filename: string;
  blob: Blob;
  hash?: string;
  timestamp: string;
}

/**
 * Compute SHA-256 hash of a blob
 */
async function computeHash(blob: Blob): Promise<string | undefined> {
  try {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn('Failed to compute hash:', e);
    return undefined;
  }
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
 * Export a valid .rb-lab.zip bundle with IMMUTABLE schema v1:
 * - manifest.json (with proof.capsule_path + proof.events_path pointers)
 * - proofs/capsule.json
 * - proofs/events.ndjson (always present; contains event log)
 *
 * Manifest contract (required fields):
 *   schema_version: 'v1'
 *   lab_id
 *   student.id
 *   student.name
 *   created_at
 *   proof.capsule_path
 *   proof.events_path
 *
 * @returns Promise with filename, blob, and hash
 */
export async function exportBundle(options: ExportOptions): Promise<ExportResult> {
  const { labId, studentId, studentName, eventLog, capsuleVectors, selfCheckSummary, presetId, presetName, hardwareEvidence } = options;
  const timestamp = new Date().toISOString();

  // Generate manifest matching ingest contract
  const manifest = {
    schema_version: 'v1',
    lab_id: labId,
    student: {
      id: studentId,
      name: studentName,
    },
    created_at: timestamp,
    proof: {
      capsule_path: 'proofs/capsule.json',
      events_path: 'proofs/events.ndjson',
    },
    ...(hardwareEvidence && {
      hardware: {
        evidence_path: 'proofs/hardware.json',
        bridge_status: hardwareEvidence.bridgeStatus,
        board_status: hardwareEvidence.boardStatus,
        snapshots_count: hardwareEvidence.snapshots.length,
      },
    }),
  };

  // Generate capsule with self-check results
  // Vectors are already in proof-core format (pass: boolean)
  const capsule = {
    session_id: `capsule-${Date.now()}`,
    lab_id: labId,
    student_id: studentId,
    timestamp,
    vectors: capsuleVectors,
    summary: selfCheckSummary,
    ...(presetId && { preset_id: presetId }),
    ...(presetName && { preset_name: presetName }),
  };

  // Convert event log to NDJSON (one JSON object per line)
  const eventsNdjson = eventLog
    .map((event) => JSON.stringify(event))
    .join('\n');

  // Create ZIP
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('proofs/capsule.json', JSON.stringify(capsule, null, 2));
  zip.file('proofs/events.ndjson', eventsNdjson);
  
  // Include hardware evidence if present
  if (hardwareEvidence && hardwareEvidence.snapshots.length > 0) {
    const hardwareData = {
      bridge_status: hardwareEvidence.bridgeStatus,
      board_status: hardwareEvidence.boardStatus,
      board_model: hardwareEvidence.boardModel,
      snapshots: hardwareEvidence.snapshots,
      captured_at: timestamp,
    };
    zip.file('proofs/hardware.json', JSON.stringify(hardwareData, null, 2));
  }

  // Generate filename
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  const filename = `${labId}-${studentId}-${safeTimestamp}.rb-lab.zip`;

  // Generate blob
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Compute hash
  const hash = await computeHash(blob);

  // Trigger download
  downloadBlob(blob, filename);

  return {
    filename,
    blob,
    hash,
    timestamp,
  };
}
