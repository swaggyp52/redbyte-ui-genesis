// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  ProjectBridgePanel,
  type ProjectBridgePanelProps,
} from '../components/ProjectBridgePanel';
import type { ProjectHealth } from '../projectHealth';

function makeHealth(overrides: Partial<ProjectHealth> = {}): ProjectHealth {
  return {
    lastVerify: undefined,
    lastExport: undefined,
    dirtySinceVerify: false,
    dirtySinceExport: false,
    blockingIssues: [],
    ...overrides,
  } as ProjectHealth;
}

function makeProps(overrides: Partial<ProjectBridgePanelProps> = {}): ProjectBridgePanelProps {
  return {
    projectName: 'My Project',
    projectKind: 'custom',
    sourceExampleId: null,
    determinismHash: 'abc123def456789',
    topModuleName: 'top',
    simulationTopName: null,
    fpgaBoard: 'Basys3',
    fpgaPart: 'xc7a35tcpg236-1',
    importFidelity: 'native',
    scenarioAuthority: 'none',
    health: makeHealth(),
    readiness: {
      hasCircuit: true,
      hasIoMapping: true,
      hasVectors: true,
      missingRequiredCount: 0,
    },
    hardwareReady: false,
    blockingIssueCount: 0,
    ...overrides,
  };
}

describe('ProjectBridgePanel', () => {
  it('renders project identity, design top, and target part', () => {
    const { getByTestId } = render(<ProjectBridgePanel {...makeProps()} />);
    expect(getByTestId('ide-project-bridge-title').textContent).toContain('My Project');
    expect(getByTestId('ide-project-bridge-subtitle').textContent).toContain('Custom Project');
    expect(getByTestId('ide-project-bridge-design-top').textContent).toContain('top');
    expect(getByTestId('ide-project-bridge-part').textContent).toContain('xc7a35tcpg236-1');
    expect(getByTestId('ide-project-bridge-board').textContent).toContain('Basys3');
  });

  it('truncates the determinism hash to 12 characters', () => {
    const { getByTestId } = render(<ProjectBridgePanel {...makeProps()} />);
    expect(getByTestId('ide-project-bridge-hash').textContent).toBe('abc123def456');
  });

  it('reports native fidelity for custom/blank projects', () => {
    const { getByTestId } = render(<ProjectBridgePanel {...makeProps()} />);
    expect(getByTestId('ide-project-bridge-fidelity').textContent).toContain('Native');
    expect(getByTestId('ide-project-bridge-fidelity-hint').textContent).toContain('No external reconstruction');
  });

  it('marks reconstructed imports as warn with explanatory hint', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel {...makeProps({ projectKind: 'import', importFidelity: 'reconstructed' })} />
    );
    expect(getByTestId('ide-project-bridge-fidelity').textContent).toContain('Reconstructed');
    expect(getByTestId('ide-project-bridge-fidelity-hint').textContent).toContain('rebuilt from HDL');
  });

  it('flags partial imports as error with inspection-only copy', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel {...makeProps({ projectKind: 'import', importFidelity: 'partial' })} />
    );
    expect(getByTestId('ide-project-bridge-fidelity').textContent).toContain('Partial');
    expect(getByTestId('ide-project-bridge-fidelity-hint').textContent).toContain('inspection-only');
  });

  it('shows "same as design" when simulation top is not distinct', () => {
    const { getByTestId } = render(<ProjectBridgePanel {...makeProps()} />);
    expect(getByTestId('ide-project-bridge-sim-top').textContent).toContain('same as design');
  });

  it('shows a distinct simulation top when provided', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel {...makeProps({ topModuleName: 'top', simulationTopName: 'tb_top' })} />
    );
    expect(getByTestId('ide-project-bridge-sim-top').textContent).toContain('tb_top');
  });

  it('labels verify state as Not run when no verify has happened', () => {
    const { getByTestId } = render(<ProjectBridgePanel {...makeProps()} />);
    expect(getByTestId('ide-project-bridge-verify').textContent).toContain('Not run');
  });

  it('labels verify state as Stale when dirty since verify', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel
        {...makeProps({
          health: makeHealth({
            lastVerify: {
              status: 'pass',
              hash: 'v1234567890abcdef',
              reportHash: 'r1',
              ranAtIso: '2026-02-01T00:00:00.000Z',
            } as ProjectHealth['lastVerify'],
            dirtySinceVerify: true,
          }),
        })}
      />
    );
    const verify = getByTestId('ide-project-bridge-verify').textContent ?? '';
    expect(verify).toContain('Stale');
    expect(verify).toContain('v1234567890');
  });

  it('labels export as Stale bundle when dirty since export', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel
        {...makeProps({
          health: makeHealth({
            lastExport: {
              status: 'ok',
              hash: 'export-hash-12345',
              builtAtIso: '2026-02-10T00:00:00.000Z',
            } as ProjectHealth['lastExport'],
            dirtySinceExport: true,
          }),
        })}
      />
    );
    expect(getByTestId('ide-project-bridge-export').textContent).toContain('Stale bundle');
  });

  it('reports "Ready for bring-up" without claiming hardware is proven', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel {...makeProps({ hardwareReady: true })} />
    );
    const hw = getByTestId('ide-project-bridge-hardware-callout').textContent ?? '';
    expect(hw).toContain('Ready for bring-up');
    // Truthfulness contract: never claim hardware is actually proven from app state alone.
    expect(hw).toContain('has not been proven');
    expect(hw.toLowerCase()).not.toContain('lab-proven');
  });

  it('reports "Pins unmapped" when required pins are missing', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel {...makeProps({ readiness: { hasCircuit: true, hasIoMapping: false, hasVectors: false, missingRequiredCount: 3 } })} />
    );
    expect(getByTestId('ide-project-bridge-hardware-pill').textContent).toContain('PINS UNMAPPED');
    expect(getByTestId('ide-project-bridge-hardware-callout').textContent).toContain('3 required pins are still unmapped');
  });

  it('shows the blocking issue count when > 0', () => {
    const { getByTestId } = render(
      <ProjectBridgePanel {...makeProps({ blockingIssueCount: 2 })} />
    );
    expect(getByTestId('ide-project-bridge-blocking-count').textContent).toContain('2 blocking issues');
  });
});
