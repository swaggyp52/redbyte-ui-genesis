#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const startPagePath = path.join(repoRoot, 'public', 'start.html');
const redirectsPath = path.join(repoRoot, 'public', '_redirects');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(filePath) {
  assert(fs.existsSync(filePath), `missing ${path.relative(repoRoot, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

const html = readText(startPagePath);
const redirects = readText(redirectsPath);
const normalized = html.replace(/\s+/g, ' ').trim();

const requiredSnippets = [
  'RedByte is a digital logic and FPGA workbench.',
  'Project',
  'Design',
  'Verify',
  'Map Pins',
  'Export',
  'E0',
  'E1',
  'E2',
  'E3',
  'pnpm rb:marcus:start',
  'Marcus is a separate local companion command center',
  'open the Marcus URL printed by the command',
  'pnpm dev',
  'AMD Vivado 2024.2',
  'A physical Basys3 board is required for E2 programming and E3 observation.',
  'RedByte is not a toy simulator and not a Vivado replacement.',
  'RedByte source and docs are the truth.',
];

for (const snippet of requiredSnippets) {
  assert(normalized.includes(snippet), `start page missing required snippet: ${snippet}`);
}

const forbiddenClaims = [
  'E3 complete',
  'E3 closed',
  'fully released',
  'replaces Vivado',
  'board behavior proven by programming',
  'switch to HQ in the IDE',
];

for (const claim of forbiddenClaims) {
  assert(!normalized.toLowerCase().includes(claim.toLowerCase()), `start page contains forbidden claim: ${claim}`);
}

assert(
  /^\s*\/\s+\/start\.html\s+302\s*$/m.test(redirects),
  'root redirect must send public visitors to /start.html'
);
assert(/^\s*\/os\s+\/os\/\s+302\s*$/m.test(redirects), '/os normalization redirect must remain');
assert(/href="\/os\/"/.test(html), 'start page must include Open IDE link to /os/');

console.log('[rb-public-start-page:test] ok');
