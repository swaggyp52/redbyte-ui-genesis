import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The domain entry and the schematic scene subpath must stay React-free and stylesheet-free:
 * kernels, workers and the Meridian studio depend on that. This walks the static value-import
 * graph (type-only imports are erased and skipped) from each entry and fails on any impure
 * reachable module.
 *
 * Other @redbyte packages are leaves here (rb-logic-core, rb-utils, ...). Known gap, tracked for
 * P2: rb-utils' barrel re-exports React-bound zustand stores (settingsStore, uiTickStore), so
 * the domain is pure in its own graph but not yet in rb-utils' barrel.
 */
const ROOT = path.resolve(__dirname, '../../../..');
const ENTRIES = ['packages/rb-apps/src/domain.ts', 'packages/rb-logic-view/src/scene/index.ts'];
const FORBIDDEN_SPECIFIERS = [
  /^react($|\/)/,
  /^react-dom($|\/)/,
  /^zustand$/,
  /^zustand\/(react|middleware)/,
  /\.css$/,
  /^@redbyte\/rb-apps$/,
  /^@redbyte\/rb-logic-view$/,
  /^@redbyte\/(rb-primitives|rb-theme|rb-icons|rb-instruments|rb-viewport|rb-windowing)(\/|$)/,
];

function valueSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const statement = /^\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  for (const match of source.matchAll(statement)) {
    if (match[2]) continue; // import type / export type
    specifiers.push(match[4]);
  }
  for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) specifiers.push(match[1]);
  for (const match of source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specifiers.push(match[1]);
  return specifiers;
}

function resolveFile(base: string): string | null {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function resolveSpecifier(from: string, specifier: string): string | null | 'leaf' {
  if (specifier.startsWith('.')) return resolveFile(path.resolve(path.dirname(from), specifier));
  if (specifier === '@redbyte/rb-logic-view/scene') return path.join(ROOT, 'packages/rb-logic-view/src/scene/index.ts');
  const appsSubpath = /^@redbyte\/rb-apps\/(.+)$/.exec(specifier);
  if (appsSubpath) return resolveFile(path.join(ROOT, 'packages/rb-apps/src', appsSubpath[1]));
  return 'leaf';
}

function walk(entry: string) {
  const seen = new Set<string>();
  const violations: string[] = [];
  const queue = [path.join(ROOT, entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith('.tsx')) violations.push(`${path.relative(ROOT, file)} is a component module`);
    if (file.endsWith('.json')) continue;
    const source = readFileSync(file, 'utf8');
    for (const specifier of valueSpecifiers(source)) {
      if (FORBIDDEN_SPECIFIERS.some((rule) => rule.test(specifier))) {
        violations.push(`${path.relative(ROOT, file)} imports ${specifier}`);
        continue;
      }
      const resolved = resolveSpecifier(file, specifier);
      if (resolved === 'leaf') continue;
      if (!resolved) {
        if (specifier.endsWith('.json')) continue;
        violations.push(`${path.relative(ROOT, file)} imports unresolved ${specifier}`);
        continue;
      }
      queue.push(resolved);
    }
  }
  return { seen, violations };
}

describe('pure domain boundary', () => {
  for (const entry of ENTRIES) {
    it(`${entry} reaches no React, stylesheet or UI package`, () => {
      const { seen, violations } = walk(entry);
      expect(seen.size).toBeGreaterThan(1);
      expect(violations).toEqual([]);
    });
  }

  it('detects a forbidden import (the walker has teeth)', () => {
    expect(valueSpecifiers("import React from 'react';\nimport type { X } from 'zustand';\nexport { y } from './y.css';"))
      .toEqual(['react', './y.css']);
  });
});
