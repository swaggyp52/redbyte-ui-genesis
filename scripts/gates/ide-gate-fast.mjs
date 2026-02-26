#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const EXCLUDED_GATES = new Set([
  'ide:gate:screenshots',
  'ide:gate:screenshots:update',
  'ide:gate:fast',
]);

function loadIdeGates() {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const scripts = pkg?.scripts ?? {};
  return Object.keys(scripts)
    .filter((name) => name.startsWith('ide:gate:'))
    .filter((name) => !EXCLUDED_GATES.has(name))
    .sort((a, b) => a.localeCompare(b));
}

function runGate(scriptName) {
  const started = performance.now();
  const result = spawnSync('pnpm', ['-s', scriptName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      CI_FAST: process.env.CI_FAST ?? '1',
    },
  });
  const elapsedMs = Math.round(performance.now() - started);
  return {
    ok: (result.status ?? 1) === 0,
    elapsedMs,
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const listOnly = args.has('--list');
  const gates = loadIdeGates();
  if (gates.length === 0) {
    console.error('[ide:gate:fast] no IDE gates found');
    process.exit(1);
  }

  if (listOnly) {
    console.log('[ide:gate:fast] IDE gates (screenshots excluded):');
    for (const gate of gates) {
      console.log(`  - ${gate}`);
    }
    return;
  }

  const totalStarted = performance.now();
  const failed = [];

  console.log(`[ide:gate:fast] Running ${gates.length} IDE gates (screenshots excluded)\n`);
  for (const gate of gates) {
    console.log(`[ide:gate:fast] START ${gate}`);
    const result = runGate(gate);
    const status = result.ok ? 'PASS' : 'FAIL';
    console.log(`[ide:gate:fast] ${status} ${gate} (${result.elapsedMs}ms)\n`);
    if (!result.ok) {
      failed.push(gate);
    }
  }

  const elapsedMs = Math.round(performance.now() - totalStarted);
  console.log(`[ide:gate:fast] Completed in ${elapsedMs}ms`);

  if (failed.length > 0) {
    console.error('[ide:gate:fast] Failed gates:');
    for (const gate of failed) {
      console.error(`  - ${gate}`);
    }
    process.exit(1);
  }
}

main();
