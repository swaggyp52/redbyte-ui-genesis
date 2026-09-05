import { describe, expect, it } from 'vitest';
import { buildEngineeringProblems, type EngineeringProblemsInput } from '../engineeringProblems';
import type { EngineeringRelationshipIndex } from '../engineeringRelationships';
import type { ProjectSourceModel } from '../projectSourceModel';

/**
 * P2.5H — Problems completeness. The language capability matrix already knows which files
 * RedByte preserves without interpreting, and which it never executes (Tcl). That boundary
 * used to be visible only inside the Sources document: the ledger declared a `source`
 * category and produced nothing. It states the boundary now — as information, never a fault,
 * and one row per language rather than one per file.
 */
const EMPTY_INDEX: EngineeringRelationshipIndex = {
  signals: [],
  ambiguities: [],
  resolveField: () => null,
  resolveNode: () => null,
  resolveRunSignal: () => null,
  resolvePin: () => [],
};

function model(files: Array<{ path: string; language: string; fileset?: string }>): ProjectSourceModel {
  return {
    schemaVersion: '1.0',
    files: files.map((file, index) => ({
      id: `f${index}`,
      path: file.path,
      language: file.language,
      fileset: file.fileset ?? 'design',
      library: 'work',
      text: '',
    })),
  } as unknown as ProjectSourceModel;
}

function input(overrides: Partial<EngineeringProblemsInput> = {}): EngineeringProblemsInput {
  return {
    blockingIssues: [],
    designDiagnostics: [],
    designIssues: [],
    relationships: EMPTY_INDEX,
    exportErrors: [],
    exportWarnings: [],
    mappingProjection: [],
    lastRun: null,
    runIsStale: false,
    activeConstraintSetId: null,
    importFidelity: null,
    isSequential: false,
    hasCircuit: true,
    ...overrides,
  };
}

const sourceRows = (i: EngineeringProblemsInput) => buildEngineeringProblems(i).filter((p) => p.category === 'source');

describe('Problems ledger — source capability boundaries', () => {
  it('says plainly that Tcl is preserved and never executed', () => {
    const rows = sourceRows(input({ sourceModel: model([{ path: 'vivado_import.tcl', language: 'tcl' }]) }));
    expect(rows).toHaveLength(1);
    expect(rows[0].severity).toBe('info');
    expect(rows[0].code).toBe('source-never-executed');
    expect(rows[0].message).toMatch(/never executed/i);
    expect(rows[0].detail).toContain('vivado_import.tcl');
    expect(rows[0].authority).toBe('language capability matrix');
    expect(rows[0].document).toEqual({ kind: 'sources' });
  });

  it('groups by language rather than flooding the ledger with one row per file', () => {
    const rows = sourceRows(input({
      sourceModel: model([
        { path: 'a.tcl', language: 'tcl' },
        { path: 'b.tcl', language: 'tcl' },
        { path: 'c.tcl', language: 'tcl' },
        { path: 'd.tcl', language: 'tcl' },
      ]),
    }));
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain('4');
    // The first few files are named, and the remainder is counted honestly.
    expect(rows[0].detail).toContain('a.tcl');
    expect(rows[0].detail).toMatch(/\+1 more/);
  });

  it('never reports a preserved file as an error or a warning', () => {
    const rows = sourceRows(input({
      sourceModel: model([
        { path: 'legacy.sv', language: 'systemverilog' },
        { path: 'top.xdc', language: 'xdc', fileset: 'constraint' },
      ]),
    }));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.severity).toBe('info');
  });

  it('stays silent for a project whose sources are all reconstructable', () => {
    expect(sourceRows(input({ sourceModel: model([{ path: 'top.vhd', language: 'vhdl' }]) }))).toHaveLength(0);
    expect(sourceRows(input({ sourceModel: null }))).toHaveLength(0);
    expect(sourceRows(input())).toHaveLength(0);
  });
});
