// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const BUDGET = 140;
const TARGET = 'packages/rb-apps/src';
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const CONSOLE_PATTERN = /console\./;

describe('gates:console-budget', () => {
  it(`console.log/warn/error/group calls in rb-apps/src should be <= ${BUDGET}`, () => {
    const count = countConsoleLines(path.join(REPO_ROOT, TARGET));
    expect(
      count,
      `Found ${count} source lines containing "console." in ${TARGET}`
    ).toBeLessThanOrEqual(BUDGET);
  });
});

function countConsoleLines(rootDir: string): number {
  let count = 0;
  for (const filePath of listTrackedSourceFiles(rootDir)) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      if (CONSOLE_PATTERN.test(line)) {
        count += 1;
      }
    }
  }
  return count;
}

function listTrackedSourceFiles(rootDir: string): string[] {
  const entries = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .sort((left, right) => compareText(left.name, right.name));
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      files.push(...listTrackedSourceFiles(path.join(rootDir, entry.name)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
    files.push(path.join(rootDir, entry.name));
  }

  return files;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
