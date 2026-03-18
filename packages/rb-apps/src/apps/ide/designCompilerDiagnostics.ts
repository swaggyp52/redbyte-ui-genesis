import { elaborateCircuit } from '@redbyte/rb-logic-core';
import type { RBProject } from '../../export/projectFormat';
import { adaptIrDiagnostic, type IdeDiagnostic } from './diagnostics';

export function deriveDesignCompilerDiagnostics(project: RBProject): IdeDiagnostic[] {
  const pins = Object.fromEntries(
    [
      ...(project.ioMapping?.inputs ?? []),
      ...(project.ioMapping?.outputs ?? []),
    ]
      .map((entry) => [
        `${(entry.nodeId ?? '').trim()}.${(entry.port ?? '').trim()}`,
        (entry.pin ?? '').trim(),
      ])
      .filter(([key]) => key !== '.')
  );

  return elaborateCircuit(project.circuit, { pins }).ir.diagnostics.map((diagnostic) =>
    adaptIrDiagnostic(diagnostic, { stage: 'design' })
  );
}
