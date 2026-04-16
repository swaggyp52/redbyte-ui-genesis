import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import {
  buildArtifactAgreementRows,
  derivePackageHandoffSummary,
  formatExportDiagnosticOwner,
  formatTimingPlain,
  worstAgreementTone,
} from '../exportPackageHandoffModel';
import { buildExportViewModel } from '../viewmodels/buildExportViewModel';

describe('exportPackageHandoffModel', () => {
  it('formatTimingPlain explains manual-event lab without dumping raw mode ids', () => {
    const s = formatTimingPlain('manual_event_driven_lab', {
      exportLabel: 'Timing',
      exportDetail: 'fallback',
    });
    expect(s.toLowerCase()).toContain('manual-event');
    expect(s).not.toContain('manual_event_driven_lab');
  });

  it('formatExportDiagnosticOwner maps owner kinds to student-facing surfaces', () => {
    expect(formatExportDiagnosticOwner({ kind: 'mapping' })).toContain('Map Pins');
    expect(formatExportDiagnosticOwner({ kind: 'node' })).toContain('Design');
    expect(formatExportDiagnosticOwner({ kind: 'file', filePath: 'top.vhd' })).toContain('top.vhd');
  });

  it('derivePackageHandoffSummary marks partial when verify evidence is advisory', () => {
    const summary = derivePackageHandoffSummary({
      handoffSeverity: 'ready',
      exportViewBlocked: false,
      hasVerifyEvidenceWarning: true,
      agreementWorst: 'ok',
      boardTarget: 'Basys3',
      timingPlain: 'Combinational',
      mappingPlain: '2 of 2 required',
      verifyPlain: 'Not run',
    });
    expect(summary.status).toBe('partial');
    expect(summary.statusLabel).toBe('PACKAGE PARTIAL');
  });

  it('derivePackageHandoffSummary blocks when agreement has errors', () => {
    const summary = derivePackageHandoffSummary({
      handoffSeverity: 'ready',
      exportViewBlocked: false,
      hasVerifyEvidenceWarning: false,
      agreementWorst: 'error',
      boardTarget: 'Basys3',
      timingPlain: 'Clock',
      mappingPlain: 'ok',
      verifyPlain: 'ok',
    });
    expect(summary.status).toBe('blocked');
  });

  it('worstAgreementTone prefers error over warn', () => {
    expect(
      worstAgreementTone([
        { id: 'a', label: 'A', detail: '', tone: 'warn' },
        { id: 'b', label: 'B', detail: '', tone: 'ok' },
        { id: 'c', label: 'C', detail: '', tone: 'error' },
      ])
    ).toBe('error');
  });

  it('buildArtifactAgreementRows flags top authority mismatch', () => {
    const project = {
      kind: 'rb-project',
      version: 1,
      name: 't',
      circuit: { nodes: [], connections: [] },
      fpga: { board: 'basys3', top: 'fpga_only_mismatch' },
      hdl: { top: 'hdl_top', sources: [] },
    } as unknown as RBProject;
    const viewModel = buildExportViewModel(project);
    const rows = buildArtifactAgreementRows({
      project,
      viewModel,
      requiredMappedCount: 0,
      requiredCount: 0,
      timingStructureOk: true,
      topVhdStatus: 'ready',
      topXdcStatus: 'ready',
      testbenchStatus: 'ready',
      readmeStatus: 'ready',
      vivadoScriptStatus: 'ready',
    });
    const topRow = rows.find((r) => r.id === 'top-authority');
    expect(topRow?.tone).toBe('error');
  });
});
