#!/usr/bin/env node
// Generate a student export ZIP identical to what LogicLabApp produces
// Usage: node scripts/generate-student-export.js [--pass|--fail] [output-path]

import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import archiver from 'archiver';

const args = process.argv.slice(2);
const isPass = args.includes('--pass');
const isFail = args.includes('--fail') || !isPass; // default to fail for safety
const outputArg = args.find(a => !a.startsWith('--'));

const timestamp = new Date().toISOString();
const safeTimestamp = timestamp.replace(/[:.]/g, '-');
const studentId = 'student-test-001';
const studentName = 'Test Student';
const labId = 'traffic-light';
const attemptId = `attempt-${Date.now()}`;

// Determine output path
const defaultFilename = `${labId}-${studentId}-${safeTimestamp}.rb-lab.zip`;
const outputPath = outputArg
  ? resolve(outputArg)
  : resolve(`packages/ops/labs/fixtures/student-export-${isPass ? 'pass' : 'fail'}.rb-lab.zip`);

// Self-check results (mock - same as what the app produces)
// For PASS: all vectors pass. For FAIL: some fail.
const selfCheckResults = isPass
  ? [
      { id: 'sv-1', name: 'Reset state', pass: true },
      { id: 'sv-2', name: 'First cycle', pass: true },
      { id: 'sv-3', name: 'Second cycle', pass: true },
    ]
  : [
      { id: 'sv-1', name: 'Reset state', pass: true },
      { id: 'sv-2', name: 'First cycle', pass: true },
      {
        id: 'sv-3',
        name: 'Second cycle',
        pass: false,
        error: 'First mismatch at tick 42, signal CLK',
      },
    ];

const passCount = selfCheckResults.filter(r => r.pass).length;
const failCount = selfCheckResults.filter(r => !r.pass).length;
const totalCount = selfCheckResults.length;

// Event log (exactly what the app emits)
const eventLog = [
  {
    type: 'attempt_started',
    timestamp: new Date(Date.now() - 60000).toISOString(), // 1 min ago
    data: {
      lab_id: labId,
      attempt_id: attemptId,
      student_id: studentId,
    },
  },
  {
    type: 'self_check_ran',
    timestamp: new Date(Date.now() - 30000).toISOString(), // 30 sec ago
    data: {
      passCount,
      totalCount,
      lab_id: labId,
      preset_id: isPass ? 'correct' : 'almost',
      preset_name: isPass ? 'Correct Implementation' : 'Almost Correct',
    },
  },
  {
    type: 'attempt_submitted',
    timestamp,
    data: {
      lab_id: labId,
      attempt_id: attemptId,
      self_check_summary: {
        passCount,
        totalCount,
      },
    },
  },
];

// Manifest (exactly matches STUDENT_EXPORT_SCHEMA.md)
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
};

// Capsule (vectors are already in proof-core format: pass boolean)
const capsule = {
  session_id: `capsule-${Date.now()}`,
  lab_id: labId,
  student_id: studentId,
  timestamp,
  vectors: selfCheckResults,
  summary: {
    pass: passCount,
    fail: failCount,
    total: totalCount,
  },
  preset_id: isPass ? 'correct' : 'almost',
  preset_name: isPass ? 'Correct Implementation' : 'Almost Correct',
};

// Events NDJSON
const eventsNdjson = eventLog.map(e => JSON.stringify(e)).join('\n');

// Create ZIP
async function createZip() {
  await mkdir(dirname(outputPath), { recursive: true });

  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`Created: ${outputPath}`);
      console.log(`Size: ${archive.pointer()} bytes`);
      console.log(`Type: ${isPass ? 'PASS' : 'FAIL'} fixture`);
      console.log(`Vectors: ${passCount}/${totalCount} passed`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add files exactly as bundleExport does
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(JSON.stringify(capsule, null, 2), { name: 'proofs/capsule.json' });
    archive.append(eventsNdjson, { name: 'proofs/events.ndjson' });

    archive.finalize();
  });
}

createZip().catch(err => {
  console.error('Failed to create ZIP:', err);
  process.exit(1);
});
