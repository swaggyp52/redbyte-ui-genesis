// @vitest-environment jsdom

/**
 * Narrowed scope: prove that a successful Import routes the IDE to Design.
 *
 * Background: handleImportProject in IdeApp.tsx already calls
 * handleSafeLoadIntoIde (which calls loadFromProject) — so the circuit IS
 * loaded into runtime state on import. What was missing: no nextMode hint, so
 * the user stayed on the Import surface and the import felt invisible. Adding
 * `nextMode: 'design'` to the handleSafeLoadIntoIde options closes that gap.
 * This test guards that gap.
 *
 * Implementation: rather than driving the full ImportSurface UI (sample-load
 * → review → confirm), we mock ImportSurface with a thin test stub that
 * exposes its `onImportProject` prop as a button. Clicking the stub button
 * fires the same callback the real ImportSurface fires after a successful
 * apply. That is exactly the seam handleImportProject sits behind, so this
 * test proves the IdeApp wiring directly.
 */

import React from 'react';
import { ThemeProvider } from '@redbyte/rb-theme';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { saveIdeProjectSnapshot } from '../projectPersistence';
import { useProjectRuntime } from '../projectRuntime';
import { saveLabSessionMeta } from '../persistence/labSession';
import type { VerifyScenario } from '../verifyScenario';

// Mock the ImportSurface module so the IdeApp render under test calls a stub
// instead of the real lazy-loaded component. The stub captures the
// `onImportProject` prop and exposes it as a click target with a known testid.
vi.mock('../surfaces/ImportSurface', () => {
  return {
    ImportSurface: (props: { onImportProject?: (project: RBProject) => void }) => {
      const fixtureProject: RBProject = {
        kind: 'rb-project',
        version: 1,
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        name: 'Stub Imported Project',
        description: 'Fixture used by the import-navigates-to-design test.',
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
              position: { x: 200, y: 0 },
              x: 200,
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
        hdl: {
          top: 'student_top',
          sources: [
            {
              path: 'rtl/student_top.vhd',
              language: 'vhdl',
              text: 'entity student_top is end entity;',
            },
            {
              path: 'rtl/helper.v',
              language: 'verilog',
              text: 'module helper; endmodule',
            },
          ],
        },
        ioMapping: {
          inputs: [{ id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', pin: 'SW0' }],
          outputs: [{ id: 'ld0', nodeId: 'ld0_node', port: 'in', label: 'ld0', pin: 'LD0' }],
        },
        vectors: [],
        meta: { projectId: 'rb-stub-imported-project' },
      };
      return (
        <div data-testid="ide-import-panel">
          <button
            type="button"
            data-testid="ide-import-test-fire"
            onClick={() => props.onImportProject?.(fixtureProject)}
          >
            Fire onImportProject (test stub)
          </button>
        </div>
      );
    },
  };
});

// Import IdeApp AFTER the mock is registered so the lazy import resolves to
// the stub. The vi.mock above is hoisted by Vitest, but keeping the dynamic
// import here makes the order explicit.
import { IdeApp } from '../../IdeApp';

function seedImportRoute() {
  window.history.replaceState({}, '', '/os/?mode=import');
}

function renderIdeApp() {
  return render(
    <ThemeProvider>
      <IdeApp />
    </ThemeProvider>
  );
}

function failRecoverySnapshotWrites() {
  const originalSetItem = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key: string,
    value: string
  ) {
    if (key.startsWith('rb.ide.project.v1:backup-')) {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    }
    return originalSetItem.call(this, key, value);
  });
}

function buildLifecycleProject(projectId: string, name: string, stem: string): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    name,
    circuit: {
      nodes: [
        { id: `${stem}_input`, type: 'INPUT', label: 'A', x: 0, y: 0 },
        { id: `${stem}_output`, type: 'OUTPUT', label: 'Y', x: 200, y: 0 },
      ],
      connections: [
        {
          from: { nodeId: `${stem}_input`, portName: 'out' },
          to: { nodeId: `${stem}_output`, portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'a', nodeId: `${stem}_input`, port: 'out', label: 'A', pin: 'V17' }],
      outputs: [{ id: 'y', nodeId: `${stem}_output`, port: 'in', label: 'Y', pin: 'U16' }],
    },
    vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 1 } }],
    meta: { projectId, projectKind: 'custom', scenarioAuthority: 'authored' },
  };
}

describe('IdeApp: import navigates to Design after success', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    seedImportRoute();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('routes to Design after a successful import callback', async () => {
    const view = renderIdeApp();

    // Land on the Import surface (stub).
    await view.findByTestId('ide-import-panel', {}, { timeout: 5000 });
    expect(view.getByTestId('mode-button-import')).toHaveAttribute('data-state', 'current');

    // Fire the success callback exactly as the real ImportSurface would.
    fireEvent.click(view.getByTestId('ide-import-test-fire'));

    // First sanity-check: loadFromProject ran successfully → runtime store
    // holds the imported circuit. This isolates "did import apply at all?"
    // from "did navigation happen?".
    await waitFor(
      () => {
        const state = useProjectRuntime.getState();
        expect(state.circuit.nodes.length).toBeGreaterThan(0);
        expect(state.projectKind).toBe('import');
      },
      { timeout: 10000 }
    );

    // Now the navigation assertion: IdeApp.handleImportProject runs
    // handleSafeLoadIntoIde with the new nextMode: 'design' option — topbar
    // should reflect the mode change.
    await waitFor(
      () => {
        expect(view.getByTestId('mode-button-design')).toHaveAttribute('aria-selected', 'true');
      },
      { timeout: 10000 }
    );

    fireEvent.click(
      await view.findByTestId('ide-design-left-tab-sources', {}, { timeout: 10000 })
    );
    expect(
      view
        .getAllByTestId('ide-design-source-hdl-source')
        .map((entry) => entry.querySelector('strong')?.textContent)
    ).toEqual([
      'rtl/student_top.vhd',
      'rtl/helper.v',
    ]);
  }, 30000);

  it('leaves current work untouched when its recovery checkpoint cannot be written', async () => {
    const currentProject = buildLifecycleProject('rb-current-work', 'Current Work', 'current');
    useProjectRuntime.getState().loadFromProject(currentProject);
    failRecoverySnapshotWrites();

    const view = renderIdeApp();
    await view.findByTestId('ide-import-panel', {}, { timeout: 5000 });
    fireEvent.click(view.getByTestId('ide-import-test-fire'));

    await waitFor(() => {
      expect(useProjectRuntime.getState().lastSavedAt).toContain('Current work was left unchanged');
    });
    expect(useProjectRuntime.getState().projectId).toBe('rb-current-work');
    expect(useProjectRuntime.getState().circuit.nodes.map((node) => node.id)).toEqual([
      'current_input',
      'current_output',
    ]);
  });

  it('fails closed when Build Fresh cannot create its recovery snapshot', async () => {
    window.history.replaceState({}, '', '/os/?mode=project');
    const currentProject = buildLifecycleProject('rb-build-fresh-current', 'Build Fresh Current', 'build_fresh');
    useProjectRuntime.getState().loadFromProject(currentProject);
    failRecoverySnapshotWrites();

    const view = renderIdeApp();
    fireEvent.click(await view.findByTestId('ide-project-change-project'));
    fireEvent.click(await view.findByTestId('ide-project-path-build-fresh'));
    fireEvent.click(await view.findByTestId('ide-project-build-fresh-confirm'));

    await waitFor(() => {
      expect(useProjectRuntime.getState().lastSavedAt).toContain('Current work was left unchanged');
    });
    expect(useProjectRuntime.getState().projectId).toBe('rb-build-fresh-current');
    expect(useProjectRuntime.getState().circuit.nodes.map((node) => node.id)).toEqual([
      'build_fresh_input',
      'build_fresh_output',
    ]);
  });

  it('keeps newer hydrated runtime work when the debounced repository snapshot is older', async () => {
    window.history.replaceState({}, '', '/os/');
    const projectId = 'rb-reload-race';
    const staleProject = buildLifecycleProject(projectId, 'Stale Repository Project', 'stale');
    expect(
      saveIdeProjectSnapshot({
        projectId,
        projectName: staleProject.name,
        projectHash: 'stale-repository-hash',
        project: staleProject,
        scenarios: [],
      })
    ).not.toBeNull();

    const freshProject = buildLifecycleProject(projectId, 'Fresh Hydrated Project', 'fresh');
    const freshScenario: VerifyScenario = {
      id: 'fresh-scenario',
      name: 'Fresh scenario',
      vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 1 } }],
      probes: [{ key: 'fresh_input.out', label: 'Fresh input' }],
      version: 1,
      createdAt: '2026-08-01T00:01:00.000Z',
      updatedAt: '2026-08-01T00:01:00.000Z',
    };
    useProjectRuntime.getState().loadFromProject(freshProject, {
      scenarios: [freshScenario],
      activeScenarioId: freshScenario.id,
    });
    saveLabSessionMeta({
      version: 1,
      savedAt: Date.now(),
      projectId,
      currentMode: 'verify',
      activeExampleId: null,
      projectKind: 'custom',
      scenarioAuthority: 'authored',
      probedKeys: ['fresh_input.out'],
    });

    const view = renderIdeApp();

    await waitFor(() => {
      expect(view.getByTestId('ide-root').getAttribute('data-ide-stage')).toBe('verify');
      expect(useProjectRuntime.getState().projectName).toBe('Fresh Hydrated Project');
    });
    expect(useProjectRuntime.getState().circuit.nodes.map((node) => node.id)).toEqual([
      'fresh_input',
      'fresh_output',
    ]);
    expect(useProjectRuntime.getState().scenarios[0]).toMatchObject({
      id: 'fresh-scenario',
      probes: [{ key: 'fresh_input.out', label: 'Fresh input' }],
      vectors: [{ expected: { y: 1 } }],
    });
  });
});
