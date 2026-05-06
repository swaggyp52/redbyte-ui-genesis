#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  generatePatchProposal,
  isAllowedCodePath,
  readCodeFile,
  readPatchProposal,
  savePatchProposal,
  searchCode,
} from './marcus-code-intelligence.mjs';

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

function withTempRepo(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marcus-code-intel-'));
  try {
    fs.mkdirSync(path.join(dir, 'packages', 'rb-apps', 'src'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(dir, '.redbyte', 'agent'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'packages', 'rb-apps', 'src', 'ExportSurface.tsx'), 'export function ExportSurface() { return "Vivado ExportSurface"; }\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'scripts', 'safe.mjs'), 'console.log("ExportSurface");\n', 'utf8');
    fs.writeFileSync(path.join(dir, '.env'), 'SECRET=value\n', 'utf8');
    fs.writeFileSync(path.join(dir, '.redbyte', 'agent', 'config.json'), '{"private":true}\n', 'utf8');
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('safe path policy allows repo code and denies private paths', () => {
  assert.equal(isAllowedCodePath('packages/rb-apps/src/ExportSurface.tsx'), true);
  assert.equal(isAllowedCodePath('scripts/rb-hq-server.mjs'), true);
  assert.equal(isAllowedCodePath('docs/product/doc.md'), true);
  assert.equal(isAllowedCodePath('.env'), false);
  assert.equal(isAllowedCodePath('.redbyte/agent/config.json'), false);
  assert.equal(isAllowedCodePath('node_modules/pkg/index.js'), false);
  assert.equal(isAllowedCodePath('.git/config'), false);
});

test('readCodeFile returns bounded content and blocks traversal/private paths', () => {
  withTempRepo((repoRoot) => {
    const read = readCodeFile(repoRoot, 'packages/rb-apps/src/ExportSurface.tsx', { maxChars: 20 });
    assert.equal(read.truncated, true);
    assert.equal(read.content.length, 20);
    assert.throws(() => readCodeFile(repoRoot, '../outside.ts'), /not allowed|escapes/);
    assert.throws(() => readCodeFile(repoRoot, '.env'), /not allowed/);
    assert.throws(() => readCodeFile(repoRoot, '.redbyte/agent/config.json'), /not allowed/);
  });
});

test('binary and large files are rejected', () => {
  withTempRepo((repoRoot) => {
    fs.writeFileSync(path.join(repoRoot, 'scripts', 'binary.js'), Buffer.from([0, 1, 2, 3, 4]));
    fs.writeFileSync(path.join(repoRoot, 'scripts', 'large.mjs'), 'x'.repeat(5000));
    assert.throws(() => readCodeFile(repoRoot, 'scripts/binary.js'), /Binary-like/);
    assert.throws(() => readCodeFile(repoRoot, 'scripts/large.mjs', { maxFileBytes: 1000 }), /exceeds read limit/);
  });
});

test('searchCode returns safe snippets', () => {
  withTempRepo((repoRoot) => {
    const result = searchCode(repoRoot, 'ExportSurface');
    assert.equal(result.mode, 'safe-keyword');
    assert.ok(result.results.some((entry) => entry.path.endsWith('ExportSurface.tsx')));
    assert.ok(result.results.every((entry) => !entry.path.includes('.env')));
  });
});

test('proposal save/read stays under allowed generated dir', () => {
  withTempRepo((repoRoot) => {
    const outputDir = path.join(repoRoot, '.redbyte', 'agent', 'runs', 'hq', 'patch-proposals');
    const proposal = savePatchProposal(repoRoot, {
      id: 'patch-proposal-test',
      createdAt: new Date().toISOString(),
      sourceTaskId: null,
      sourcePacketId: null,
      title: 'Test proposal',
      productProblem: 'Export diagnostics',
      targetFiles: ['packages/rb-apps/src/ExportSurface.tsx'],
      codeFindings: [],
      proposedChanges: [],
      patchSketch: 'Proposal only.',
      risks: [],
      doNotTouch: [],
      tests: [],
      validationCommands: [],
      evidenceSources: [],
      generatedFiles: [],
      requiresApproval: true,
      applyStatus: 'proposal_only',
      codexPrompt: 'Implement after approval.',
    }, outputDir);
    assert.equal(proposal.requiresApproval, true);
    assert.equal(proposal.applyStatus, 'proposal_only');
    assert.ok(proposal.generatedFiles.every((file) => file.startsWith('.redbyte/agent/runs/hq/patch-proposals/')));
    const read = readPatchProposal(repoRoot, proposal.id, outputDir);
    assert.equal(read.id, proposal.id);
    assert.throws(() => readPatchProposal(repoRoot, '../escape', outputDir), /Invalid proposal id|traversal/);
  });
});

test('generatePatchProposal creates proposal-only artifact without modifying repo code', () => {
  withTempRepo((repoRoot) => {
    const sourceFile = path.join(repoRoot, 'packages', 'rb-apps', 'src', 'ExportSurface.tsx');
    const before = fs.readFileSync(sourceFile, 'utf8');
    const proposal = generatePatchProposal(repoRoot, {
      rawRequest: 'Improve Export diagnostics',
      likelyFiles: ['packages/rb-apps/src/ExportSurface.tsx'],
    });
    const after = fs.readFileSync(sourceFile, 'utf8');
    assert.equal(after, before);
    assert.equal(proposal.requiresApproval, true);
    assert.equal(proposal.applyStatus, 'proposal_only');
    assert.ok(proposal.targetFiles.includes('packages/rb-apps/src/ExportSurface.tsx'));
    assert.ok(proposal.generatedFiles.length === 2);
  });
});

