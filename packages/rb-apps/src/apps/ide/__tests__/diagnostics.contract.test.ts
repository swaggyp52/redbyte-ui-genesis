import { describe, expect, it } from 'vitest';
import {
  adaptImportDiagnostic,
  adaptIrDiagnostic,
  adaptVerifyPreflightIssue,
  resolveDiagnosticBlocking,
} from '../diagnostics';

describe('IDE diagnostics contract', () => {
  it('enforces deterministic blocking rules from severity', () => {
    expect(resolveDiagnosticBlocking('info')).toBe(false);
    expect(resolveDiagnosticBlocking('warn')).toBe(false);
    expect(resolveDiagnosticBlocking('error')).toBe(true);
    expect(resolveDiagnosticBlocking('error', false)).toBe(false);
  });

  it('synthesizes stable codes for import diagnostics that do not provide one', () => {
    const diagnostic = {
      source: 'parser' as const,
      severity: 'warning' as const,
      message: 'Unsupported generic clause was ignored.',
      filePath: 'top.vhd',
      line: 7,
      column: 3,
    };

    const first = adaptImportDiagnostic(diagnostic);
    const second = adaptImportDiagnostic(diagnostic);

    expect(first.code).toMatch(/^PARSE[0-9A-F]{6}$/);
    expect(first.code).toBe(second.code);
    expect(first.origin).toBe('parser');
    expect(first.stage).toBe('import');
    expect(first.blocking).toBe(false);
    expect(first.location).toMatchObject({
      filePath: 'top.vhd',
      line: 7,
      column: 3,
    });
  });

  it('preserves IR codes and node mapping when adapting compiler diagnostics', () => {
    const diagnostic = adaptIrDiagnostic({
      code: 'IR004',
      severity: 'error',
      message: 'Sequential primitive is missing a clock source.',
      nodeId: 'ff0',
      port: 'CLK',
      netName: 'n_clk',
    });

    expect(diagnostic.code).toBe('IR004');
    expect(diagnostic.origin).toBe('ir');
    expect(diagnostic.stage).toBe('design');
    expect(diagnostic.blocking).toBe(true);
    expect(diagnostic.owner).toMatchObject({
      kind: 'node',
      nodeId: 'ff0',
      portName: 'CLK',
    });
    expect(diagnostic.location).toMatchObject({
      nodeId: 'ff0',
      port: 'CLK',
      netName: 'n_clk',
    });
  });

  it('normalizes verify preflight issues into stable VPRE diagnostics', () => {
    const diagnostic = adaptVerifyPreflightIssue({
      kind: 'missing-output-node',
      signal: 'ld0',
      tick: 1,
      vectorId: 'vec-02',
      caseIndex: 1,
      message: 'Cannot verify: output ld0 is not mapped to a concrete design node.',
      nodeId: 'ld0_node',
      port: 'in',
    });

    expect(diagnostic.code).toBe('VPRE1002');
    expect(diagnostic.origin).toBe('verify-preflight');
    expect(diagnostic.stage).toBe('verify');
    expect(diagnostic.blocking).toBe(true);
    expect(diagnostic.location).toMatchObject({
      signal: 'ld0',
      tick: 1,
      vectorId: 'vec-02',
      caseIndex: 1,
      nodeId: 'ld0_node',
      port: 'in',
    });
  });
});
