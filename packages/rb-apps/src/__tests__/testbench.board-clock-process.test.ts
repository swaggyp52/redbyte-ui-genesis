import { describe, expect, it } from 'vitest';
import { createFromScratchSeqTwoBitCounterBasys3Project } from '../apps/ide/fixtures/fromScratchBasys3CertProjects';
import { generateTestbenchVhdl } from '../fpga/boards/basys3/testbenchGenerator';

describe('testbench board clock process', () => {
  it('emits a dedicated 100 MHz board clock process for Basys3 CLK100MHZ', () => {
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const vectors = [
      { tick: 0, inputs: { en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { en: 0, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 2, inputs: { en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 3, inputs: { en: 1, rst: 0 }, expected: { q0: 0, q1: 1 } },
    ];

    const testbench = generateTestbenchVhdl(project, vectors);

    expect(testbench).toContain('clock_gen: process');
    expect(testbench).toContain("constant CLK_HALF_PERIOD : time := 5 ns;");
    expect(testbench).toContain("CLK100MHZ <= '0';");
    expect(testbench).toContain("CLK100MHZ <= '1';");
    expect(testbench).toContain('wait until rising_edge(CLK100MHZ);');
  });

  it('keeps the clock out of the per-vector stimulus assignments', () => {
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const vectors = [
      { tick: 0, inputs: { en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 2, inputs: { en: 1, rst: 0 }, expected: { q0: 0, q1: 1 } },
    ];

    const testbench = generateTestbenchVhdl(project, vectors);
    const stimulusBlock = testbench.split('stim: process')[1] ?? '';

    expect(stimulusBlock).toContain('wait until rising_edge(CLK100MHZ);');
    expect(stimulusBlock).not.toContain("CLK100MHZ <= '1';");
    expect(stimulusBlock).not.toContain("CLK100MHZ <= '0';");
  });
});
