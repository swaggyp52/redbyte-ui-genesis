// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@redbyte/rb-theme';
import type { RBProject } from '../../../export/projectFormat';
import { IdeApp } from '../../IdeApp';
import { useProjectRuntime } from '../projectRuntime';
import { computeScenarioContentHash } from '../verifyScenario';

// The active mode is no longer a top-bar label (`ide-topbar-mode-label` was
// removed when the stage-nav became the single workflow authority). The current
// authority is the active stage-nav button (aria-current="step"); read its label.
function activeModeText(view: { container: HTMLElement }): string {
  const active =
    view.container.querySelector('[data-testid^="mode-button-"][aria-current="step"]') ??
    view.container.querySelector('[data-testid^="mode-button-"][data-active="true"]');
  return active?.textContent ?? '';
}

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

async function expectProjectHomeVisible(view: ReturnType<typeof render>) {
  await waitFor(() => {
    expect(view.getByTestId('ide-mode-project')).toBeTruthy();
  });

  const hasLanding = Boolean(view.queryByTestId('ide-project-landing'));
  const hasProjectPanel = Boolean(view.queryByTestId('ide-project-panel'));
  expect(hasLanding || hasProjectPanel).toBe(true);

  const projectButton = view.getByTestId('mode-button-project');
  expect(projectButton.getAttribute('data-active')).toBe('true');
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
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

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
      expect(activeModeText(view)).toContain('Export');
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-export-panel')).toBeTruthy();
    }, { timeout: 10000 });
  });

  it('propagates the Project top edit and keeps the FPGA part board-owned in the Export handoff', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildDraftAuthoringProject());
    });

    fireEvent.change(await view.findByTestId('ide-project-fpga-top'), {
      target: { value: 'lab_day_top' },
    });

    // The FPGA part is board-owned (Basys3 -> xc7a35tcpg236-1) and displayed
    // read-only — not a freeform field the export would silently ignore.
    const partField = view.getByTestId('ide-project-fpga-part');
    expect(partField.tagName).not.toBe('INPUT');
    expect(partField.getAttribute('data-board-owned')).toBe('true');
    expect(partField.textContent).toContain('xc7a35tcpg236-1');

    fireEvent.click(view.getByTestId('mode-button-export'));

    await view.findByTestId('ide-export-panel', {}, { timeout: 15000 });

    fireEvent.click(view.getByTestId('ide-export-file-top-vhd'));
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('entity lab_day_top is');
    fireEvent.click(view.getByTestId('ide-export-file-vivado-import-tcl'));
    // Every generated artifact derives the target from the board authority.
    expect(view.getByTestId('ide-export-preview-code').textContent).toContain('xc7a35tcpg236-1');
  });

  it('resets inherited top authority when Build Fresh is renamed', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    fireEvent.click(await view.findByTestId('ide-project-build-fresh-primary'));
    await waitFor(() => {
      expect(
        view.queryByTestId('ide-project-build-fresh-confirm') ??
          (view.getByTestId('ide-root').getAttribute('data-ide-stage') === 'design'
            ? view.getByTestId('ide-root')
            : null)
      ).toBeTruthy();
    });
    const confirmBuildFresh = view.queryByTestId('ide-project-build-fresh-confirm');
    if (confirmBuildFresh) {
      fireEvent.click(confirmBuildFresh);
    }
    await waitFor(() => {
      expect(view.getByTestId('ide-root').getAttribute('data-ide-stage')).toBe('design');
    });

    fireEvent.click(view.getByTestId('ide-topbar-project-rename'));
    const nameInput = view.getByTestId('ide-topbar-project-name-input');
    fireEvent.change(nameInput, { target: { value: 'Full Adder' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    await act(async () => {
      useProjectRuntime.getState().applyCircuitMutation({
        nodes: [
          { id: 'input-a', type: 'INPUT', x: 0, y: 0, label: 'A' },
          { id: 'output-sum', type: 'OUTPUT', x: 200, y: 0, label: 'SUM' },
        ],
        connections: [
          {
            from: { nodeId: 'input-a', portName: 'out' },
            to: { nodeId: 'output-sum', portName: 'in' },
          },
        ],
      });
    });

    fireEvent.click(view.getByTestId('mode-button-project'));
    await waitFor(() => {
      expect((view.getByTestId('ide-project-fpga-top') as HTMLInputElement).value).toBe(
        'full_adder'
      );
    });
  }, 15000);

  it('keeps a structural Design blocker dominant over missing Compare evidence', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildDraftAuthoringProject());
    });

    // The structural Design blocker is a real problem row on the Overview, with
    // its repair path pointing at Design — not a hero status line.
    await waitFor(() => {
      expect(view.getByTestId('ide-project-problems').textContent).toMatch(/Compiler (error|warning)/);
    });
    expect(view.getByTestId('ide-project-problems').textContent).toContain('Output');
    expect(view.getByTestId('ide-project-fact-problems').textContent).not.toContain('none');
    expect(view.getAllByText('Open Design').length).toBeGreaterThan(0);
  });

  it('renders Project home on first load at /', async () => {
    window.history.replaceState({}, '', '/');
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);
    await expectProjectHomeVisible(view);
  });

  it('renders Project home on first load at /os/', async () => {
    window.history.replaceState({}, '', '/os/');
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);
    await expectProjectHomeVisible(view);
  });

  it('falls back to Project home when URL mode is invalid', async () => {
    window.history.replaceState({}, '', '/os/?mode=invalid');
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);
    await expectProjectHomeVisible(view);
  });

  it('derives live semantic clock mapping in Hardware before any verify run exists', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildSemanticClockProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-hardware'));
    await view.findByTestId('ide-hardware-panel', {}, { timeout: 15000 });

    await waitFor(() => {
      expect(view.getByTestId('ide-hardware-mapping-progress').textContent).toBe('MAPPING COMPLETE');
      expect(view.getByTestId('ide-hw-map-row-phase_driver').textContent?.toLowerCase()).toContain('phase_driver');
      expect(view.getByTestId('ide-hw-map-row-phase_driver').textContent).toContain('W5');
    });
  });

  it(
    'wires authoritative scenario provenance through Verify, Export, and Hardware in normal flow',
    async () => {
      const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

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
      await view.findByTestId('ide-export-panel', {}, { timeout: 15000 });
      fireEvent.click(view.getByTestId('ide-export-open-technical-evidence'));
      await waitFor(
        () => {
          expect(view.getByTestId('ide-export-gate-verify').textContent).toContain('Ready');
        },
        { timeout: 15000 }
      );

      const stateAfterRun = useProjectRuntime.getState();
      const activeScenarioAfterRun = stateAfterRun.scenarios.find(
        (scenario) => scenario.id === stateAfterRun.activeScenarioId
      )!;
      expect(stateAfterRun.verifyLastRun?.scenarioName).toBe(activeScenarioAfterRun.name);
      expect(stateAfterRun.verifyLastRun?.scenarioVersion).toBe(activeScenarioAfterRun.version);
      expect(stateAfterRun.verifyLastRun?.scenarioContentHash).toBe(
        computeScenarioContentHash(activeScenarioAfterRun)
      );
      expect(view.getByTestId('ide-export-technical-dialog').textContent).toContain(
        stateAfterRun.verifyLastRun?.deterministicHash
      );

      await act(async () => {
        useProjectRuntime.getState().setVectors([
          { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
          { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
          { tick: 2, inputs: { sw0: 0 }, expected: { ld0: 0 } },
        ]);
      });

      fireEvent.click(view.getByTestId('mode-button-hardware'));
      await view.findByTestId('ide-hardware-panel', {}, { timeout: 15000 });

      await waitFor(() => {
        expect(view.getByTestId('ide-hardware-readiness-callout').textContent).toContain(
          'changed after the last Compare run'
        );
      });
    },
    20_000
  );

  it('wires the Verify scenario library header into runtime create and switch actions', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildScenarioAuthorityProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-verify'));

    await act(async () => {
      fireEvent.click(await findVerifyRunAction(view));
    });

    await waitFor(() => {
      expect(view.getByTestId('ide-testbench-documents')).toBeTruthy();
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

    fireEvent.click(await view.findByTestId(`ide-testbench-document-tab-${defaultScenarioId}`));

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
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await act(async () => {
      useProjectRuntime.getState().loadFromProject(buildDraftAuthoringProject());
    });

    fireEvent.click(await view.findByTestId('mode-button-verify'));

    await waitFor(() => {
      expect(view.getByTestId('ide-vcb-run')).toBeTruthy();
    });

    fireEvent.click(view.getByTestId('ide-verify-generate-basic-vectors'));

    await waitFor(() => {
      const state = useProjectRuntime.getState();
      expect(state.projectVectors.length).toBeGreaterThan(0);
      expect(state.projectVectors.every((vector) => Object.keys(vector.expected ?? {}).length === 0)).toBe(true);
    });

    expect(view.queryByTestId('ide-verify-session-mode')).toBeNull();
    expect(view.queryByTestId('ide-verify-session-title')).toBeNull();
    expect(view.getByTestId('ide-vcb-run')).toBeTruthy();
  });

  it('detaches starter examples without leaving Verify stuck in starter compare mode', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await view.findByTestId('ide-project-landing');
    fireEvent.click(await view.findByTestId('ide-project-landing-example-logic-gates'));

    await waitFor(() => {
      expect(view.queryByTestId('ide-example-confirm-modal')).toBeNull();
    });

    await waitFor(() => {
      expect(useProjectRuntime.getState().activeExampleId).toBe('logic-gates');
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

    expect(view.getByTestId('ide-vcb-author-expected')).toBeTruthy();
    expect(view.getByTestId('ide-vcb-use-saved-checks')).toBeDisabled();
    expect(view.queryByTestId('ide-verify-session-mode')).toBeNull();
    expect(view.queryByTestId('ide-verify-session-title')).toBeNull();
    expect(view.getByTestId('ide-vcb-run')).toBeTruthy();
  });

  it('loads the Lab 8 starter directly into Design with visible starter authority', async () => {
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await view.findByTestId('ide-project-landing');
    fireEvent.click(await view.findByTestId('ide-project-lab-card-lab8-security-lock-fsm'));

    await waitFor(() => {
      expect(activeModeText(view)).toContain('Design');
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
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);

    await view.findByTestId('ide-project-landing');
    fireEvent.click(await view.findByTestId('ide-project-landing-example-half-adder'));

    await waitFor(() => {
      expect(activeModeText(view)).toContain('Design');
    });

    fireEvent.click(await view.findByTestId('mode-button-project'));

    await waitFor(() => {
      expect(activeModeText(view)).toContain('Project');
    });

    await view.findByTestId('ide-project-panel', {}, { timeout: 5000 });
    fireEvent.click(await view.findByTestId('ide-menu-file'));
    fireEvent.click(await view.findByTestId('ide-menu-item-project.open-starter'));
    fireEvent.click(await view.findByTestId('ide-project-load-start-logic-gates', {}, { timeout: 5000 }));

    await waitFor(() => {
      expect(view.getByTestId('ide-example-confirm-modal')).toBeTruthy();
    });

    expect(activeModeText(view)).toContain('Project');
    expect(useProjectRuntime.getState().activeExampleId).not.toBe('logic-gates');

    fireEvent.click(view.getByTestId('ide-example-confirm'));

    await waitFor(() => {
      expect(activeModeText(view)).toContain('Design');
    });

    await waitFor(() => {
      expect(useProjectRuntime.getState().activeExampleId).toBe('logic-gates');
    });

    expect((await view.findByTestId('ide-design-starter-banner-title', {}, { timeout: 5000 })).textContent).toContain(
      'Logic Gates'
    );
  });
});
