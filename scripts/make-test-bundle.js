#!/usr/bin/env node
/**
 * Create a test submission bundle (.rb-lab.zip) from the test-submission folder
 * Dev-only tool for validating ZIP parsing pipeline
 */

import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

async function createTestBundle() {
  const sourceDir = path.join(repoRoot, 'test-submission');
  const outputFile = path.join(repoRoot, 'test-submission.rb-lab.zip');

  console.log(`Creating test bundle from: ${sourceDir}`);
  console.log(`Output: ${outputFile}`);

  // Verify source exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`ERROR: test-submission folder not found at ${sourceDir}`);
    process.exit(1);
  }

  // Create ZIP archive
  const output = fs.createWriteStream(outputFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      const sizeKb = Math.round(archive.pointer() / 1024);
      console.log(`✅ Bundle created: ${outputFile} (${sizeKb} KB)`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error(`Archiver error: ${err.message}`);
      reject(err);
    });

    output.on('error', (err) => {
      console.error(`Output error: ${err.message}`);
      reject(err);
    });

    // Add all files from test-submission folder to ZIP
    archive.directory(sourceDir, false); // false = don't add parent folder name

    archive.pipe(output);
    archive.finalize();
  });
}

createTestBundle().catch((err) => {
  console.error(err);
  process.exit(1);
});
