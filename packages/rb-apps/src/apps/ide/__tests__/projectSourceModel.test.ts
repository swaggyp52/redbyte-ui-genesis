import { describe, expect, it } from 'vitest';
import {
  addSourceFile,
  createEmptyProjectSourceModel,
  defaultFilesetForLanguage,
  deriveCompileOrder,
  detectSourceLanguage,
  filesByFileset,
  isEmptyProjectSourceModel,
  listLibraries,
  normalizeProjectSourceModel,
  promoteToolchainInput,
  sourceIdFromPath,
  validateProjectSourceModel,
  type ProjectSourceModel,
} from '../projectSourceModel';

describe('detectSourceLanguage', () => {
  it('maps known extensions', () => {
    expect(detectSourceLanguage('rtl/top.vhd')).toBe('vhdl');
    expect(detectSourceLanguage('a.vhdl')).toBe('vhdl');
    expect(detectSourceLanguage('a.v')).toBe('verilog');
    expect(detectSourceLanguage('a.sv')).toBe('systemverilog');
    expect(detectSourceLanguage('top.xdc')).toBe('xdc');
    expect(detectSourceLanguage('build.tcl')).toBe('tcl');
    expect(detectSourceLanguage('wave.vcd')).toBe('vcd');
  });
  it('is case-insensitive and defaults to unknown', () => {
    expect(detectSourceLanguage('TOP.VHD')).toBe('vhdl');
    expect(detectSourceLanguage('notes.md')).toBe('unknown');
    expect(detectSourceLanguage('noext')).toBe('unknown');
  });
});

describe('defaults + id derivation', () => {
  it('assigns a natural fileset per language', () => {
    expect(defaultFilesetForLanguage('vhdl')).toBe('design');
    expect(defaultFilesetForLanguage('xdc')).toBe('constraint');
    expect(defaultFilesetForLanguage('tcl')).toBe('utility');
    expect(defaultFilesetForLanguage('vcd')).toBe('simulation');
    expect(defaultFilesetForLanguage('unknown')).toBe('utility');
  });
  it('derives a stable, filesystem-safe id from a path', () => {
    expect(sourceIdFromPath('rtl/Top.vhd')).toBe('src-rtl-top-vhd');
    expect(sourceIdFromPath('rtl/Top.vhd')).toBe(sourceIdFromPath('rtl/Top.vhd'));
  });
});

describe('addSourceFile', () => {
  it('adds a file, detecting language and fileset', () => {
    const model = addSourceFile(createEmptyProjectSourceModel(), { path: 'rtl/top.vhd', text: 'entity x;' });
    expect(model.files).toHaveLength(1);
    expect(model.files[0]).toMatchObject({ path: 'rtl/top.vhd', language: 'vhdl', fileset: 'design', library: 'work' });
  });
  it('rejects duplicate paths and ids', () => {
    const base = addSourceFile(createEmptyProjectSourceModel(), { path: 'a.vhd', text: '' });
    expect(() => addSourceFile(base, { path: 'a.vhd', text: '' })).toThrow(/Duplicate source path/);
    expect(() => addSourceFile(base, { path: 'b.vhd', text: '', id: base.files[0].id })).toThrow(/Duplicate source id/);
  });
  it('honours explicit fileset and library', () => {
    const model = addSourceFile(createEmptyProjectSourceModel(), {
      path: 'tb/top_tb.vhd',
      text: '',
      fileset: 'simulation',
      library: 'sim_lib',
    });
    expect(model.files[0]).toMatchObject({ fileset: 'simulation', library: 'sim_lib' });
  });
});

describe('promoteToolchainInput', () => {
  it('promotes a legacy toolchain input into a design fileset with a top entity', () => {
    const model = promoteToolchainInput({
      top: 'student_top',
      sources: [
        { path: 'top.vhd', language: 'vhdl', text: 'entity student_top;' },
        { path: 'helper.v', language: 'verilog', text: 'module helper;' },
      ],
    });
    expect(model.topEntity).toBe('student_top');
    expect(model.files.map((f) => f.path).sort()).toEqual(['helper.v', 'top.vhd']);
    expect(model.files.every((f) => f.fileset === 'design' && f.library === 'work')).toBe(true);
  });
  it('is empty for missing/empty input and skips empty or duplicate paths', () => {
    expect(isEmptyProjectSourceModel(promoteToolchainInput(undefined))).toBe(true);
    expect(isEmptyProjectSourceModel(promoteToolchainInput({ sources: [] }))).toBe(true);
    const model = promoteToolchainInput({
      sources: [
        { path: '', language: 'vhdl', text: '' },
        { path: 'a.vhd', language: 'vhdl', text: '1' },
        { path: 'a.vhd', language: 'vhdl', text: '2' },
      ],
    });
    expect(model.files).toHaveLength(1);
  });
});

describe('deriveCompileOrder', () => {
  it('orders design before simulation and excludes constraint/utility, deterministically', () => {
    let model = createEmptyProjectSourceModel();
    model = addSourceFile(model, { path: 'sim/top_tb.vhd', text: '', fileset: 'simulation' });
    model = addSourceFile(model, { path: 'rtl/z.vhd', text: '' });
    model = addSourceFile(model, { path: 'rtl/a.vhd', text: '' });
    model = addSourceFile(model, { path: 'top.xdc', text: '' });
    model = addSourceFile(model, { path: 'build.tcl', text: '' });
    const order = deriveCompileOrder(model).map((f) => f.path);
    expect(order).toEqual(['rtl/a.vhd', 'rtl/z.vhd', 'sim/top_tb.vhd']);
  });
});

describe('queries', () => {
  it('lists libraries and groups by fileset', () => {
    let model = createEmptyProjectSourceModel();
    model = addSourceFile(model, { path: 'a.vhd', text: '', library: 'work' });
    model = addSourceFile(model, { path: 'b.vhd', text: '', library: 'alt' });
    model = addSourceFile(model, { path: 'top.xdc', text: '' });
    expect(listLibraries(model)).toEqual(['alt', 'work']);
    const grouped = filesByFileset(model);
    // Normal form sorts by fileset, then library, then path — so b.vhd (alt)
    // precedes a.vhd (work) within the design fileset.
    expect(grouped.design.map((f) => f.path)).toEqual(['b.vhd', 'a.vhd']);
    expect(grouped.constraint.map((f) => f.path)).toEqual(['top.xdc']);
  });
});

describe('validateProjectSourceModel', () => {
  it('passes a clean model and flags a corrupt one', () => {
    const clean = addSourceFile(createEmptyProjectSourceModel(), { path: 'a.vhd', text: '' });
    expect(validateProjectSourceModel(clean).ok).toBe(true);
    const corrupt: ProjectSourceModel = {
      schemaVersion: '1.0',
      files: [
        { id: 'x', path: 'a.vhd', language: 'vhdl', fileset: 'design', library: '' },
        { id: 'x', path: 'a.vhd', language: 'vhdl', fileset: 'design', library: 'work' },
      ] as any,
    };
    const result = validateProjectSourceModel(corrupt);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('normalizeProjectSourceModel', () => {
  it('returns empty for junk input', () => {
    expect(normalizeProjectSourceModel(null).files).toEqual([]);
    expect(normalizeProjectSourceModel({ files: 'nope' }).files).toEqual([]);
  });
  it('drops invalid entries, dedups paths, and sorts deterministically', () => {
    const normalized = normalizeProjectSourceModel({
      files: [
        { path: 'rtl/z.vhd', text: 'z', language: 'vhdl', fileset: 'design', library: 'work' },
        { path: '', text: 'empty' },
        { path: 'rtl/a.vhd', text: 'a' },
        { path: 'rtl/a.vhd', text: 'dup' },
        { path: 'top.xdc', text: 'c' },
      ],
    });
    expect(normalized.files.map((f) => f.path)).toEqual(['rtl/a.vhd', 'rtl/z.vhd', 'top.xdc']);
  });
  it('is idempotent', () => {
    const once = normalizeProjectSourceModel({
      topEntity: 'top',
      files: [
        { path: 'b.vhd', text: '', language: 'vhdl', fileset: 'design', library: 'work' },
        { path: 'a.vhd', text: '', language: 'vhdl', fileset: 'design', library: 'work' },
      ],
    });
    const twice = normalizeProjectSourceModel(once);
    expect(twice).toEqual(once);
    expect(twice.topEntity).toBe('top');
  });
});
