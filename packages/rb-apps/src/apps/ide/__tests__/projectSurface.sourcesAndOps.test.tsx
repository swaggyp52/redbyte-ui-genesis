// @vitest-environment jsdom
/**
 * Project sources-and-operations contract: the explorer shows real per-module
 * instance counts and a derived VHDL compile order when the hierarchy has
 * modules, and Duplicate project writes an independent copy into the
 * project repository without switching the active session.
 */
import React from 'react';
import { ThemeProvider } from '@redbyte/rb-theme';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { BoardSignalProvider } from '../BoardSignalContext';
import { ProjectSurface, type ProjectSurfaceProps } from '../surfaces/ProjectSurface';
import type { RBProject } from '../../../export/projectFormat';
import { saveIdeProjectSnapshot } from '../projectPersistence';
import { saveLabSessionMeta } from '../persistence/labSession';
import { useProjectRuntime } from '../projectRuntime';
import { projectRepository } from '../projectRepository';
import { IdeApp } from '../../IdeApp';

afterEach(cleanup);

function makeLoadedProps(): ProjectSurfaceProps {
  return {
    projectName: 'Adder Lab',
    description: 'Ripple adder project.',
    determinismHash: 'abc123def4567890',
    topModuleName: 'adder_top',
    lastSavedAt: new Date().toISOString(),
    simRunning: false,
    readiness: {
      hasCircuit: true,
      hasIoMapping: false,
      hasVectors: true,
      verifyPass: true,
      missingRequiredCount: 0,
    },
    health: {
      lastVerify: { status: 'pass', hash: 'h', reportHash: 'r', ranAtIso: '2026-07-14T00:00:00.000Z' },
      lastExport: undefined,
      dirtySinceVerify: false,
      dirtySinceExport: false,
      blockingIssues: [],
    },
    mappingRows: [],
    examples: [],
    activeExampleId: null,
    onOpenExample: vi.fn(),
    primaryCtaLabel: 'Board & Constraints',
    primaryCta: { label: 'Board & Constraints', mode: 'hardware', code: 'RBP1001' },
    onPrimaryCta: vi.fn(),
    onUpdateMappingPin: vi.fn(),
    onAutoSuggestMapping: vi.fn(),
    onOpenDesign: vi.fn(),
    onOpenVerify: vi.fn(),
    onOpenExport: vi.fn(),
    onOpenHardware: vi.fn(),
    onOpenImport: vi.fn(),
    recentProjects: [],
    onOpenSavedProjects: vi.fn(),
    onOpenRecentProject: vi.fn(),
    onSaveNow: vi.fn(),
    saveState: 'saved',
    fpgaConfig: { board: 'Basys3', part: 'xc7a35tcpg236-1', top: 'adder_top' },
    onFpgaConfigChange: vi.fn(),
    circuit: {
      nodes: [
        { id: 'inst_fa1', type: 'FullAdderModule', label: 'u_fa1', x: 0, y: 0, config: { moduleDefinitionId: 'mod-fa' } },
        { id: 'inst_fa2', type: 'FullAdderModule', label: 'u_fa2', x: 100, y: 0, config: { moduleDefinitionId: 'mod-fa' } },
      ],
      connections: [],
    } as ProjectSurfaceProps['circuit'],
    hierarchy: {
      topModuleId: 'top',
      activeModuleId: 'top',
      modules: [
        {
          id: 'mod-fa',
          name: 'FullAdderModule',
          displayName: 'FullAdderModule',
          ports: [],
          circuit: { nodes: [], connections: [] },
        },
      ],
    } as unknown as ProjectSurfaceProps['hierarchy'],
    outline: {
      nodeCount: 2,
      connectionCount: 0,
      boundaryInputCount: 0,
      boundaryOutputCount: 0,
      nodeTypeBreakdown: [],
      macros: [],
      customComponents: [],
      inputIoRows: [],
      outputIoRows: [],
    },
  };
}

describe('Project explorer sources view', () => {
  it('shows per-module instance counts and the derived compile order', () => {
    const view = render(
      <BoardSignalProvider>
        <ProjectSurface {...makeLoadedProps()} />
      </BoardSignalProvider>
    );

    const explorer = view.getByTestId('ide-project-explorer');
    expect(explorer.textContent).toContain('2 instances');

    const compileOrder = view.getByTestId('ide-project-compile-order');
    expect(compileOrder.textContent).toContain('FullAdderModule.vhd');
    expect(compileOrder.textContent).toContain('adder_top.vhd');
    expect(compileOrder.textContent).toContain('instantiates FullAdderModule');
    // Modules compile before the structural top that instantiates them.
    const moduleIndex = compileOrder.textContent!.indexOf('FullAdderModule.vhd');
    const topIndex = compileOrder.textContent!.indexOf('adder_top.vhd');
    expect(moduleIndex).toBeGreaterThanOrEqual(0);
    expect(topIndex).toBeGreaterThan(moduleIndex);
  });
});

describe('Duplicate project operation', () => {
  const PROJECT_ID = 'rb-duplicate-contract';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.history.replaceState({}, '', '/os/');
  });

  it('writes an independent repository copy and keeps the session on the original', async () => {
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      name: 'Duplicate Source Lab',
      circuit: {
        nodes: [
          { id: 'dup_in', type: 'INPUT', label: 'A', x: 0, y: 0 },
          { id: 'dup_out', type: 'OUTPUT', label: 'Y', x: 200, y: 0 },
        ],
        connections: [
          { from: { nodeId: 'dup_in', portName: 'out' }, to: { nodeId: 'dup_out', portName: 'in' } },
        ],
      },
      ioMapping: {
        inputs: [{ id: 'a', nodeId: 'dup_in', port: 'out', label: 'A', pin: 'V17' }],
        outputs: [{ id: 'y', nodeId: 'dup_out', port: 'in', label: 'Y', pin: 'U16' }],
      },
      vectors: [],
      meta: { projectId: PROJECT_ID, projectKind: 'custom', scenarioAuthority: 'authored' },
    };
    expect(
      saveIdeProjectSnapshot({
        projectId: PROJECT_ID,
        projectName: project.name,
        projectHash: 'duplicate-contract-hash',
        project,
        scenarios: [],
      })
    ).not.toBeNull();
    saveLabSessionMeta({
      version: 1,
      savedAt: Date.now(),
      projectId: PROJECT_ID,
      currentMode: 'project',
      activeExampleId: null,
      projectKind: 'custom',
      scenarioAuthority: 'authored',
      probedKeys: [],
    });

    const view = render(
      <ThemeProvider>
        <IdeApp />
      </ThemeProvider>
    );
    await waitFor(
      () => {
        expect(useProjectRuntime.getState().projectName).toBe('Duplicate Source Lab');
        expect(view.getByTestId('ide-session-duplicate')).toBeTruthy();
      },
      { timeout: 5000 }
    );

    fireEvent.click(view.getByTestId('ide-session-duplicate'));

    await waitFor(() => {
      const listed = projectRepository.list();
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      const names = listed.value.projects.map((entry) => entry.projectName);
      expect(names).toContain('Duplicate Source Lab');
      expect(names).toContain('Duplicate Source Lab copy');
    });
    // The active session stays on the original project.
    expect(useProjectRuntime.getState().projectName).toBe('Duplicate Source Lab');
  });
});
