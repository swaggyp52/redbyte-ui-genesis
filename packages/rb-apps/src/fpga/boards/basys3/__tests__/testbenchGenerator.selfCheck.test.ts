import { describe, expect, it } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../../../export/projectFormat';
import {
  createFromScratchCombSwitchAndBasys3Project,
  createFromScratchSeqTwoBitCounterBasys3Project,
} from '../../../../apps/ide/fixtures/fromScratchBasys3CertProjects';
import { exportProjectAsBasys3, validateArtifactConsistency } from '../basys3ExportService';
import { buildExportViewModel } from '../../../../apps/ide/viewmodels/buildExportViewModel';
import {
  detectTestbenchEntityName,
  generateTestbenchVhdl,
  TESTBENCH_RESULT_FILE,
  testbenchEntityNameFor,
} from '../testbenchGenerator';

/**
 * Self-check contract for every generated testbench (Defect A).
 *
 * A generated testbench must be able to fail: it counts its checks and failures,
 * stops its own clock, and ends with exactly one machine-readable summary line.
 * FAIL and NO_CHECKS end at severity failure so exit-code consumers fail closed.
 */

type Path = {
  label: string;
  project: () => RBProject;
  vectors: (project: RBProject) => TestVector[];
  options?: Parameters<typeof generateTestbenchVhdl>[2];
  clocked: 'none' | 'auto' | 'authored';
};

const AUTHORED_COUNTER_VECTORS: TestVector[] = [
  { tick: 0, inputs: { clk: 0, en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
  { tick: 1, inputs: { clk: 1, en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
  { tick: 2, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
  { tick: 3, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
];

const AUTHORED = { mode: 'authored', signalId: 'clk', signalLabel: 'CLK100MHZ', startLevel: 0 } as const;

const PATHS: Path[] = [
  {
    label: 'entity combinational',
    project: createFromScratchCombSwitchAndBasys3Project,
    vectors: (p) => p.vectors ?? [],
    clocked: 'none',
  },
  {
    label: 'entity auto board clock',
    project: createFromScratchSeqTwoBitCounterBasys3Project,
    vectors: (p) => p.vectors ?? [],
    clocked: 'auto',
  },
  {
    label: 'entity authored clock',
    project: createFromScratchSeqTwoBitCounterBasys3Project,
    vectors: () => AUTHORED_COUNTER_VECTORS,
    options: { clockDrive: AUTHORED },
    clocked: 'authored',
  },
  {
    label: 'fallback combinational',
    project: createFromScratchCombSwitchAndBasys3Project,
    vectors: (p) => p.vectors ?? [],
    options: { entityVhd: '' },
    clocked: 'none',
  },
  {
    label: 'fallback auto board clock',
    project: createFromScratchSeqTwoBitCounterBasys3Project,
    vectors: (p) => p.vectors ?? [],
    options: { entityVhd: '' },
    clocked: 'auto',
  },
  {
    label: 'fallback authored clock',
    project: createFromScratchSeqTwoBitCounterBasys3Project,
    vectors: () => AUTHORED_COUNTER_VECTORS,
    options: { entityVhd: '', clockDrive: AUTHORED },
    clocked: 'authored',
  },
];

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function expectedKeyCount(vectors: TestVector[]): number {
  return vectors.reduce((total, vector) => total + Object.keys(vector.expected ?? {}).length, 0);
}

function vectorBlocks(text: string): string {
  const stim = text.split('stim: process')[1] ?? '';
  return stim.split(/\n\s*rb_tb_checks\s*<=/)[0] ?? '';
}

describe('generated testbench self-check contract', () => {
  describe.each(PATHS)('$label', (path) => {
    const project = path.project();
    const vectors = path.vectors(project);
    const tb = generateTestbenchVhdl(project, vectors, path.options);

    it('ends with exactly one PASS, one FAIL and one NO_CHECKS summary branch', () => {
      expect(countMatches(tb, /"REDBYTE_TB_RESULT v=1 tb=\w+ status=" & status/g)).toBe(1);
      expect(countMatches(tb, /rb_finish\("FAIL", failure\);/g)).toBe(1);
      expect(countMatches(tb, /rb_finish\("NO_CHECKS", failure\);/g)).toBe(1);
      expect(countMatches(tb, /rb_finish\("PASS", note\);/g)).toBe(1);
      expect(tb).toMatch(/report summary severity level;/);
    });

    it('writes the summary line to the result file before reporting it', () => {
      expect(tb).toContain('use std.textio.all;');
      expect(tb).toContain(`file rb_result_file : text open write_mode is "${TESTBENCH_RESULT_FILE}";`);
      expect(tb).toMatch(/writeline\(rb_result_file, result_line\);\s+file_close\(rb_result_file\);\s+report summary severity level;/);
    });

    it('counts one check per expected key and pins the expected total', () => {
      const keys = expectedKeyCount(vectors);
      expect(keys).toBeGreaterThan(0);
      expect(countMatches(tb, /rb_checks := rb_checks \+ 1;/g)).toBe(keys);
      expect(countMatches(tb, /^\s*assert\s/gm)).toBe(keys);
      expect(tb).toContain(`constant RB_TB_EXPECTED_CHECKS : natural := ${keys};`);
      expect(countMatches(tb, /rb_failures := rb_failures \+ 1;/g)).toBe(keys);
    });

    it('publishes the result signals before reporting and then halts', () => {
      expect(tb).toMatch(/signal rb_tb_done : boolean := false;/);
      expect(tb).toMatch(/rb_tb_checks <= rb_checks;\s+rb_tb_failures <= rb_failures;\s+rb_tb_done <= true;\s+wait for 0 ns;/);
      expect(tb).toMatch(/end if;\s+wait;\s+end process;\s+end architecture sim;/);
    });

    it('uses the shared testbench entity name authority', () => {
      const entity = detectTestbenchEntityName(tb);
      expect(entity).toBe(testbenchEntityNameFor('top'));
      expect(tb).toContain(`"REDBYTE_TB_RESULT v=1 tb=${entity} status=" & status`);
    });

    it('is byte-identical across generations', () => {
      expect(generateTestbenchVhdl(path.project(), path.vectors(path.project()), path.options)).toBe(tb);
    });

    if (path.clocked === 'auto') {
      it('stops the free-running clock once the stimulus is done', () => {
        expect(tb).toMatch(/while not rb_tb_done loop[\s\S]*?end loop;\s+wait;\s+end process;/);
        expect(tb).not.toMatch(/^\s*loop\s*$/m);
      });

      it('samples after the post-edge logic settles instead of two delta cycles', () => {
        const blocks = vectorBlocks(tb);
        expect(blocks).not.toContain('wait for 0 ns;');
        expect(countMatches(blocks, /wait until rising_edge\(CLK100MHZ\);\s+wait for 1 ns;/g)).toBe(vectors.length);
      });
    }

    if (path.clocked === 'authored') {
      it('keeps one settle wait per authored vector and no generated clock', () => {
        expect(countMatches(vectorBlocks(tb), /wait for 10 ns;/g)).toBe(vectors.length);
        expect(tb).not.toContain('clock_gen: process');
      });
    }
  });

  it('entity-backed testbenches stay consistent with their top.vhd', () => {
    for (const create of [createFromScratchCombSwitchAndBasys3Project, createFromScratchSeqTwoBitCounterBasys3Project]) {
      const result = exportProjectAsBasys3(create());
      expect(result.errors).toEqual([]);
      expect(validateArtifactConsistency(result.bundle!.topVhd, result.bundle!.testbench!)).toEqual([]);
    }
  });

  it('a stimulus-only testbench reports NO_CHECKS instead of looking like a pass', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const vectors = (project.vectors ?? []).map((vector) => ({ ...vector, expected: {} }));
    const entityVhd = exportProjectAsBasys3(project).bundle!.topVhd;
    const tb = generateTestbenchVhdl(project, vectors, { entityVhd });

    expect(tb).toContain('constant RB_TB_EXPECTED_CHECKS : natural := 0;');
    expect(tb).not.toMatch(/rb_checks := rb_checks \+ 1;/);
    expect(validateArtifactConsistency(entityVhd, tb)).toEqual([]);
  });

  it('an unresolvable expected key is a counted failure and blocks export', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const vectors: TestVector[] = [{ tick: 0, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { 'no such port': 1 } }];
    const tb = generateTestbenchVhdl(project, vectors);

    expect(tb).toMatch(/-- RB_UNRESOLVED_EXPECTATION vector=0 key="no such port"/);
    expect(tb).toContain('constant RB_TB_EXPECTED_CHECKS : natural := 1;');
    expect(tb).toMatch(/rb_checks := rb_checks \+ 1;\s+rb_failures := rb_failures \+ 1;\s+report "Vector 0 cannot check/);
    const topVhd = exportProjectAsBasys3(project).bundle!.topVhd;
    expect(validateArtifactConsistency(topVhd, tb).join('\n')).toMatch(/expected key "no such port"/);
  });

  it('an unresolvable stimulus key is a counted failure and blocks export', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const vectors: TestVector[] = [{ tick: 0, inputs: { 'ghost input': 1 }, expected: { ld0_node: 0 } }];
    const tb = generateTestbenchVhdl(project, vectors);

    expect(tb).toMatch(/-- RB_UNRESOLVED_STIMULUS vector=0 key="ghost input"/);
    expect(tb).not.toMatch(/^\s*ghost input\s*<=/m);
    const topVhd = exportProjectAsBasys3(project).bundle!.topVhd;
    expect(validateArtifactConsistency(topVhd, tb).join('\n')).toMatch(/stimulus key "ghost input"/);
  });

  it('the fallback path never silently drops an expectation whose key needs trimming', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const vectors: TestVector[] = [{ tick: 0, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ' ld0_node ': 1 } }];
    const tb = generateTestbenchVhdl(project, vectors, { entityVhd: '' });

    expect(countMatches(tb, /rb_checks := rb_checks \+ 1;/g)).toBe(1);
    expect(tb).toContain('constant RB_TB_EXPECTED_CHECKS : natural := 1;');
  });

  it('a non-binary expected value is never coerced to a bit', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const vectors: TestVector[] = [{ tick: 0, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 2 } }];
    const tb = generateTestbenchVhdl(project, vectors);

    expect(tb).not.toMatch(/assert LED = '1'/);
    expect(tb).toMatch(/-- RB_UNRESOLVED_EXPECTATION vector=0 key="ld0_node" reason=non-binary/);
    const topVhd = exportProjectAsBasys3(project).bundle!.topVhd;
    expect(validateArtifactConsistency(topVhd, tb)).not.toEqual([]);
  });

  it.each([
    ['fpga.top', { fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'my_design' }, hdl: undefined }],
    ['hdl.top', { fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' }, hdl: { top: 'my_design', sources: [] } }],
  ])('top.vhd, DUT component and sim top agree when %s names the design', (_label, patch) => {
    const vm = buildExportViewModel({ ...createFromScratchCombSwitchAndBasys3Project(), ...(patch as Partial<RBProject>) });
    const tb = vm.artifacts.find((a) => a.path === 'testbench.vhd')!.content;
    const tcl = vm.artifacts.find((a) => a.path === 'vivado_import.tcl')!.content;

    expect(vm.status).toBe('ok');
    expect(vm.artifacts.find((a) => a.path === 'top.vhd')!.content).toMatch(/^entity my_design is$/m);
    expect(tb).toMatch(/component my_design is/);
    expect(vm.topAuthority.simulationTop).toBe('tb_my_design');
    expect(tcl).toContain('set_property top "tb_my_design" [get_filesets sim_1]');
  });

  it('the consistency validator reads ports from a top.vhd ending in `end <name>;`', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const result = exportProjectAsBasys3(project);
    const shortEnding = result.bundle!.topVhd.replace('end entity top;', 'end top;');
    expect(shortEnding).toContain('end top;');
    expect(validateArtifactConsistency(shortEnding, result.bundle!.testbench!)).toEqual([]);
  });

  it('self-check identifiers never collide with DUT ports', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const topVhd = exportProjectAsBasys3(project)
      .bundle!.topVhd.replace('LED : out STD_LOGIC', 'LED : out STD_LOGIC;\n    rb_tb_done : in STD_LOGIC');
    const tb = generateTestbenchVhdl(project, project.vectors ?? [], { entityVhd: topVhd });

    expect(countMatches(tb, /signal rb_tb_done\b/g)).toBe(1);
    expect(tb).toMatch(/signal rb_tb_done : std_logic := '0';/);
    expect(tb).toMatch(/signal rb_tb_done_1 : boolean := false;/);
    expect(validateArtifactConsistency(topVhd, tb)).toEqual([]);
  });
});
