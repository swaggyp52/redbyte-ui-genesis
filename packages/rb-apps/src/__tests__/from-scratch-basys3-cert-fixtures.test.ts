import { describe, expect, it } from 'vitest';
import {
  createFromScratchCombSwitchAndBasys3Project,
  createFromScratchSeqTwoBitCounterBasys3Project,
  FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS,
  getFromScratchBasys3CertProjectById,
} from '../apps/ide/fixtures/fromScratchBasys3CertProjects';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';
import { deriveVivadoProjectSlug } from '../fpga/vivado/vivadoProjectFolder';

describe('from-scratch Basys3 certification fixtures', () => {
  it('enumerates stable fixture ids', () => {
    expect(FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS).toEqual([
      'fs-comb-switch-and-basys3',
      'fs-seq-two-bit-counter-basys3',
    ]);
  });

  it('fixtures are blank-shaped saves (not example loads)', () => {
    for (const id of FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS) {
      const p = getFromScratchBasys3CertProjectById(id);
      expect(p.meta?.projectKind).toBe('blank');
      expect(p.meta?.sourceExampleId ?? null).toBeNull();
      expect(p.meta?.tags).toContain('from-scratch-cert');
    }
  });

  it('combinational fixture: export bundle valid + slug stable', () => {
    const p = createFromScratchCombSwitchAndBasys3Project();
    const bundle = exportBasys3Bundle(p.circuit, p.ioMapping!);
    expect(bundle.valid).toBe(true);
    expect(bundle.topVhd).toMatch(/entity\s+top\s+is/i);
    expect(bundle.topXdc).toMatch(/SW0|LD0|get_ports/i);
    expect(deriveVivadoProjectSlug(p.meta!.projectId!)).toBe('fs-comb-switch-and-basys3');
  });

  it('sequential fixture: export bundle valid + W5 clock constraint present', () => {
    const p = createFromScratchSeqTwoBitCounterBasys3Project();
    const bundle = exportBasys3Bundle(p.circuit, p.ioMapping!);
    expect(bundle.valid).toBe(true);
    expect(bundle.topXdc).toMatch(/create_clock|CLK100MHZ|W5/i);
    expect(deriveVivadoProjectSlug(p.meta!.projectId!)).toBe('fs-seq-two-bit-counter-basys3');
  });
});
