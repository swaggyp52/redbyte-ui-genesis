// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import { useEngineeringSelection } from '../engineeringSelection';
import { workspacePreferencesStore } from '../workspacePreferences';
import { createEmptyProjectHierarchy, createModuleFromSelection, placeModuleInstance } from '../projectHierarchy';
import { deriveProjectCompileOrder, deriveProjectExplorer } from '../surfaces/project/projectWorkbenchModel';
import type { ProjectHealth } from '../projectHealth';

afterEach(() => cleanup());

const fullAdder: Circuit = {
  nodes: [
    { id: 'A', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
    { id: 'B', type: 'INPUT', label: 'B', position: { x: 0, y: 60 } },
    { id: 'CIN', type: 'INPUT', label: 'CIN', position: { x: 0, y: 120 } },
    { id: 'SUM', type: 'OUTPUT', label: 'SUM', position: { x: 500, y: 0 } },
    { id: 'COUT', type: 'OUTPUT', label: 'COUT', position: { x: 500, y: 120 } },
    { id: 'x1', type: 'XOR', position: { x: 160, y: 0 } },
    { id: 'x2', type: 'XOR', position: { x: 320, y: 0 } },
    { id: 'a1', type: 'AND', position: { x: 160, y: 120 } },
    { id: 'a2', type: 'AND', position: { x: 320, y: 120 } },
    { id: 'o1', type: 'OR', position: { x: 420, y: 120 } },
  ],
  connections: [
    { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'x1', portName: 'a' } },
    { from: { nodeId: 'B', portName: 'out' }, to: { nodeId: 'x1', portName: 'b' } },
    { from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'x2', portName: 'a' } },
    { from: { nodeId: 'CIN', portName: 'out' }, to: { nodeId: 'x2', portName: 'b' } },
    { from: { nodeId: 'x2', portName: 'out' }, to: { nodeId: 'SUM', portName: 'in' } },
    { from: { nodeId: 'A', portName: 'out' }, to: { nodeId: 'a1', portName: 'a' } },
    { from: { nodeId: 'B', portName: 'out' }, to: { nodeId: 'a1', portName: 'b' } },
    { from: { nodeId: 'CIN', portName: 'out' }, to: { nodeId: 'a2', portName: 'a' } },
    { from: { nodeId: 'x1', portName: 'out' }, to: { nodeId: 'a2', portName: 'b' } },
    { from: { nodeId: 'a1', portName: 'out' }, to: { nodeId: 'o1', portName: 'a' } },
    { from: { nodeId: 'a2', portName: 'out' }, to: { nodeId: 'o1', portName: 'b' } },
    { from: { nodeId: 'o1', portName: 'out' }, to: { nodeId: 'COUT', portName: 'in' } },
  ],
};

function hierarchicalTop() {
  const fa = createModuleFromSelection(fullAdder, createEmptyProjectHierarchy(), {
    moduleName: 'FullAdder',
    instanceName: 'u_fa0',
    selectedNodeIds: ['x1', 'x2', 'a1', 'a2', 'o1'],
    nowIso: '2026-09-01T00:00:00.000Z',
  });
  const placed = placeModuleInstance(fa.circuit, fa.definition, { x: 400, y: 200 }, 'u_fa1');
  return { circuit: placed.circuit, hierarchy: fa.hierarchy, definition: fa.definition };
}

const health: ProjectHealth = { blockingIssues: [], dirtySinceVerify: false, dirtySinceExport: false };

function baseProps(overrides: Partial<ProjectSurfaceProps> = {}): ProjectSurfaceProps {
  return {
    projectName: 'Full Adder',
    description: 'Three-input adder.',
    determinismHash: 'abcdef0123456789abcdef',
    topModuleName: 'full_adder',
    lastSavedAt: '',
    readiness: { hasCircuit: true, hasIoMapping: true, hasVectors: true, verifyPass: false, missingRequiredCount: 1 },
    health,
    mappingRows: [
      { id: 'a', nodeId: 'A', label: 'A', direction: 'in', pin: 'V17', required: true, port: 'out' },
      { id: 'b', nodeId: 'B', label: 'B', direction: 'in', pin: 'V16', required: true, port: 'out' },
      { id: 'cin', nodeId: 'CIN', label: 'CIN', direction: 'in', pin: 'W16', required: true, port: 'out' },
      { id: 'sum', nodeId: 'SUM', label: 'SUM', direction: 'out', pin: '', required: true, port: 'in' },
      { id: 'cout', nodeId: 'COUT', label: 'COUT', direction: 'out', pin: 'E19', required: true, port: 'in' },
    ],
    examples: [],
    projectKind: 'example',
    activeExampleId: null,
    onOpenExample: vi.fn(),
    onOpenImport: vi.fn(),
    circuit: fullAdder,
    hierarchy: createEmptyProjectHierarchy(),
    fpgaConfig: { part: 'xc7a35tcpg236-1', top: 'full_adder', board: 'Basys3' },
    scenarios: [{ id: 'scn-1', name: 'Default', vectorCount: 8, checkCount: 16, sequential: false }],
    activeScenarioId: 'scn-1',
    artifacts: [{ path: 'top.vhd', bytes: 900 }, { path: 'top.xdc', bytes: 200 }],
    problems: [{ id: 'issue:RBP1005', severity: 'error', code: 'RBP1005', message: 'SUM is not mapped to a board resource.', fixMode: 'hardware' }],
    runHistory: [],
    document: { kind: 'project-overview' },
    onOpenDocument: vi.fn(),
    onNavigateMode: vi.fn(),
    ...overrides,
  };
}

describe('Project workbench — loaded project', () => {
  beforeEach(() => {
    useEngineeringSelection.getState().clear();
    localStorage.clear();
    workspacePreferencesStore.applyPreset('authoring');
  });

  it('renders explorer, overview document, and no inspector until something is selected', () => {
    const view = render(<ProjectSurface {...baseProps()} />);
    expect(view.getByTestId('ide-project-explorer')).toBeTruthy();
    expect(view.getByTestId('ide-project-overview-document')).toBeTruthy();
    expect(view.queryByTestId('ide-project-inspector')).toBeNull();
    // No loaded-project dashboard narration.
    const text = view.container.textContent ?? '';
    expect(text).not.toMatch(/Next: Simulate|Recent projects|Goal:|Continue work from this device/);
    // Facts strip carries real technical facts.
    expect(view.getByTestId('ide-project-fact-part').textContent).toContain('xc7a35tcpg236-1');
    expect(view.getByTestId('ide-project-fact-mapping').textContent).toContain('4/5 required signals mapped');
    expect(view.getByTestId('ide-project-fact-problems').textContent).toContain('1');
  });

  it('shows the starter brief as project context — name, lab, next action and expected behavior', () => {
    const view = render(
      <ProjectSurface
        {...baseProps({
          starterContext: {
            name: '2-Bit Up Counter',
            lab: 'Lab 4',
            concept: 'Sequential logic',
            summary: 'A two-bit counter driven by the board clock.',
            expectedBehavior: 'With EN high, the counter advances on each rising edge.',
            nextAction: 'Open Simulate and run the Timing scenario.',
          },
        })}
      />
    );
    const brief = view.getByTestId('ide-project-starter-brief');
    expect(view.getByTestId('ide-project-starter-name').textContent).toContain('2-Bit Up Counter');
    expect(view.getByTestId('ide-project-starter-lab').textContent).toContain('Lab 4');
    expect(view.getByTestId('ide-project-starter-next-action').textContent).toContain('Open Simulate');
    expect(brief.textContent).toContain('Expected behavior');
    expect(brief.textContent).toContain('advances on each rising edge');
  });

  it('omits the starter brief for a project that did not come from a starter', () => {
    const view = render(<ProjectSurface {...baseProps()} />);
    expect(view.queryByTestId('ide-project-starter-brief')).toBeNull();
  });

  it('selecting an explorer row opens the inspector; activating it opens the document', () => {
    const onOpenDocument = vi.fn();
    const view = render(<ProjectSurface {...baseProps({ onOpenDocument })} />);
    const row = view.getByTestId('ide-project-row-scenario:scn-1');
    fireEvent.click(row);
    expect(useEngineeringSelection.getState().selected).toEqual({ kind: 'scenario', scenarioId: 'scn-1' });
    expect(view.getByTestId('ide-project-inspector').textContent).toContain('Default');
    expect(view.getByTestId('ide-project-inspector').textContent).toContain('combinational');
    fireEvent.doubleClick(row);
    expect(onOpenDocument).toHaveBeenCalledWith({ kind: 'cases', scenarioId: 'scn-1' });
  });

  it('routes a problem to its owning workspace from the overview', () => {
    const onNavigateMode = vi.fn();
    const view = render(<ProjectSurface {...baseProps({ onNavigateMode })} />);
    expect(view.getByTestId('ide-project-problems').textContent).toContain('RBP1005');
    fireEvent.click(view.getByTestId('ide-project-problem-fix-issue:RBP1005'));
    expect(onNavigateMode).toHaveBeenCalledWith('hardware');
  });

  it('shows the I/O boundary as a table with the unmapped signal flagged; a row selects the signal', () => {
    const view = render(<ProjectSurface {...baseProps()} />);
    const sumRow = view.getByTestId('ide-project-io-row-sum');
    expect(sumRow.textContent).toContain('unmapped');
    fireEvent.click(sumRow);
    expect(useEngineeringSelection.getState().selected).toMatchObject({ kind: 'signal', fieldId: 'sum' });
    expect(view.getByTestId('ide-project-inspector').textContent).toContain('unmapped');
  });

  it('renders Sources and Compile Order documents from the hierarchy authority', () => {
    const { circuit, hierarchy } = hierarchicalTop();
    const view = render(<ProjectSurface {...baseProps({ circuit, hierarchy, document: { kind: 'sources' } })} />);
    expect(view.getByTestId('ide-project-sources-document')).toBeTruthy();
    const moduleRow = view.getByTestId(`ide-project-module-row-${hierarchy.modules[0].id}`);
    expect(moduleRow.textContent).toContain('FullAdder');
    expect(moduleRow.textContent).toContain('2'); // two instances
    cleanup();
    const order = render(<ProjectSurface {...baseProps({ circuit, hierarchy, document: { kind: 'compile-order' } })} />);
    const rows = order.container.querySelectorAll('[data-testid^="ide-project-compile-row-"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('FullAdder.vhd');
    expect(rows[1].textContent).toContain('full_adder.vhd');
    expect(rows[1].textContent).toContain('FullAdder');
  });

  it('exposes the hierarchy group with instances that open their definition', () => {
    const { circuit, hierarchy, definition } = hierarchicalTop();
    const groups = deriveProjectExplorer({
      topModuleName: 'full_adder',
      circuit,
      hierarchy,
      outline: null,
      sourceModel: undefined,
      scenarios: [],
      activeScenarioId: null,
      constraintSets: undefined,
      boardLabel: 'Basys3',
      mappingRows: [],
      artifacts: [],
      runs: [],
      problems: [],
    });
    const hier = groups.find((group) => group.id === 'hierarchy');
    expect(hier?.count).toBe(2);
    expect(hier?.rows.map((row) => row.label)).toEqual(['full_adder', 'u_fa0', 'u_fa1']);
    expect(hier?.rows[1].open).toEqual({ kind: 'schematic', moduleId: definition.id });
    const order = deriveProjectCompileOrder({ topModuleName: 'full_adder', hierarchy, sourceModel: undefined });
    expect(order.map((row) => row.unit)).toEqual(['FullAdder.vhd', 'full_adder.vhd']);
  });

  it('sets the active top through the overview header as a validated command', () => {
    const onFpgaConfigChange = vi.fn();
    const view = render(<ProjectSurface {...baseProps({ onFpgaConfigChange })} />);
    const input = view.getByTestId('ide-project-fpga-top') as HTMLInputElement;
    expect(input.value).toBe('full_adder');
    fireEvent.change(input, { target: { value: '9bad' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(view.getByTestId('ide-project-active-top-error')).toBeTruthy();
    expect(onFpgaConfigChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'adder_top' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onFpgaConfigChange).toHaveBeenCalledWith({ top: 'adder_top' });
  });
});

describe('Project start center', () => {
  it('leads with Start a Lab and keeps the other paths subordinate', () => {
    const view = render(
      <ProjectSurface {...baseProps({ readiness: { hasCircuit: false, hasIoMapping: false, hasVectors: false, verifyPass: false, missingRequiredCount: 0 }, circuit: undefined })} />
    );
    expect(view.getByTestId('ide-project-landing')).toBeTruthy();
    expect(view.getByTestId('ide-project-start-a-lab-primary').getAttribute('data-product-priority')).toBe('primary');
    expect(view.getByTestId('ide-project-build-fresh-primary')).toBeTruthy();
    expect(view.queryByTestId('ide-project-explorer')).toBeNull();
  });

  it("starts a blank project immediately when nothing is loaded (the confirmation is the command owner's)", () => {
    const onStartBlankProject = vi.fn();
    const view = render(<ProjectSurface {...baseProps({ onStartBlankProject, readiness: { hasCircuit: false, hasIoMapping: false, hasVectors: false, verifyPass: false, missingRequiredCount: 0 } })} />);
    // Landing with no circuit starts immediately.
    fireEvent.click(view.getByTestId('ide-project-build-fresh-primary'));
    expect(onStartBlankProject).toHaveBeenCalledTimes(1);
  });
});
