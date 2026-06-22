#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDir = path.join(repoRoot, '.redbyte', 'rehearsal', 'phase-3i');
const faults = [
  'wrong-build',
  'error-boundary',
  'course-check-mutated',
  'stale-pass-trusted',
  'state-leak',
  'reload-failure',
];

mkdirSync(outputDir, { recursive: true });

const build = runPackageScript('build:unified', { timeout: 900_000 });
if (build.status !== 0) {
  console.error('[classroom-fault-injection] build:unified failed before fault injection');
  if (build.error) console.error(build.error.message);
  console.error((build.stdout ?? '').trim());
  console.error((build.stderr ?? '').trim());
  process.exit(build.status ?? 1);
}

const results = faults.map((fault) => runFault(fault));
const failed = results.filter((result) => !result.pass);
const summary = {
  schema: 'redbyte.phase3i.classroom-fault-injection.v1',
  generatedAtIso: new Date().toISOString(),
  head: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']),
  results,
};

writeFileSync(
  path.join(outputDir, 'classroom-fault-injection.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8'
);
writeFileSync(path.join(outputDir, 'classroom-fault-injection.md'), renderMarkdown(summary), 'utf8');

if (failed.length > 0) {
  console.error('[classroom-fault-injection] FAIL');
  for (const result of failed) {
    console.error(`- ${result.fault}: ${result.note}`);
  }
  process.exit(1);
}

console.log(`[classroom-fault-injection] PASS faults=${results.length}`);
console.log(`[classroom-fault-injection] evidence=${path.relative(repoRoot, path.join(outputDir, 'classroom-fault-injection.json'))}`);

function runFault(fault) {
  const command = process.execPath;
  const args = [
    'scripts/rehearsal/classroom-30-contexts.mjs',
    '--scenario=full',
    '--profiles=1',
    `--fault=${fault}`,
  ];
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 180_000,
    env: {
      ...process.env,
      RB_CLASSROOM_REHEARSAL_OUT_DIR: path.join(outputDir, 'faults', fault),
    },
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const expectedFailure = result.status !== 0 && output.includes(`fault:${fault}`);
  return {
    fault,
    pass: expectedFailure,
    exitCode: result.status,
    signal: result.signal,
    note: expectedFailure
      ? 'Fault was detected by the rehearsal harness.'
      : `Expected nonzero exit with fault marker; got exit=${result.status} signal=${result.signal ?? 'none'}`,
    excerpt: output.trim().split(/\r?\n/).slice(-10),
  };
}

function renderMarkdown(summary) {
  const rows = summary.results
    .map((result) => `| ${result.fault} | ${result.pass ? 'PASS' : 'FAIL'} | ${result.note} |`)
    .join('\n');
  return `# Phase 3I Classroom Rehearsal Fault Injection

- Branch: \`${summary.branch}\`
- Head: \`${summary.head}\`
- Generated: ${summary.generatedAtIso}
- Result: ${summary.results.every((result) => result.pass) ? 'PASS' : 'FAIL'}

| Fault | Harness result | Notes |
|---|---|---|
${rows}
`;
}

function git(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) return '';
  return result.stdout.trim();
}

function runPackageScript(scriptName, { timeout }) {
  if (process.platform === 'win32') {
    return spawnSync(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/s', '/c', `corepack pnpm -s ${scriptName}`],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout,
      }
    );
  }
  return spawnSync('corepack', ['pnpm', '-s', scriptName], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout,
  });
}
