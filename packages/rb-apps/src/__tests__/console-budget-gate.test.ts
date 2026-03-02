// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

const BUDGET = 140;
const TARGET = 'packages/rb-apps/src';
const REPO_ROOT = path.resolve(__dirname, '../../../../');

describe('gates:console-budget', () => {
  it(`console.log/warn/error/group calls in rb-apps/src should be ≤ ${BUDGET}`, () => {
    const result = execSync(
      `grep -rn "console\\." "${TARGET}" --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" | wc -l`,
      { cwd: REPO_ROOT, encoding: 'utf8' }
    ).trim();
    const count = Number.parseInt(result, 10);
    expect(count).toBeLessThanOrEqual(BUDGET);
  });
});
