#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const IDE_APP_PATH = path.join(ROOT, 'packages/rb-apps/src/apps/IdeApp.tsx');
const EXPORT_SURFACE_PATH = path.join(
  ROOT,
  'packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx'
);

function fail(message) {
  console.error(`[ide-export-real-pipeline-contract] ${message}`);
  process.exit(1);
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`Unable to read ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const ideApp = readFile(IDE_APP_PATH);
const exportSurface = readFile(EXPORT_SURFACE_PATH);

if (/\bexportPreview\b/.test(ideApp)) {
  fail('IdeApp still contains export preview payload assembly (`exportPreview`).');
}

if (!/<ExportSurface\s+project=/.test(ideApp)) {
  fail('IdeApp must pass a project to ExportSurface (`<ExportSurface project={...} />`).');
}

if (!/buildExportViewModel/.test(exportSurface)) {
  fail('ExportSurface must build its UI from buildExportViewModel(project).');
}

if (/diagnostics\s*=/.test(exportSurface) || /artifacts\s*=/.test(exportSurface)) {
  fail('ExportSurface should not depend on preview diagnostics/artifacts props.');
}

console.log('[ide-export-real-pipeline-contract] PASS');
