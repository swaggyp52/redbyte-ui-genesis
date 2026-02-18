#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const WRAPPER_CONTRACT = new Map([
  ['apps/playground/src/boot/full-bootstrap.js', 'export * from "./full-bootstrap.ts";'],
  ['apps/playground/src/boot/audit-guards.js', 'export * from "./audit-guards.ts";'],
  ['apps/playground/src/boot/bisect-steps.js', 'export * from "./bisect-steps.ts";'],
  ['apps/playground/src/boot/boot-bisect-entry.js', 'export * from "./boot-bisect-entry.tsx";'],
]);

function normalizeContent(text) {
  return text.replace(/\r\n/g, '\n').trim();
}

function main() {
  const repoRoot = process.cwd();
  const failures = [];

  for (const [relativePath, expectedContent] of WRAPPER_CONTRACT.entries()) {
    const filePath = path.join(repoRoot, relativePath);

    if (!fs.existsSync(filePath)) {
      failures.push(`${relativePath}: missing file`);
      continue;
    }

    const actualContent = normalizeContent(fs.readFileSync(filePath, 'utf8'));
    if (actualContent !== expectedContent) {
      failures.push(
        `${relativePath}: wrapper is not allowlisted.\n  expected: ${expectedContent}\n  actual:   ${actualContent}`
      );
    }
  }

  if (failures.length > 0) {
    console.error('FAIL: IDE boot shadow contract violated.');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('PASS: IDE boot shadow contract satisfied.');
}

main();
