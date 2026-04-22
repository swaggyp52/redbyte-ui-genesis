// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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

function buildDraftAuthoringProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
    name: 'Draft Authoring Project',
    description: 'Blank-authoring verify fixture with no expected outputs.',
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
          id: 'sw1_node',
          type: 'INPUT',
          label: 'sw1',
          position: { x: 0, y: 100 },
          x: 0,
          y: 100,
          rotation: 0,
          config: {},
          state: {},
        },
        {
          id: 'ld0_node',
          type: 'OUTPUT',
          label: 'ld0',
          position: { x: 180, y: 50 },
          x: 180,
          y: 50,
          rotation: 0,
          config: {},
          state: {},
        },
      ],
      connections: [],
    },
    ioMapping: {
      inputs: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'SW0' },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'sw1', pin: 'SW1' },
      ],
      outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' }],
    },
    vectors: [],
    meta: {
      projectId: 'rb-draft-authoring-project',
      projectKind: 'custom',
      activeExampleId: null,
      sourceExampleId: null,
      scenarioAuthority: 'none',
    },
  };
}

function seedIdeRoute(mode: 'project' | 'import') {
  window.history.replaceState({}, '', `/os/?mode=${mode}`);
}

function enterImportWorkbench(view: ReturnType<typeof render>) {
  fireEvent.click(view.getByTestId('ide-import-start-other-options-toggle'));
  fireEvent.click(view.getByTestId('ide-import-start-secondary'));
}

async function findVerifyRunAction(view: ReturnType<typeof render>) {
  const selectors = [
    'ide-vcb-run',
    'ide-verify-run',
    'ide-verify-run-secondary',
    'ide-verify-empty-run',
    'ide-verify-stale-primary-rerun',
    'ide-verify-scenario-stale-rerun',
    'ide-verify-wrong-scenario-rerun',
    'ide-verify-stale-rerun',
    'ide-verify-stale-run-simulation',
  ] as const;

  await waitFor(() => {
    const available = selectors.some((selector) => Boolean(view.queryByTestId(selector)));
    expect(available).toBe(true);
  }, { timeout: 5000 });

  const target = selectors
    .map((selector) => view.queryByTestId(selector))
    .find((node): node is HTMLElement => Boolean(node));

  expect(target).toBeTruthy();
  return target!;
}

describe('IdeApp lab-day wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    seedIdeRoute('project');
  });

  afterEach(() => {
    cleanup();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  // SKIP: Import nav button removed from left rail in Phase-1 (Import demoted to utility action).
  // Rewrite when Import is repositioned as a modal/action with its new navigation contract.
  it.skip('routes the ports-only rescue CTA from Import to Export', async () => {
    const view = render(<IdeApp />);

    fireEvent.click(await view.findByTestId('mode-button-import'));
    await view.findByTestId('ide-import-panel', {}, { timeout: 5000 });
    enterImportWorkbench(view);
    fireEvent.click(await view.findByTestId('ide-import-toggle-behavioral-samples', {}, { timeout: 5000 }));
    fireEvent.click(view.getByTestId('ide-import-load-sample-edge-detect'));

    await waitFor(() => {
      expect(view.getByTestId('ide-import-ports-only-warning')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-import-go-to-export'));

    await waitFor(() => {
      expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Export');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-export-panel')).toBeTruthy();
    }, { timeout: 10000 });
  });

  it('propagates Project top and part edits into the Export handoff summary', async () => {
    const view = render(<IdeApp />);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildDraftAuthoringProject());
    });

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
    await view.findByTestId('ide-hardware-panel');
    fireEvent.click(view.getByTestId('ide-hw-mode-btn-map'));

    await waitFor(() => {
      expect(view.getByTestId('ide-hw-map-dock').textContent).toContain('Clock');
      expect(view.getByTestId('ide-hw-map-dock').textContent).toContain('Mapped');
    });
  });

  it(
    'wires authoritative scenario provenance through Verify, Export, and Hardware in normal flow',
    async () => {
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
      await view.findByTestId('ide-verify-panel', {}, { timeout: 5000 });
      const useSaved = await view.findByTestId('ide-vcb-use-saved-checks');
      fireEvent.click(useSaved);

      await act(async () => {
        fireEvent.click(await findVerifyRunAction(view));
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

      await act(async () => {
        fireEvent.click(view.getByTestId('mode-button-export'));
      });
      // Export uses a visible right inspector (no `ide-workbench-dock-toggle-right` rail).
      await waitFor(
        () => {
          expect(view.getByTestId('ide-export-testbench-source')).toBeTruthy();
        },
        { timeout: 15000 }
      );

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
    },
    20_000
  );

  it('wires the Verify scenario library header into runtime create and switch actions', async () => {
    const view = render(<IdeApp />);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildScenarioAuthorityProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-verify'));

    await act(async () => {
      fireEvent.click(await findVerifyRunAction(view));
    });

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

  it('keeps Verify Generate Basics in trace-authoring mode for custom projects', async () => {
    const view = render(<IdeApp />);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildDraftAuthoringProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-verify'));

    await waitFor(() => {
      expect(view.getByTestId('ide-verify-session-mode').textContent).toContain('Observe');
    });

    fireEvent.click(view.getByTestId('ide-verify-generate-basic-vectors'));

    await waitFor(() => {
      const state = useProjectRuntime.getState();
      expect(state.projectVectors.length).toBeGreaterThan(0);
      expect(state.projectVectors.every((vector) => Object.keys(vector.expected ?? {}).length === 0)).toBe(true);
    });

    expect(view.getByTestId('ide-verify-session-mode').textContent).toContain('Observe');
    expect(view.getByTestId('ide-verify-session-title').textContent).toMatch(/Ready to run( stimulus)?/);
    expect(view.getByTestId('ide-vcb-run')).toBeTruthy();
  });

  it('detaches starter examples without leaving Verify stuck in starter compare mode', async () => {
    const view = render(<IdeApp />);

    await view.findByTestId('ide-project-landing');
    fireEvent.click(await view.findByTestId('ide-project-landing-example-signal-tour'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-example-confirm-modal')).toBeNull();
    });

    await waitFor(() => {
      expect(useProjectRuntime.getState().activeExampleId).toBe('signal-tour');
    });

    await act(async () => {
      useProjectRuntime.getState().addDesignNode('AND', { x: 480, y: 180 });
    });

    fireEvent.click(await view.findByTestId('mode-button-verify'));

    await waitFor(() => {
      const state = useProjectRuntime.getState();
      expect(state.projectKind).toBe('custom');
      expect(state.activeExampleId).toBeNull();
      expect(state.projectVectors.every((vector) => Object.keys(vector.expected ?? {}).length === 0)).toBe(true);
    });

    await waitFor(() => {
      expect(view.queryByTestId('ide-verify-auto-vector-notice')).toBeNull();
    });

    expect(view.getByTestId('ide-vcb-status').textContent).toContain('READY');
    expect(view.getByTestId('ide-verify-session-mode').textContent).toContain('Observe');
    expect(view.getByTestId('ide-verify-session-title').textContent).toMatch(/Ready to run( stimulus)?/);
    expect(view.getByTestId('ide-vcb-run')).toBeTruthy();
  });

  it('loads the Lab 8 starter directly into Design with visible starter authority', async () => {
    const view = render(<IdeApp />);

    await view.findByTestId('ide-project-landing');
    fireEvent.click(await view.findByTestId('ide-project-lab-card-lab8-security-lock-fsm'));

    await waitFor(() => {
      expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Design');
    });

    await waitFor(() => {
      expect(useProjectRuntime.getState().activeExampleId).toBe('23_lab8-fsm-lock-starter-basys3');
    });

    const starterTitle = (await view.findByTestId('ide-design-starter-banner-title', {}, { timeout: 5000 }))
      .textContent;
    expect(starterTitle).toMatch(/Lab 8|Security Lock/);

    expect((await view.findByTestId('ide-design-starter-banner-lab', {}, { timeout: 5000 })).textContent).toContain('Lab 8');
    const nextAction = (await view.findByTestId('ide-design-starter-banner-next-action', {}, { timeout: 5000 })).textContent;
    expect(nextAction).toMatch(/Connect ENTER|DFlipFlop|final-project reference|bridge/i);
    expect(view.queryByTestId('ide-design-empty-state')).toBeNull();
    expect(useProjectRuntime.getState().circuit.nodes.some((node) => node.label === 'IN0 (SW6)')).toBe(true);
    expect(useProjectRuntime.getState().circuit.nodes.some((node) => node.label === 'LOCK (LED1)')).toBe(true);
  });

  it('holds starter replacement on Project until overwrite is confirmed', async () => {
    const view = render(<IdeApp />);

    await view.findByTestId('ide-project-landing');
    fireEvent.click(await view.findByTestId('ide-project-landing-example-signal-tour'));

    await waitFor(() => {
      expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Design');
    });

    fireEvent.click(await view.findByTestId('mode-button-project'));

    await waitFor(() => {
      expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Project');
    });

    await view.findByTestId('ide-project-panel', {}, { timeout: 5000 });
    fireEvent.click(await view.findByTestId('ide-project-load-start-logic-gates', {}, { timeout: 5000 }));

    await waitFor(() => {
      expect(view.getByTestId('ide-example-confirm-modal')).toBeTruthy();
    });

    expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Project');
    expect(useProjectRuntime.getState().activeExampleId).not.toBe('logic-gates');

    fireEvent.click(view.getByTestId('ide-example-confirm'));

    await waitFor(() => {
      expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Design');
    });

    await waitFor(() => {
      expect(useProjectRuntime.getState().activeExampleId).toBe('logic-gates');
    });

    expect((await view.findByTestId('ide-design-starter-banner-title', {}, { timeout: 5000 })).textContent).toContain(
      'Logic Gates'
    );
  });
});
