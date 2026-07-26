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

  it.each([
    ['entity-backed', undefined],
    ['fallback', ''],
  ])('drives authored clock vectors in the %s generator path', (_label, entityVhd) => {
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const vectors = [
      { tick: 0, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 2, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 3, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
    ];

    const testbench = generateTestbenchVhdl(project, vectors, {
      entityVhd,
      clockDrive: {
        mode: 'authored',
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        startLevel: 0,
      },
    });
    const stimulusBlock = testbench.split('stim: process')[1] ?? '';

    expect(testbench).toContain('-- sequence=authored-vectors');
    expect(testbench).not.toContain('clock_gen: process');
    expect(testbench).not.toContain('constant CLK_HALF_PERIOD');
    expect(stimulusBlock).not.toContain('wait until rising_edge');
    expect(stimulusBlock.match(/CLK100MHZ <= '0';/g)).toHaveLength(2);
    expect(stimulusBlock.match(/CLK100MHZ <= '1';/g)).toHaveLength(2);
    expect(stimulusBlock.match(/wait for 10 ns;/g)).toHaveLength(4);
  });

  it.each([
    ['entity-backed', undefined],
    ['fallback', ''],
  ])('initializes an explicit first-high authored clock without inventing an edge in the %s path', (_label, entityVhd) => {
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const vectors = [
      { tick: 0, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 2, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
    ];

    const testbench = generateTestbenchVhdl(project, vectors, {
      entityVhd,
      clockDrive: {
        mode: 'authored',
        signalId: 'clk',
        signalLabel: 'CLK100MHZ',
        startLevel: 1,
      },
    });
    const firstVectorBlock = testbench.split('-- Vector 0 (tick=0)')[1]?.split('-- Vector 1')[0] ?? '';

    expect(testbench).toMatch(/signal\s+CLK100MHZ\s*:\s*std_logic\s*:=\s*'1';/i);
    expect(firstVectorBlock).toMatch(/CLK100MHZ\s*<=\s*'1';/i);
    expect(testbench).not.toContain('falling_edge');
    expect(testbench).not.toContain('clock_gen: process');
  });

  it.each([
    ['entity-backed', undefined],
    ['fallback', ''],
  ])(
    'falls back from a stale authored clock id to the current label in the %s path without inventing a port',
    (_label, entityVhd) => {
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const testbench = generateTestbenchVhdl(
      project,
      [
        { tick: 0, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
        { tick: 1, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      ],
      {
        entityVhd,
        clockDrive: {
          mode: 'authored',
          signalId: 'deleted-clock-row',
          signalLabel: 'CLK100MHZ',
          startLevel: 0,
        },
      },
    );

    expect(testbench).not.toMatch(/signal\s+deleted_clock_row\b/i);
    expect(testbench).not.toMatch(/deleted_clock_row\s*=>/i);
    expect(testbench).toContain("CLK100MHZ <= '0';");
    expect(testbench).toContain("CLK100MHZ <= '1';");
    }
  );
});
