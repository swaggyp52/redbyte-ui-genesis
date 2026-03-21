// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { IdeApp } from '../../IdeApp';
import { useProjectRuntime } from '../projectRuntime';

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
});
