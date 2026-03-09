#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const ideCss = read(join(ROOT, 'packages/rb-apps/src/apps/ide/ide-root.css'));
const specDoc = read(join(ROOT, 'docs/ide/design-system-v1.md'));

assertContains(specDoc, 'Deterministic FPGA Design. Visual. Verifiable. Exportable.');
assertContains(specDoc, 'Spacing');
assertContains(specDoc, 'Typography');
assertContains(specDoc, 'Motion');
assertContains(specDoc, 'Public Launch Surface Contract');

for (const token of [
  '--rb-space-1',
  '--rb-space-8',
  '--rb-font-size-1',
  '--rb-font-size-6',
  '--rb-elevation-0',
  '--rb-elevation-2',
  '--rb-motion-fast',
  '--rb-motion-normal',
  '--rb-motion-slow',
  '--rb-ease-standard',
  '--rb-ease-emphasis',
]) {
  assertContains(ideCss, token);
}

console.log('PASS: IDE design system authority contract satisfied.');

function read(path) {
  return readFileSync(path, 'utf8');
}

function assertContains(content, needle) {
  if (!content.includes(needle)) {
    console.error(`FAIL: missing required contract token/text -> ${needle}`);
    process.exit(1);
  }
}
