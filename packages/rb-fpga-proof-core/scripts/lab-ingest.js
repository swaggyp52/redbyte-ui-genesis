#!/usr/bin/env node
/**
 * Lab Ingest Engine
 * 
 * Autonomous grading pipeline:
 * 1. Load submission (folder or ZIP)
 * 2. Validate manifest + capsule structure
 * 3. Verify hashes (strict/lenient)
 * 4. Optionally diff against golden proof
 * 5. Write grade.json + grade.md
 * 6. Print [FINAL] verdict
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';
import { Readable } from 'stream';
import unzipper from 'unzipper';
import {
  parseCapsule,
  loadEventsNdjson,
  verifyHashes,
  summarizeCapsule,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

/**
 * Exit codes (canonical FPGA semantics):
 * 0 = PASS/SUCCESS
 * 1 = FAIL/DIVERGED
 * 2 = INVALID/ERROR
 */
const EXIT_CODES = {
  PASS: 0,
  FAIL: 1,
  INVALID: 2,
};

/**
 * Load submission from either folder OR ZIP file
 */
async function loadSubmission(submissionPath) {
  const isZip = submissionPath.endsWith('.zip') || submissionPath.endsWith('.rb-lab.zip');

  if (isZip) {
    return loadSubmissionZip(submissionPath);
  } else {
    return loadSubmissionFolder(submissionPath);
  }
}

/**
 * Load submission from ZIP file
 */
async function loadSubmissionZip(zipPath) {
  let zipBuffer;
  try {
    zipBuffer = await fs.readFile(zipPath);
  } catch (e) {
    throw new Error(`Failed to read ZIP file: ${e.message}`);
  }

  const filesIndex = new Map();
  let manifestText = '';
  let capsuleJsonText = '';
  let eventsNdjsonText = '';

  // Extract files from ZIP
  await new Promise((resolve, reject) => {
    Readable.from(zipBuffer)
      .pipe(unzipper.Parse())
      .on('entry', (entry) => {
        const fileName = entry.path.replace(/\\/g, '/'); // Normalize to forward slashes
        const chunks = [];

        entry.on('data', (chunk) => {
          chunks.push(chunk);
        });

        entry.on('end', () => {
          const buffer = Buffer.concat(chunks);
          filesIndex.set(fileName, buffer);

          if (fileName === 'manifest.json') {
            manifestText = buffer.toString('utf8');
          } else if (fileName.startsWith('proofs/') && fileName.endsWith('capsule.json')) {
            capsuleJsonText = buffer.toString('utf8');
          } else if (fileName.startsWith('proofs/') && fileName.endsWith('events.ndjson')) {
            eventsNdjsonText = buffer.toString('utf8');
          }
        });

        entry.on('error', (err) => {
          reject(new Error(`Failed to read entry ${fileName}: ${err.message}`));
        });
      })
      .on('error', (err) => {
        reject(new Error(`ZIP parsing error: ${err.message}`));
      })
      .on('finish', () => {
        resolve();
      });
  });

  // Validate manifest
  if (!manifestText) {
    throw new Error('manifest.json not found in ZIP');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (e) {
    throw new Error(`Invalid manifest.json: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Validate manifest schema
  const manifestErrors = [];
  if (!manifest.schema_version) manifestErrors.push('Missing schema_version');
  if (manifest.schema_version !== 'v1') manifestErrors.push(`Unsupported schema_version: ${manifest.schema_version}`);
  if (!manifest.lab_id) manifestErrors.push('Missing lab_id');
  if (!manifest.student?.id) manifestErrors.push('Missing student.id');
  if (!manifest.student?.name) manifestErrors.push('Missing student.name');
  if (!manifest.created_at) manifestErrors.push('Missing created_at');
  if (!manifest.proof?.capsule_path) manifestErrors.push('Missing proof.capsule_path');

  if (manifestErrors.length > 0) {
    throw new Error(`Manifest validation failed: ${manifestErrors.join('; ')}`);
  }

  // Load capsule using path from manifest
  const capsulePath = manifest.proof.capsule_path;
  if (!filesIndex.has(capsulePath)) {
    throw new Error(`Capsule file not found at ${capsulePath}`);
  }
  capsuleJsonText = filesIndex.get(capsulePath).toString('utf8');

  // Load events using path from manifest (optional)
  if (manifest.proof.events_path && filesIndex.has(manifest.proof.events_path)) {
    eventsNdjsonText = filesIndex.get(manifest.proof.events_path).toString('utf8');
  }

  let capsule;
  try {
    capsule = JSON.parse(capsuleJsonText);
  } catch (e) {
    throw new Error(`Failed to parse capsule.json from ZIP: ${e.message}`);
  }

  return { manifest, capsule, eventsText: eventsNdjsonText };
}
async function loadSubmissionFolder(submissionPath) {
  const manifestPath = path.join(submissionPath, 'manifest.json');
  const capsulePath = path.join(submissionPath, 'proofs', 'capsule.json');
  const eventsPath = path.join(submissionPath, 'proofs', 'events.ndjson');

  // Load manifest
  let manifest;
  try {
    const manifestText = await fs.readFile(manifestPath, 'utf8');
    manifest = JSON.parse(manifestText);
  } catch (e) {
    throw new Error(`Failed to load manifest: ${e.message}`);
  }

  // Load capsule
  let capsule;
  try {
    const capsuleText = await fs.readFile(capsulePath, 'utf8');
    capsule = JSON.parse(capsuleText);
  } catch (e) {
    throw new Error(`Failed to load capsule: ${e.message}`);
  }

  // Load events (optional)
  let eventsText = '';
  try {
    if (await fileExists(eventsPath)) {
      eventsText = await fs.readFile(eventsPath, 'utf8');
    }
  } catch (e) {
    // Events file missing is OK
  }

  return { manifest, capsule, eventsText };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate manifest schema
 */
function validateManifest(manifest) {
  const errors = [];

  if (!manifest.schema_version) errors.push('Missing schema_version');
  if (!manifest.lab_id) errors.push('Missing lab_id');
  if (!manifest.student?.id) errors.push('Missing student.id');
  if (!manifest.student?.name) errors.push('Missing student.name');
  if (!manifest.created_at) errors.push('Missing created_at');
  if (!manifest.proof?.capsule_path) errors.push('Missing proof.capsule_path');

  return { valid: errors.length === 0, errors };
}

/**
 * Generate grade artifacts
 */
async function generateGradeArtifacts(runId, verdict, details, exitCode = EXIT_CODES.INVALID) {
  const runsDir = path.join(repoRoot, 'ops/labs/runs', runId);
  await fs.mkdir(runsDir, { recursive: true });

  // grade.json
  const gradeJson = {
    run_id: runId,
    timestamp: new Date().toISOString(),
    verdict,
    exit_code: exitCode,
    lab_id: details.lab_id || 'unknown',
    student_id: details.student_id || 'unknown',
    details,
  };
  const gradePath = path.join(runsDir, 'grade.json');
  await fs.writeFile(gradePath, JSON.stringify(gradeJson, null, 2), 'utf8');

  // grade.md
  const gradeMd = `# Grade Report

**Run ID:** ${runId}  
**Timestamp:** ${new Date().toISOString()}  
**Verdict:** \`${verdict}\`

## Summary

${details.summary || 'No summary available'}

## Details

${details.details || 'No details available'}

---

Generated by Lab Ingest Agent
`;
  const markdownPath = path.join(runsDir, 'grade.md');
  await fs.writeFile(markdownPath, gradeMd, 'utf8');

  return { gradeJson, gradePath, markdownPath };
}

  /**
   * Emit final verdict (both text and JSON for compatibility and machine parsing)
   */
  function emitFinal(verdict, runId, exitCode, labId, studentId, errorMsg = null) {
    const normalizedError = typeof errorMsg === 'string'
      ? errorMsg.replace(/\r?\n/g, '\\n')
      : errorMsg;

    const final = {
      task: 'lab-ingest',
      verdict,
      run_id: runId,
      exit_code: exitCode,
      lab_id: labId || 'unknown',
      student_id: studentId || 'unknown',
      error: normalizedError ?? null,
    };
  
    // Text format: backward compat + human-readable
    const sanitize = (s) => (typeof s === 'string' ? s.replace(/\s+/g, '_') : s);
    console.log(`[FINAL] task=${final.task} verdict=${final.verdict} run_id=${final.run_id} exit_code=${final.exit_code} lab_id=${sanitize(final.lab_id)} student_id=${sanitize(final.student_id)}`);
  
    // JSON format: authoritative machine-readable
    console.log(`[FINAL_JSON] ${JSON.stringify(final)}`);
  }
/**
 * Main pipeline
 */
async function main() {
  const options = {
    mode: { type: 'string', default: 'instructor-ingest' },
    submission: { type: 'string' },
    'strict-hash': { type: 'boolean', default: false },
    golden: { type: 'string' },
  };

  const { values: args } = parseArgs({ options, allowPositionals: true });

  try {
    // Validate args
    if (!args.submission) {
      console.error('[ERROR] --submission is required');
      process.exit(EXIT_CODES.INVALID);
    }

    // Generate run ID
    const runId = `run-${Date.now()}`;

    console.log(`[1/4] Loading submission...`);
    const { manifest, capsule, eventsText } = await loadSubmission(
      args.submission
    );

    console.log(`[2/4] Validating manifest...`);
    const manifestValidation = validateManifest(manifest);
    if (!manifestValidation.valid) {
      console.error('[ERROR] Manifest validation failed:');
      manifestValidation.errors.forEach((e) => console.error(`  - ${e}`));
      await generateGradeArtifacts(runId, 'INVALID', {
        summary: 'Manifest validation failed',
        details: manifestValidation.errors.join('\n'),
        lab_id: manifest?.lab_id || 'unknown',
        student_id: manifest?.student?.id || 'unknown',
      }, EXIT_CODES.INVALID);
      emitFinal('INVALID', runId, EXIT_CODES.INVALID, manifest?.lab_id || 'unknown', manifest?.student?.id || 'unknown', 'Manifest validation failed');
      process.exit(EXIT_CODES.INVALID);
    }

    console.log(`[3/4] Verifying capsule...`);
    // Use core library functions
    let summary;
    try {
      summary = summarizeCapsule(capsule);
    } catch (e) {
      throw new Error(`Failed to summarize capsule: ${e.message}`);
    }

    // Verify hashes if events present
    let hashResult = { ok: true, errors: [], exitCode: 0 };
    if (eventsText && eventsText.trim().length > 0) {
      try {
        hashResult = verifyHashes(capsule, eventsText, args['strict-hash']);
      } catch (e) {
        throw new Error(`Hash verification failed: ${e.message}`);
      }

      if (!hashResult.ok) {
        await generateGradeArtifacts(runId, 'INVALID', {
          summary: `Hash verification failed (${args['strict-hash'] ? 'strict' : 'lenient'} mode)`,
          details: hashResult.errors.join('\n'),
          lab_id: manifest.lab_id,
          student_id: manifest.student.id,
        }, args['strict-hash'] ? EXIT_CODES.INVALID : EXIT_CODES.FAIL);
        const verdict = args['strict-hash'] ? 'INVALID' : 'FAIL';
        const exitCode = args['strict-hash'] ? EXIT_CODES.INVALID : EXIT_CODES.FAIL;
        emitFinal(verdict, runId, exitCode, manifest.lab_id, manifest.student.id, 'Hash verification failed');
        process.exit(
          args['strict-hash'] ? EXIT_CODES.INVALID : EXIT_CODES.FAIL
        );
      }
    }

    const vectorCount = summary.total || 0;
    const passCount = summary.pass || 0;

    console.log(`[4/4] Generating grade...`);
    const verdict = passCount === vectorCount && vectorCount > 0 ? 'PASS' : 'FAIL';
    const exitCode = verdict === 'PASS' ? EXIT_CODES.PASS : EXIT_CODES.FAIL;
    const { gradePath, markdownPath } = await generateGradeArtifacts(
      runId,
      verdict,
      {
        summary: `${verdict === 'PASS' ? '✅' : '❌'} Proof ${verdict} for lab ${manifest.lab_id}`,
        details: `Student: ${manifest.student.name} (${manifest.student.id})\nCapsule: ${capsule.session_id}\nVectors: ${passCount}/${vectorCount} passed`,
        lab_id: manifest.lab_id,
        student_id: manifest.student.id,
      },
      exitCode
    );

    console.log(`\n✅ Grade artifacts written:`);
    console.log(`  - ${gradePath}`);
    console.log(`  - ${markdownPath}`);
    emitFinal(verdict, runId, exitCode, manifest.lab_id, manifest.student.id);

    process.exit(exitCode);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    emitFinal('INVALID', runId, EXIT_CODES.INVALID, 'unknown', 'unknown', err.message);
    process.exit(EXIT_CODES.INVALID);
  }
}

main();




