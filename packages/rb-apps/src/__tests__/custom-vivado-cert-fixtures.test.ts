import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeRBProject } from '../export/projectFormat';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';
import { deriveVivadoProjectSlug } from '../fpga/vivado/vivadoProjectFolder';

const repoRoot = resolve(__dirname, '../../../..');

function loadFixture(name: string) {
  const raw = readFileSync(join(repoRoot, 'packages/rb-apps/src/fixtures/cert', name), 'utf8');
  return decodeRBProject(raw);
}

describe('custom Vivado certification fixtures', () => {
  it('keeps the four-switch LED custom fixture blank-shaped and exportable', () => {
    const project = loadFixture('fs-custom-four-switch-led.rbproj');
    const bundle = exportBasys3Bundle(project.circuit, project.ioMapping!);

    expect(project.meta?.projectKind).toBe('blank');
    expect(project.meta?.sourceExampleId ?? null).toBeNull();
    expect(bundle.valid).toBe(true);
    expect(bundle.topXdc).toMatch(/SW\[0\]|LED\[0\]/i);
    expect(deriveVivadoProjectSlug(project.meta?.projectId ?? project.name)).toBe(
      'fs-custom-four-switch-led'
    );
  });

  it('keeps the mixed-gate-chain custom fixture blank-shaped and exportable', () => {
    const project = loadFixture('fs-custom-mixed-gate-chain.rbproj');
    const bundle = exportBasys3Bundle(project.circuit, project.ioMapping!);

    expect(project.meta?.projectKind).toBe('blank');
    expect(project.meta?.sourceExampleId ?? null).toBeNull();
    expect(bundle.valid).toBe(true);
    expect(bundle.topVhd).toMatch(/and|xor|or/i);
    expect(deriveVivadoProjectSlug(project.meta?.projectId ?? project.name)).toBe(
      'fs-custom-mixed-gate-chain'
    );
  });
});
