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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { useProjectRuntime } from '../projectRuntime';

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
  });

  it('routes to Design after a successful import callback', async () => {
    const view = render(<IdeApp />);

    // Land on the Import surface (stub).
    await view.findByTestId('ide-import-panel', {}, { timeout: 5000 });
    expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Import');

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
        expect(view.getByTestId('ide-topbar-mode-label').textContent).toContain('Design');
      },
      { timeout: 10000 }
    );
  }, 30000);
});
