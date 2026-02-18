#!/usr/bin/env node

/**
 * verify-dist-manifest.mjs
 *
 * Verifies the dist/ artifact has all required files for deployment.
 * This is the "I can't accidentally ship garbage" gate.
 *
 * Called by: merge-dist.mjs (end of Phase 3)
 * Fails hard: exit 1 if any required file missing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

// Required files
const REQUIRED_FILES = [
  'index.html',
  'build.json',
  '_redirects',
  '_headers',
  'os/index.html',
  'os/version.json',
];

// Required directories with at least one file
const REQUIRED_DIRS = [
  'assets',
  'os/assets',
];

console.log('🔍 Verifying dist/ manifest...\n');

const errors = [];
const warnings = [];

// Check required files
for (const file of REQUIRED_FILES) {
  const fullPath = path.join(DIST, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required file: ${file}`);
  } else {
    console.log(`✓ ${file}`);
  }
}

// Check required directories have content
for (const dir of REQUIRED_DIRS) {
  const fullPath = path.join(DIST, dir);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required directory: ${dir}`);
  } else {
    const files = fs.readdirSync(fullPath);
    if (files.length === 0) {
      errors.push(`Directory ${dir} is empty`);
    } else {
      console.log(`✓ ${dir}/ (${files.length} files)`);
    }
  }
}

// Check markers
const rootIndex = path.join(DIST, 'index.html');
const osIndex = path.join(DIST, 'os', 'index.html');

if (fs.existsSync(rootIndex)) {
  const content = fs.readFileSync(rootIndex, 'utf8');
  if (!content.includes('REDBYTE_MARKETING_ROOT')) {
    errors.push('Root index.html missing REDBYTE_MARKETING_ROOT marker');
  } else {
    console.log('✓ Root marker (REDBYTE_MARKETING_ROOT)');
  }
}

if (fs.existsSync(osIndex)) {
  const content = fs.readFileSync(osIndex, 'utf8');
  if (!content.includes('REDBYTE_OS_IDE')) {
    errors.push('/os/index.html missing REDBYTE_OS_IDE marker');
  } else {
    console.log('✓ OS marker (REDBYTE_OS_IDE)');
  }
}

console.log();

if (errors.length > 0) {
  console.error('❌ Dist manifest verification FAILED:\n');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  Warnings:\n');
  for (const warning of warnings) {
    console.warn(`  - ${warning}`);
  }
}

console.log('✅ Dist manifest verified. Safe to deploy.\n');
process.exit(0);
