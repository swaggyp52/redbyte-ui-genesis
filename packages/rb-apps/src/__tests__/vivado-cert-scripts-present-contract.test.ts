import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vivado certification helper scripts (repo presence)', () => {
  const repoRoot = join(__dirname, '..', '..', '..', '..');

  it('exports IDE examples to Open Project ZIP for real-tool rehearsal', () => {
    const p = join(repoRoot, 'scripts', 'vivado-cert-export-ide-example.ts');
    const text = readFileSync(p, 'utf8');
    expect(text).toContain('IDE_EXAMPLES');
    expect(text).toContain('LAB_STARTERS');
    expect(text).toContain('buildVivadoProjectFolderZip');
  });

  it('exports classroom golden combinational fixture without buildExportViewModel', () => {
    const p = join(repoRoot, 'scripts', 'vivado-cert-export-open-project.ts');
    const text = readFileSync(p, 'utf8');
    expect(text).toContain('golden-basys3-switch-and');
    expect(text).toContain('exportBasys3Bundle');
  });

  it('exports blank-shaped from-scratch cert fixtures (no examplesCatalog)', () => {
    const p = join(repoRoot, 'scripts', 'vivado-cert-export-from-scratch.ts');
    const text = readFileSync(p, 'utf8');
    expect(text).toContain('fromScratchBasys3CertProjects');
    expect(text).toContain('buildVivadoProjectFolderZip');
    expect(text).not.toContain('IDE_EXAMPLES');
  });

  it('includes a generic custom-project Vivado certification harness', () => {
    const p = join(repoRoot, 'scripts', 'vivado-cert-custom-project.ts');
    const text = readFileSync(p, 'utf8');
    expect(text).toContain('custom-project');
    expect(text).toContain('buildVivadoProjectFolderZip');
    expect(text).toContain('redbyte_batch_synth_impl_bitstream.tcl');
    expect(text).toContain('redbyte_program_device.tcl');
  });
});
