// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { serializeCluster, pasteCluster } from '../designClipboard';
import { adaptVerifyPreflightIssue } from '../diagnostics';
import { buildVerifyCircuitEvidenceHash } from '../verifyProjectHash';
import { createDefaultScenario } from '../verifyScenario';
import { TestbenchDocumentTabs } from '../surfaces/verify/TestbenchDocumentTabs';

describe('live IDE contract repairs', () => {
  it('keeps an empty clipboard transferable without generating coordinates or mutations', () => {
    const circuit: Circuit = { nodes: [{ id: 'a', type: 'INPUT', position: { x: 160, y: 80 } }], connections: [] };
    const before = JSON.stringify(circuit);
    const cluster = serializeCluster(circuit, new Set());
    expect(Number.isFinite(cluster.originX)).toBe(true);
    expect(Number.isFinite(cluster.originY)).toBe(true);
    const result = pasteCluster(circuit, JSON.parse(JSON.stringify(cluster)), { x: 40, y: 40 });
    expect(result.pastedNodes).toEqual([]);
    expect(result.pastedConnections).toEqual([]);
    expect(result.newIdMap.size).toBe(0);
    expect(JSON.stringify(circuit)).toBe(before);
  });

  it('retains a stable floating-output advisory code when the upstream issue omits its code', () => {
    const issue = { kind: 'floating-output' as const, severity: 'warning' as const, blocking: false, signal: 'CARRY', nodeId: 'carry', port: 'in', message: 'CARRY is disconnected; observed output is X.' };
    const first = adaptVerifyPreflightIssue(issue);
    const second = adaptVerifyPreflightIssue({ ...issue });
    expect(first.code).toBe('VPRE1005');
    expect(first.id).toBe(second.id);
    expect(first.blocking).toBe(false);
    expect(first.severity).toBe('warn');
    expect(first.owner).toMatchObject({ kind: 'node', nodeId: 'carry', portName: 'in' });
  });

  it('labels the persisted manual execution model as sequential without a clock name heuristic', () => {
    const manual = { ...createDefaultScenario([{ tick: 0, inputs: { enter: 0 }, expected: {} }], { overrideMode: 'manual-pulses', runCycles: 1, activeEdge: 'rising', resetBehavior: 'none', sourceType: 'manual', executionModel: 'manual' }), id: 'manual', name: 'Manual lab' };
    const combinational = { ...createDefaultScenario([{ tick: 0, inputs: { enable: 0 }, expected: {} }]), id: 'comb', name: 'Combinational' };
    const view = render(<TestbenchDocumentTabs scenarios={[manual, combinational]} activeScenarioId="manual" onSwitch={vi.fn()} onCreate={vi.fn()} onDuplicate={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />);
    expect(view.getByTestId('ide-testbench-document-tab-manual').textContent).toContain('Sequential');
    expect(view.getByTestId('ide-testbench-document-tab-comb').textContent).toContain('Combinational');
  });

  it('preserves the existing semantic hash bytes through coordinate, label and runtime-state changes', () => {
    const circuit: Circuit = { nodes: [{ id: 'source', type: 'INPUT', position: { x: 0, y: 0 }, state: { isOn: 0 } }, { id: 'lamp', type: 'OUTPUT', position: { x: 160, y: 0 } }], connections: [{ from: { nodeId: 'source', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } }] };
    // Captured from the pre-repair normalized projection; this is the established digest format.
    expect(buildVerifyCircuitEvidenceHash(circuit)).toBe('bc6a1d0e');
    const moved: Circuit = { ...circuit, nodes: circuit.nodes.map(node => ({ ...node, position: { x: 640, y: 320 }, x: 640, y: 320, label: 'Moved node', state: { isOn: 1 } })) };
    expect(buildVerifyCircuitEvidenceHash(moved)).toBe('bc6a1d0e');
    const changed: Circuit = { ...circuit, nodes: circuit.nodes.map(node => node.id === 'source' ? { ...node, config: { width: 2 } } : node) };
    expect(buildVerifyCircuitEvidenceHash(changed)).not.toBe('bc6a1d0e');
  });
});
