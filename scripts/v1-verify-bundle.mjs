import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from '../packages/rb-apps/node_modules/jszip/lib/index.js';

const REQUIRED_SCHEMA_VERSION = 'rb_submission_manifest_v1';
const REQUIRED_BUNDLE_SCHEMA_VERSION = 'rb_submission_bundle_v1';
const REQUIRED_FILES = [
  'doctor-report.json',
  'logs/submission-log.json',
  'project.rbx.zip',
  'reproducibility.json',
  'submission-gates.json',
];

function isLegacyStudentManifest(manifest) {
  return (
    manifest?.schema_version === 'v1' &&
    typeof manifest?.lab_id === 'string' &&
    manifest.lab_id.trim().length > 0 &&
    typeof manifest?.student?.id === 'string' &&
    manifest.student.id.trim().length > 0 &&
    typeof manifest?.student?.name === 'string' &&
    manifest.student.name.trim().length > 0 &&
    typeof manifest?.proof?.capsule_path === 'string' &&
    manifest.proof.capsule_path.trim().length > 0 &&
    typeof manifest?.proof?.events_path === 'string' &&
    manifest.proof.events_path.trim().length > 0
  );
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function parseManifestText(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function hasHexDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export async function verifyBundleBytes(bytes) {
  const issues = [];

  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, issues: [`invalid zip: ${message}`] };
  }

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) {
    return { ok: false, issues: ['missing manifest.json'] };
  }

  const manifestText = await manifestEntry.async('string');
  const manifest = parseManifestText(manifestText);
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, issues: ['manifest.json is not valid JSON'] };
  }

  if (isLegacyStudentManifest(manifest)) {
    const legacyIssues = [];
    const capsulePath = manifest.proof.capsule_path;
    const eventsPath = manifest.proof.events_path;

    if (!zip.file(capsulePath)) {
      legacyIssues.push(`bundle missing legacy proof file: ${capsulePath}`);
    }
    if (!zip.file(eventsPath)) {
      legacyIssues.push(`bundle missing legacy proof file: ${eventsPath}`);
    }

    return {
      ok: legacyIssues.length === 0,
      issues: legacyIssues,
    };
  }

  if (manifest.schema_version !== REQUIRED_SCHEMA_VERSION) {
    issues.push(
      `manifest schema_version mismatch: expected ${REQUIRED_SCHEMA_VERSION}, got ${String(manifest.schema_version)}`
    );
  }

  if (manifest.bundleSchemaVersion !== REQUIRED_BUNDLE_SCHEMA_VERSION) {
    issues.push(
      `manifest bundleSchemaVersion mismatch: expected ${REQUIRED_BUNDLE_SCHEMA_VERSION}, got ${String(manifest.bundleSchemaVersion)}`
    );
  }

  const includedFiles = Array.isArray(manifest.includedFiles) ? manifest.includedFiles : null;
  if (!includedFiles || includedFiles.length === 0) {
    issues.push('manifest includedFiles must be a non-empty array');
  } else {
    for (const requiredFile of REQUIRED_FILES) {
      if (!includedFiles.some((entry) => entry?.path === requiredFile)) {
        issues.push(`required file missing from manifest includedFiles: ${requiredFile}`);
      }
    }

    for (const entry of includedFiles) {
      const entryPath = typeof entry?.path === 'string' ? entry.path : null;
      if (!entryPath) {
        issues.push('manifest includedFiles entry has invalid path');
        continue;
      }

      if (!hasHexDigest(entry.sha256)) {
        issues.push(`manifest includedFiles ${entryPath} has invalid sha256`);
        continue;
      }

      if (typeof entry.sizeBytes !== 'number' || !Number.isFinite(entry.sizeBytes) || entry.sizeBytes < 0) {
        issues.push(`manifest includedFiles ${entryPath} has invalid sizeBytes`);
      }

      const fileEntry = zip.file(entryPath);
      if (!fileEntry) {
        issues.push(`bundle missing file listed in manifest: ${entryPath}`);
        continue;
      }

      const fileBytes = await fileEntry.async('uint8array');
      const actualSha = sha256(fileBytes);
      if (actualSha !== entry.sha256.toLowerCase()) {
        issues.push(`sha256 mismatch for ${entryPath}`);
      }

      if (typeof entry.sizeBytes === 'number' && fileBytes.byteLength !== entry.sizeBytes) {
        issues.push(`size mismatch for ${entryPath}: expected ${entry.sizeBytes}, got ${fileBytes.byteLength}`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export async function verifyBundleFile(filePath) {
  const resolved = path.resolve(filePath);
  const bytes = await fs.readFile(resolved);
  const result = await verifyBundleBytes(bytes);
  return {
    ...result,
    filePath: resolved,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const bundlePath = args[0];

  if (!bundlePath) {
    console.error('Usage: pnpm v1:verify -- <path-to-submission-zip>');
    process.exit(2);
    return;
  }

  const result = await verifyBundleFile(bundlePath);
  if (result.ok) {
    console.log(`[v1:verify] PASS ${result.filePath}`);
    process.exit(0);
    return;
  }

  console.error(`[v1:verify] FAIL ${result.filePath}`);
  for (const issue of result.issues) {
    console.error(` - ${issue}`);
  }
  process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[v1:verify] ERROR ${message}`);
    process.exit(2);
  });
}
