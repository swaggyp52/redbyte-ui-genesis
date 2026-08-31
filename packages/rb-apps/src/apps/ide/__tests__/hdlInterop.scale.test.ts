import { describe, expect, it } from 'vitest';
import { parseVcd } from '../vcdImport';
import { waveformFromVcd } from '../simulationProvider';
import { analyzerMeasurements, DEFAULT_VCD_ANALYZER_CONFIG, visibleSignals } from '../vcdAnalyzer';
import { normalizeProjectSourceModel } from '../projectSourceModel';
import { filesByFileset, deriveCompileOrder } from '../projectSourceModel';
import { buildLiveCrossProbeIndex, type CrossProbeDesignModule } from '../crossProbeBuilder';
import { linksForModule } from '../sourceCrossProbe';

/**
 * Scale/durability proof for the P2 HDL-interop models. Correctness at scale is
 * the durable assertion; absolute timing is informational (the workbench bounds
 * *rendering* separately, in the panels). Runs on the pinned runtime.
 */

describe('HDL interop at scale', () => {
  it('parses a 500-signal VCD and measures every signal at a cursor', () => {
    const lines: string[] = ['$timescale 1ns $end'];
    const ids: string[] = [];
    for (let i = 0; i < 500; i++) {
      const id = `s${i}`;
      ids.push(id);
      lines.push(`$var wire 4 ${id} sig${i} $end`);
    }
    lines.push('$enddefinitions $end', '#0');
    for (const id of ids) lines.push(`b1010 ${id}`);
    lines.push('#5');
    for (const id of ids) lines.push(`b0101 ${id}`);

    const waveform = waveformFromVcd(parseVcd(lines.join('\n')), 'big.vcd');
    expect(waveform.signals).toHaveLength(500);

    const measurements = analyzerMeasurements(waveform, { ...DEFAULT_VCD_ANALYZER_CONFIG, cursorTime: 5 });
    expect(measurements).toHaveLength(500);
    expect(measurements[0].formatted).toBe('0x5'); // b0101 at t=5 → hex 0x5
    // Nothing pinned → every signal is visible (the panel caps rendering, not the model).
    expect(visibleSignals(waveform, DEFAULT_VCD_ANALYZER_CONFIG)).toHaveLength(500);
  });

  it('handles a 1000-file source model (grouping + compile order)', () => {
    const files = [];
    for (let i = 0; i < 1000; i++) {
      const isXdc = i % 5 === 0;
      files.push({
        path: isXdc ? `constraints/c${i}.xdc` : `rtl/m${i}.vhd`,
        language: isXdc ? 'xdc' : 'vhdl',
        fileset: isXdc ? 'constraint' : 'design',
        text: isXdc ? `# pins ${i}` : `entity m${i} is end m${i};`,
      });
    }
    const model = normalizeProjectSourceModel({ files });
    expect(model.files).toHaveLength(1000);
    const grouped = filesByFileset(model);
    expect(grouped.design.length + grouped.constraint.length).toBe(1000);
    // Constraint/utility files are excluded from compile order; design files remain.
    expect(deriveCompileOrder(model).length).toBe(grouped.design.length);
  });

  it('builds a cross-probe index over a large design deterministically', () => {
    const modules: CrossProbeDesignModule[] = [];
    const files = [];
    for (let m = 0; m < 200; m++) {
      const name = `mod${m}`;
      const ports = Array.from({ length: 8 }, (_, p) => ({ name: `p${m}_${p}` }));
      modules.push({ id: `id${m}`, name, ports });
      files.push({
        path: `rtl/${name}.vhd`,
        language: 'vhdl',
        fileset: 'design',
        text: `entity ${name} is port ( ${ports.map((p) => `${p.name} : in std_logic`).join('; ')} ); end ${name};`,
      });
    }
    const sourceModel = normalizeProjectSourceModel({ files });
    const index = buildLiveCrossProbeIndex({ modules, sourceModel });

    // Every module resolves to an exact declaration link.
    const exactModuleLinks = index.links.filter((l) => l.kind === 'module' && l.quality === 'exact');
    expect(exactModuleLinks).toHaveLength(200);
    // A sampled module has its module link + its port links.
    const sample = linksForModule(index, 'id7');
    expect(sample.some((l) => l.kind === 'module')).toBe(true);
    expect(sample.filter((l) => l.kind === 'port').length).toBe(8);

    // Deterministic: rebuilding yields an identical link order.
    const again = buildLiveCrossProbeIndex({ modules, sourceModel });
    const key = (i: typeof index) => i.links.map((l) => `${l.sourceId}:${l.kind}:${l.elementKey}`).join('|');
    expect(key(again)).toBe(key(index));
  });
});
