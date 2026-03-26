// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { IdeApp } from '../../IdeApp';
import { useProjectRuntime } from '../projectRuntime';
import { computeScenarioContentHash } from '../verifyScenario';

function buildSemanticClockProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-21T00:00:00.000Z',
    updatedAt: '2026-03-21T00:00:00.000Z',
    name: 'Semantic Clock Project',
    description: 'Sequential project with a non-regex clock label.',
    circuit: {
      nodes: [
        {
          id: 'data_node',
          type: 'INPUT',
          label: 'data_in',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'phase_driver_node',
          type: 'INPUT',
          label: 'phase_driver',
          position: { x: 0, y: 100 },
          x: 0,
          y: 100,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ff_node',
          type: 'DFlipFlop',
          label: 'ff0',
          position: { x: 220, y: 40 },
          x: 220,
          y: 40,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'q_node',
          type: 'OUTPUT',
          label: 'q',
          position: { x: 420, y: 40 },
          x: 420,
          y: 40,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'data_node', portName: 'out' },
          to: { nodeId: 'ff_node', portName: 'D' },
        },
        {
          from: { nodeId: 'phase_driver_node', portName: 'out' },
          to: { nodeId: 'ff_node', portName: 'CLK' },
        },
        {
          from: { nodeId: 'ff_node', portName: 'Q' },
          to: { nodeId: 'q_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'data_in', nodeId: 'data_node', port: 'out', label: 'data_in', pin: 'SW0' },
        {
          id: 'phase_driver',
          nodeId: 'phase_driver_node',
          port: 'out',
          label: 'phase_driver',
          pin: 'CLK100MHZ',
        },
      ],
      outputs: [{ id: 'q', nodeId: 'q_node', port: 'in', label: 'q', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { data_in: 1 }, expected: { q: 1 } },
      { tick: 1, inputs: { data_in: 0 }, expected: { q: 0 } },
    ],
    meta: {
      projectId: 'rb-semantic-clock-project',
    },
  };
}

function buildScenarioAuthorityProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
    name: 'Scenario Authority Project',
    description: 'Simple mapped project for normal-flow scenario provenance checks.',
    circuit: {
      nodes: [
        {
          id: 'sw0_node',
          type: 'INPUT',
          label: 'sw0',
          position: { x: 0, y: 0 },
          x: 0,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld0_node',
          type: 'OUTPUT',
          label: 'ld0',
          position: { x: 180, y: 0 },
          x: 180,
          y: 0,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'SW0' }],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' }],
    },
    vectors: [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ],
    meta: {
      projectId: 'rb-scenario-authority-project',
    },
  };
}

function seedIdeRoute(mode: 'project' | 'import') {
  window.history.replaceState({}, '', `/os/?mode=${mode}`);
}

describe('IdeApp lab-day wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    seedIdeRoute('project');
  });

  afterEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('routes the ports-only rescue CTA from Import to Export', async () => {
    seedIdeRoute('import');
    const view = render(<IdeApp />);

    fireEvent.click(await view.findByTestId('ide-import-toggle-behavioral-samples'));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-go-to-export'));

    await waitFor(() => {
      expect(view.getByTestId('ide-export-panel')).toBeTruthy();
    });
  });

  it('propagates Project top and part edits into the Export handoff summary', async () => {
    const view = render(<IdeApp />);

    fireEvent.change(await view.findByTestId('ide-project-fpga-top'), {
      target: { value: 'lab_day_top' },
    });
    fireEvent.change(view.getByTestId('ide-project-fpga-part'), {
      target: { value: 'xc7a100tcsg324-1' },
    });

    fireEvent.click(view.getByTestId('mode-button-export'));

    await waitFor(() => {
      expect(view.getByTestId('ide-export-panel')).toBeTruthy();
    });

    expect(view.getByTestId('ide-export-top-module').textContent).toBe('lab_day_top');
    expect(view.getByTestId('ide-export-part-number').textContent).toContain('xc7a100tcsg324-1');
  });

  it('derives live semantic clock mapping in Hardware before any verify run exists', async () => {
    const view = render(<IdeApp />);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildSemanticClockProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-hardware'));

    await waitFor(() => {
      expect(view.getByText('Clock').parentElement?.textContent).toContain('Mapped');
    });
  });

  it('wires authoritative scenario provenance through Verify, Export, and Hardware in normal flow', async () => {
    const view = render(<IdeApp />);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildScenarioAuthorityProject());
      useProjectRuntime.getState().setVectors([
        { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
        { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        { tick: 2, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      ]);
    });

    const scenarioBeforeRun = useProjectRuntime
      .getState()
      .scenarios.find((scenario) => scenario.id === useProjectRuntime.getState().activeScenarioId);

    expect(scenarioBeforeRun).toBeTruthy();
    expect(scenarioBeforeRun?.version).toBeGreaterThan(1);

    fireEvent.click(await view.findByTestId('mode-button-verify'));
    await view.findByTestId('ide-scenario-library-header', {}, { timeout: 3000 });

    await act(async () => {
      fireEvent.click(await view.findByTestId('ide-verify-run', {}, { timeout: 3000 }));
    });

    await waitFor(() => {
      expect(useProjectRuntime.getState().verifyLastRun?.runKind).toBe('trace');
    });

    await act(async () => {
      fireEvent.click(await view.findByTestId('ide-verify-assertion-mode-toggle'));
      fireEvent.click(await view.findByTestId('ide-verify-run-secondary'));
    });

    await waitFor(() => {
      const state = useProjectRuntime.getState();
      const run = state.verifyLastRun;
      const activeScenario = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);

      expect(run).toBeTruthy();
      expect(activeScenario).toBeTruthy();
      expect(run?.runKind).toBe('verify');
      expect(run?.scenarioId).toBe(activeScenario?.id);
      expect(run?.scenarioVersion).toBe(activeScenario?.version);
      expect(run?.scenarioContentHash).toBe(computeScenarioContentHash(activeScenario!));
    });

    fireEvent.click(view.getByTestId('mode-button-export'));

    await waitFor(() => {
      expect(view.getByTestId('ide-export-testbench-source')).toBeTruthy();
    });

    const stateAfterRun = useProjectRuntime.getState();
    const activeScenarioAfterRun = stateAfterRun.scenarios.find(
      (scenario) => scenario.id === stateAfterRun.activeScenarioId
    )!;
    expect(view.getByTestId('ide-export-scenario-name').textContent).toContain(activeScenarioAfterRun.name);
    expect(view.getByTestId('ide-export-scenario-version').textContent).toContain(
      String(activeScenarioAfterRun.version)
    );
    expect(view.getByTestId('ide-export-scenario-hash').textContent).toContain(
      computeScenarioContentHash(activeScenarioAfterRun)
    );

    await act(async () => {
      useProjectRuntime.getState().setVectors([
        { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
        { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
        { tick: 2, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      ]);
    });

    fireEvent.click(view.getByTestId('mode-button-hardware'));

    await waitFor(() => {
      expect(view.getByTestId('ide-hardware-drift-callout').textContent).toContain(
        'edited after the last verify run'
      );
    });
  });

  it('wires the Verify scenario library header into runtime create and switch actions', async () => {
    const view = render(<IdeApp />);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildScenarioAuthorityProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-verify'));

    await waitFor(() => {
      expect(view.getByTestId('ide-scenario-library-header')).toBeTruthy();
    });

    const defaultScenarioId = useProjectRuntime.getState().activeScenarioId;
    const defaultScenario = useProjectRuntime
      .getState()
      .scenarios.find((scenario) => scenario.id === defaultScenarioId);

    fireEvent.click(view.getByTestId('ide-scenario-create-btn'));

    await waitFor(() => {
      const state = useProjectRuntime.getState();
      expect(state.scenarios).toHaveLength(2);
      expect(state.activeScenarioId).not.toBe(defaultScenarioId);
    });

    const createdScenarioId = useProjectRuntime.getState().activeScenarioId;

    await act(async () => {
      useProjectRuntime.getState().setVectors([
        { tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
      ]);
    });

    fireEvent.click(view.getByTestId('ide-scenario-switcher-btn'));
    fireEvent.click(await view.findByTestId(`ide-scenario-option-${defaultScenarioId}`));

    await waitFor(() => {
      const state = useProjectRuntime.getState();
      const activeScenario = state.scenarios.find((scenario) => scenario.id === state.activeScenarioId);
      const createdScenario = state.scenarios.find((scenario) => scenario.id === createdScenarioId);

      expect(state.activeScenarioId).toBe(defaultScenarioId);
      expect(activeScenario?.vectors).toEqual(defaultScenario?.vectors);
      expect(state.projectVectors).toEqual(activeScenario?.vectors);
      expect(createdScenario?.vectors).not.toEqual(activeScenario?.vectors);
    });
  });
});
