// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type { Circuit, Node, PortRef } from '@redbyte/rb-logic-core';
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { decodeRBProject, encodeRBProject, type RBProject } from '../export/projectFormat';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
} from '../apps/ide/projectHierarchy';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { isDesignOwnedExportDiagnostic } from '../apps/ide/projectWorkflowAuthority';
import { moduleNameCollision } from '../apps/ide/vhdlNames';
import { useProjectRuntime, type RuntimeSimState } from '../apps/ide/projectRuntime';
import { projectRuntimeCircuitToEditorStore } from '../apps/ide/circuitProjection';
import { DesignSurface } from '../apps/ide/surfaces/DesignSurface';
import { workspacePreferencesStore } from '../apps/ide/workspacePreferences';
import { useCircuitStore } from '../stores/circuitStore';
import { useLayoutStore } from '../stores/layoutStore';

/**
 * MUX4 fails closed. The engine has no MUX4 behaviour (its outputs read 0) and
 * the VHDL it used to emit (`with s1 & s0 select`) did not analyze, so RedByte
 * refuses the part by name instead of claiming a trusted package. A saved
 * design that contains one still opens, unchanged and inspectable.
 */

const NOW = '2026-10-26T00:00:00.000Z';
const at = (x: number, y = 0) => ({ position: { x, y } });
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string) =>
  ({ id, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort } });

/** The netlist/elaborator MUX4 pin names, each driven by one switch. */
const MUX_PINS = ['i0', 'i1', 'i2', 'i3', 's0', 's1'];

/** SW0..SW5 -> MUX[0] -> NOT -> LD0. */
function mux4Circuit(): Circuit {
  const nodes: Node[] = [
    ...MUX_PINS.map((_, i) => ({ id: `sw${i}`, type: 'INPUT', label: `SW${i}`, ...at(0, i * 40) })),
    { id: 'mux0', type: 'MUX4', label: 'MUX[0]', ...at(150, 100) },
    { id: 'inv0', type: 'NOT', ...at(220, 100) },
    { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(300, 100) },
  ];
  return {
    nodes,
    connections: [
      ...MUX_PINS.map((pin, i) => wire(`w${i}`, `sw${i}`, 'out', 'mux0', pin)),
      wire('wm', 'mux0', 'out', 'inv0', 'in'),
      wire('wo', 'inv0', 'out', 'ld0', 'in'),
    ],
  };
}

function mux4Project(circuit: Circuit = mux4Circuit(), hierarchy?: RBProject['hierarchy']): RBProject {
  return {
    kind: 'rb-project', version: 1, createdAt: NOW, updatedAt: NOW,
    name: 'mux4-fail-closed', circuit, hierarchy,
    ioMapping: {
      inputs: MUX_PINS.map((_, i) => ({ id: `sw${i}`, nodeId: `sw${i}`, port: 'out', label: `SW${i}`, pin: `SW${i}` })),
      outputs: [{ id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'LD0' }],
    },
    hdl: { top: 'mux4_top', sources: [] },
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'mux4_top' },
  } as RBProject;
}

/** The same design with MUX[0] and its inverter moved into a module "Selector". */
function moduleProject(): RBProject {
  const created = createModuleFromSelection(mux4Circuit(), createEmptyProjectHierarchy(), {
    moduleName: 'Selector', instanceName: 'u_sel', selectedNodeIds: ['mux0', 'inv0'], nowIso: NOW,
  });
  return mux4Project(created.circuit, created.hierarchy);
}

/** A concurrent `with ... select` is the MUX4 HDL GHDL rejected; nothing may ship it. */
const SELECT_STATEMENT = /\bwith\b[^;]*\bselect\b/i;

describe('MUX4 blocks the package with a named RBEX4100 diagnostic', () => {
  it('flat project: blocked, names MUX4 and the node, and no trusted top.vhd', () => {
    const project = mux4Project();
    const before = JSON.stringify(project);
    const vm = buildExportViewModel(project);
    expect(vm.status).not.toBe('ok');
    const error = vm.errors.find((entry) => /Unsupported synth subset node type "MUX4" on node "mux0"/.test(entry.message));
    expect(error, vm.errors.map((entry) => entry.message).join('\n')).toBeDefined();
    expect(error?.code).toBe('RBEX4100');
    expect(isDesignOwnedExportDiagnostic(error!.code)).toBe(true);
    const top = vm.artifacts.find((artifact) => artifact.path === 'top.vhd');
    expect(top?.status).toBe('blocked');
    expect(top?.content ?? '').not.toMatch(SELECT_STATEMENT);
    for (const artifact of vm.artifacts.filter((entry) => entry.kind === 'vhd')) {
      expect(artifact.status, artifact.path).not.toBe('ready');
    }
    // Export never rewrites the design.
    expect(JSON.stringify(project)).toBe(before);
  });

  it('MUX4 inside a module: blocked, naming MUX4, the node and the module file', () => {
    const vm = buildExportViewModel(moduleProject());
    expect(vm.status).not.toBe('ok');
    const messages = vm.errors.map((entry) => entry.message);
    expect(messages.join('\n')).toMatch(/Unsupported synth subset node type "MUX4" on node "mux0"\. Fix: .* \[in selector\.vhd\]/);
    const mux4Errors = vm.errors.filter((entry) => /node type "MUX4"/.test(entry.message));
    expect(mux4Errors.length).toBeGreaterThan(0);
    for (const entry of mux4Errors) expect(entry.code, entry.message).toBe('RBEX4100');
    const vhd = vm.artifacts.filter((artifact) => artifact.kind === 'vhd');
    expect(vhd.map((artifact) => artifact.path)).toEqual(expect.arrayContaining(['top.vhd', 'selector.vhd']));
    for (const artifact of vhd) {
      expect(artifact.status, artifact.path).toBe('blocked');
      expect(artifact.content, artifact.path).not.toMatch(SELECT_STATEMENT);
    }
  });

  it('keeps MUX4 reserved as a built-in part name for modules', () => {
    expect(moduleNameCollision('MUX4')).toBe('is the name of the built-in MUX4 part');
    expect(() =>
      createModuleFromSelection(mux4Circuit(), createEmptyProjectHierarchy(), {
        moduleName: 'MUX4', instanceName: 'u_m', selectedNodeIds: ['mux0', 'inv0'], nowIso: NOW,
      }),
    ).toThrow(/Choose another name/);
  });
});

describe('a saved project with MUX4 still loads and is inspectable', () => {
  function makeRuntimeSim(): RuntimeSimState {
    return {
      tick: 0, running: false, stepMode: false, lastAction: 'step', speedHz: 10,
      irHash: 'ir-hash', traceHash: 'trace-hash', inputs: {}, signals: {}, trace: [],
      selectedSignalKey: null, probes: [],
    };
  }

  beforeEach(() => {
    class ImmediateResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ target, contentRect: { width: 1320, height: 720, x: 0, y: 0, top: 0, left: 0, bottom: 720, right: 1320, toJSON: () => ({}) } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
    useCircuitStore.getState().reset();
    useLayoutStore.getState().resetLayout();
    workspacePreferencesStore.reset();
    useLogicViewStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
      selection: { nodes: new Set<string>(), wires: new Set<string>() },
      toolMode: 'select', interactionMode: 'idle', editingState: { isDragging: false }, snapToGrid: true, gridSize: 16,
    });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('round-trips the file, keeps the node in the circuit, and the Design inspector names it', async () => {
    const saved = encodeRBProject(mux4Project());
    const decoded = decodeRBProject(saved);
    useProjectRuntime.getState().loadFromProject(decoded);
    const loaded = useProjectRuntime.getState().circuit;
    expect(loaded.nodes.find((node) => node.id === 'mux0')).toMatchObject({
      type: 'MUX4', label: 'MUX[0]', position: { x: 150, y: 100 },
    });
    const intoMux = loaded.connections
      .map((connection) => connection.to)
      .filter((to): to is PortRef => typeof to !== 'string' && to.nodeId === 'mux0');
    expect(intoMux.map((to) => to.portName)).toEqual(MUX_PINS);
    // Loading changes nothing: saving again yields the same file.
    expect(encodeRBProject({ ...decoded, circuit: loaded })).toBe(saved);

    projectRuntimeCircuitToEditorStore(loaded);
    const view = render(
      <DesignSurface
        runtimeSim={makeRuntimeSim()}
        ioRows={[]}
        onRuntimeSimStep={vi.fn()}
        onRuntimeSimReset={vi.fn()}
        onRuntimeSimToggleProbe={vi.fn()}
        onGoToProject={vi.fn()}
        onGoToVerify={vi.fn()}
      />,
    );
    act(() => { useLogicViewStore.getState().selectNode('mux0'); });
    await waitFor(() => expect(view.getByTestId('ide-design-selection-inspector')).toBeTruthy());
    expect(view.getByTestId('ide-design-selection-identity').textContent).toBe('MUX[0]');
    expect(view.getByTestId('ide-design-selection-type').textContent).toBe('4:1 multiplexer');
  });
});
