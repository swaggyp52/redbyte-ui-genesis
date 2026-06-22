#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sourceRoot = path.join(repoRoot, 'packages', 'rb-apps', 'src');

const APPROVED_DIRECT_STORAGE_FILES = new Map([
  ['apps/ide/projectStorageFacade.ts', {
    reason: 'canonical project storage facade',
    projectCompatibility: true,
  }],
  ['apps/ide/chromeToggles.ts', { reason: 'student chrome preference' }],
  ['apps/ide/components/IdeWorkbenchShell.tsx', { reason: 'workbench layout preference' }],
  ['apps/ide/components/OnboardingOverlay.tsx', { reason: 'onboarding dismissed preference' }],
  ['apps/ide/surfaces/HardwareSurface.tsx', { reason: 'hardware tip dismissal preference' }],
  ['apps/ide/surfaces/VerifySurface.tsx', { reason: 'session-only Verify notice dismissal preference' }],
  ['components/ErrorBoundary.tsx', {
    reason: 'explicit user reset-workspace action',
    projectCompatibility: true,
  }],
  ['export/ideSubmissionBundle.ts', { reason: 'submission id continuity metadata' }],
  ['export/submissionBundleWorkflow.ts', { reason: 'submission workflow local checkpoint metadata' }],
  ['labs/labStore.ts', { reason: 'lab progress metadata outside IDE project authority' }],
  ['services/hardwareClient.ts', { reason: 'hardware mode preference' }],
  ['services/projectPersistence.ts', {
    reason: 'deprecated compatibility-only project autosave path; not imported by current IdeApp',
    projectCompatibility: true,
    removalTicket: 'Phase 4 storage cleanup: retire package-root projectPersistence export after consumers are audited.',
  }],
  ['starterKits/instructorPack.ts', { reason: 'instructor starter-pack cache' }],
  ['stores/chipStore.ts', { reason: 'chip editor compatibility store' }],
  ['stores/classroomModeStore.ts', { reason: 'classroom safe-mode preference' }],
  ['stores/fileAssociationsStore.ts', { reason: 'file association preference' }],
  ['stores/filesStore.ts', { reason: 'file catalog compatibility store' }],
  ['stores/fileSystemStore.ts', { reason: 'virtual file-system compatibility store' }],
  ['stores/layoutStore.ts', { reason: 'layout preference store' }],
  ['stores/systemLogStore.ts', { reason: 'system log read-state metadata' }],
  ['utils/ceAutosave.ts', {
    reason: 'legacy CE autosave cleanup compatibility path',
    projectCompatibility: true,
    removalTicket: 'Phase 4 storage cleanup: replace CE autosave compatibility once legacy CE paths are retired.',
  }],
  ['utils/rbprojAutosave.ts', {
    reason: 'package-root RBProject autosave compatibility path, separate from current IdeApp runtime facade',
    projectCompatibility: true,
    removalTicket: 'Phase 4 storage cleanup: move remaining RBProject autosave/recent-project metadata behind facade helpers or retire package-root consumers.',
  }],
  ['utils/snapshotSystem.ts', {
    reason: 'workspace crash metadata; current payload stores only layout/flags/projectRef, not project bytes',
    projectCompatibility: true,
  }],
  ['utils/uiMode.ts', { reason: 'UI/classroom mode preference' }],
]);

const DIRECT_STORAGE_WRITE = /\b(?:window\.)?(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|removeItem)\s*\(/g;
const PROJECT_STORAGE_KEY_SIGNAL =
  /\b(?:rb\.ide\.project|rb\.ide\.projects|rb\.ide\.sessionMeta|rb-autosave-circuit|rb-project-autosave|rb:autosave|rb:rbproj_autosave|rb_workspace_|project-runtime|projectAutosave|PROJECT_RUNTIME_STORAGE_KEY|PROJECT_INDEX_STORAGE_KEY|SESSION_META_STORAGE_KEY|LEGACY_PROJECT_AUTOSAVE_KEY|LEGACY_DOC_AUTOSAVE_KEY|AUTOSAVE_KEY)\b/i;

if (!existsSync(sourceRoot)) {
  console.error(`[gate:project-storage-authority] source root missing: ${path.relative(repoRoot, sourceRoot)}`);
  process.exit(1);
}

const findings = [];
const approvedCompatibility = new Map();

for (const filePath of listSourceFiles(sourceRoot)) {
  const relativePath = path.relative(sourceRoot, filePath).replace(/\\/g, '/');
  if (isTestOrFixture(relativePath)) continue;

  const text = readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const executableLine = stripQuotedText(line);
    if (!DIRECT_STORAGE_WRITE.test(executableLine)) {
      DIRECT_STORAGE_WRITE.lastIndex = 0;
      continue;
    }
    DIRECT_STORAGE_WRITE.lastIndex = 0;

    const approval = APPROVED_DIRECT_STORAGE_FILES.get(relativePath);
    const hasProjectSignal = PROJECT_STORAGE_KEY_SIGNAL.test(line) || PROJECT_STORAGE_KEY_SIGNAL.test(text.slice(0, Math.min(text.length, 4000)));

    if (!approval) {
      findings.push({
        relativePath,
        line: index + 1,
        reason: 'direct browser storage write is not allowlisted',
        source: line.trim(),
      });
      continue;
    }

    if (hasProjectSignal && !approval.projectCompatibility) {
      findings.push({
        relativePath,
        line: index + 1,
        reason: 'project-affecting storage key signal in a non-project allowlist entry',
        source: line.trim(),
      });
      continue;
    }

    if (approval.projectCompatibility && relativePath !== 'apps/ide/projectStorageFacade.ts') {
      approvedCompatibility.set(relativePath, {
        reason: approval.reason,
        removalTicket: approval.removalTicket ?? null,
      });
    }
  }
}

for (const relativePath of APPROVED_DIRECT_STORAGE_FILES.keys()) {
  if (!existsSync(path.join(sourceRoot, relativePath))) {
    findings.push({
      relativePath,
      line: 0,
      reason: 'allowlisted direct-storage file no longer exists; remove it from the gate allowlist',
      source: '',
    });
  }
}

if (findings.length > 0) {
  console.error('[gate:project-storage-authority] FAIL direct project storage authority violations found.');
  for (const finding of findings) {
    const where = finding.line > 0 ? `${finding.relativePath}:${finding.line}` : finding.relativePath;
    console.error(`- ${where}: ${finding.reason}`);
    if (finding.source) console.error(`  ${finding.source}`);
  }
  process.exit(1);
}

console.log(
  `[gate:project-storage-authority] PASS approvedDirectStorageFiles=${APPROVED_DIRECT_STORAGE_FILES.size} compatibilityProjectFiles=${approvedCompatibility.size}`
);
for (const [relativePath, entry] of approvedCompatibility) {
  if (!entry.removalTicket) continue;
  console.log(`[gate:project-storage-authority] compatibility ${relativePath}: ${entry.removalTicket}`);
}

function listSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') continue;
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (!/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files.sort();
}

function isTestOrFixture(relativePath) {
  return (
    relativePath.includes('/__tests__/') ||
    /\.test\.[tj]sx?$/.test(relativePath) ||
    /\.spec\.[tj]sx?$/.test(relativePath)
  );
}

function stripQuotedText(line) {
  return line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
}
