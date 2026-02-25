/**
 * tools/vivado/export-example.ts
 *
 * Export a single RedByte shipped example to Verilog + XDC for Vivado smoke testing.
 * Mirrors the exampleToIoMapping logic from golden-examples.test.ts exactly.
 *
 * Usage:
 *   pnpm exec tsx tools/vivado/export-example.ts <example-id> <outdir>
 *
 * Writes:
 *   <outdir>/top.v            Verilog source
 *   <outdir>/constraints.xdc  Pin constraints
 *   <outdir>/manifest.json    Metadata + SHA-256 of each file
 *
 * Exit codes:
 *   0  OK
 *   1  Missing / wrong arguments
 *   2  Unknown example ID
 *   3  bundle.valid === false (export pipeline validation failed)
 */

import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

// Relative imports from workspace source — not routed through package public API.
// tsx is run from repo root, so ../../ == repo root.
import { getIdeExampleById } from '../../packages/rb-apps/src/apps/ide/examplesCatalog';
import { exportBasys3Bundle } from '../../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';
import type { Circuit } from '@redbyte/rb-logic-core';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Basys3 Rev B / Master XDC part string */
const PART = 'xc7a35tcpg236-1';

/** Top module name used by the Verilog generator default */
const TOP = 'top';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fail(msg: string, code: number): never {
  process.stderr.write(`REDBYTE_FAIL: ${msg}\n`);
  process.exit(code);
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// ── Main ──────────────────────────────────────────────────────────────────────

const [, , exampleId, outdir] = process.argv;

if (!exampleId || !outdir) {
  fail('Usage: export-example.ts <example-id> <outdir>', 1);
}

const example = getIdeExampleById(exampleId);
if (!example) {
  fail(`Unknown example: "${exampleId}". Available IDs can be found in examplesCatalog.ts`, 2);
}

// Build IoMapping — mirrors exampleToIoMapping in golden-examples.test.ts exactly.
// IoMapping uses { id, nodeId, port, label, pin } (not portName).
const ioMapping = {
  inputs: example.ioRows
    .filter((r) => r.direction === 'in')
    .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
  outputs: example.ioRows
    .filter((r) => r.direction === 'out')
    .map((r) => ({ id: r.id, nodeId: r.nodeId, port: r.port, label: r.label, pin: r.pin })),
};

const bundle = exportBasys3Bundle(example.circuit as Circuit, ioMapping as any);

if (!bundle.valid) {
  fail(
    `bundle.valid=false for "${exampleId}":\n${JSON.stringify(bundle.warnings, null, 2)}`,
    3,
  );
}

// ── Write outputs ─────────────────────────────────────────────────────────────

const absOutdir = path.resolve(outdir);
fs.mkdirSync(absOutdir, { recursive: true });

const srcPath = path.join(absOutdir, 'top.v');
const xdcPath = path.join(absOutdir, 'constraints.xdc');
const manifestPath = path.join(absOutdir, 'manifest.json');

fs.writeFileSync(srcPath, bundle.topV, 'utf8');
fs.writeFileSync(xdcPath, bundle.topXdc, 'utf8');

const manifest = {
  schemaVersion: 1,
  exampleId,
  top: TOP,
  part: PART,
  commitSha: (() => {
    try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); }
    catch { return ''; }
  })(),
  srcPath,
  xdcPath,
  srcSha256: sha256(bundle.topV),
  xdcSha256: sha256(bundle.topXdc),
  exportedAt: new Date().toISOString(),
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

process.stdout.write(`REDBYTE_EXPORTED: ${exampleId} → ${absOutdir}\n`);
process.exit(0);
