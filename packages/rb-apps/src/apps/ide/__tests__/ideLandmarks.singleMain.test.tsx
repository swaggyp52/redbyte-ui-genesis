// @vitest-environment jsdom

/**
 * Landmark contract: the composed IDE exposes exactly ONE visible <main>
 * landmark on every primary surface. IdeWorkbenchShell owns the application
 * <main> (data-testid="ide-mode-body"); no surface may nest a second visible
 * <main> inside it. Assistive-tech users navigate by landmark — a nested
 * duplicate main makes the page structure ambiguous.
 *
 * The lazy-surface loading fallback in IdeApp renders its own transient
 * <main> BEFORE a surface chunk mounts (never alongside one), so each case
 * waits for the loading shell to clear before counting.
 */

import React from 'react';
import { ThemeProvider } from '@redbyte/rb-theme';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { RBProject } from '../../../export/projectFormat';
import { saveIdeProjectSnapshot } from '../projectPersistence';
import { saveLabSessionMeta } from '../persistence/labSession';
import { useProjectRuntime } from '../projectRuntime';
import { IdeApp } from '../../IdeApp';

const PROJECT_ID = 'rb-landmark-contract';

function buildLoadedProject(): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    name: 'Landmark Contract Lab',
    circuit: {
      nodes: [
        { id: 'lm_input', type: 'INPUT', label: 'A', x: 0, y: 0 },
        { id: 'lm_output', type: 'OUTPUT', label: 'Y', x: 200, y: 0 },
      ],
      connections: [
        {
          from: { nodeId: 'lm_input', portName: 'out' },
          to: { nodeId: 'lm_output', portName: 'in' },
        },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'a', nodeId: 'lm_input', port: 'out', label: 'A', pin: 'V17' }],
      outputs: [{ id: 'y', nodeId: 'lm_output', port: 'in', label: 'Y', pin: 'U16' }],
    },
    vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 1 } }],
    meta: { projectId: PROJECT_ID, projectKind: 'custom', scenarioAuthority: 'authored' },
  };
}

function seedLoadedProjectAt(mode: 'project' | 'design' | 'verify' | 'hardware' | 'export'): void {
  const project = buildLoadedProject();
  expect(
    saveIdeProjectSnapshot({
      projectId: PROJECT_ID,
      projectName: project.name,
      projectHash: 'landmark-contract-hash',
      project,
      scenarios: [],
    })
  ).not.toBeNull();
  saveLabSessionMeta({
    version: 1,
    savedAt: Date.now(),
    projectId: PROJECT_ID,
    currentMode: mode,
    activeExampleId: null,
    projectKind: 'custom',
    scenarioAuthority: 'authored',
    probedKeys: [],
  });
}

function visibleMains(): HTMLElement[] {
  return Array.from(document.querySelectorAll('main')).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.closest('[hidden]') === null
  );
}

describe('IDE landmark contract: exactly one visible <main> per surface', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.history.replaceState({}, '', '/os/');
  });

  afterEach(cleanup);

  const surfaces = [
    ['project', 'Project'],
    ['design', 'Design'],
    ['verify', 'Simulate'],
    ['hardware', 'Board & Constraints'],
    ['export', 'Package & Handoff'],
  ] as const;

  for (const [mode] of surfaces) {
    it(`renders exactly one visible main landmark on the ${mode} surface`, async () => {
      seedLoadedProjectAt(mode);
      const view = render(
        <ThemeProvider>
          <IdeApp />
        </ThemeProvider>
      );

      await waitFor(
        () => {
          expect(useProjectRuntime.getState().projectName).toBe('Landmark Contract Lab');
          expect(view.getByTestId('ide-root').getAttribute('data-ide-stage')).toBe(mode);
        },
        { timeout: 5000 }
      );
      // Lazy surface chunk must be mounted (loading shell gone) before counting.
      await waitFor(
        () => {
          expect(document.querySelector('[data-testid="ide-surface-loading"]')).toBeNull();
          expect(visibleMains().length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );

      const mains = visibleMains();
      const described = mains.map(
        (el) => `<main class="${el.className}" data-testid="${el.getAttribute('data-testid') ?? ''}">`
      );
      expect(described, `expected one visible <main>, got: ${described.join(' + ')}`).toHaveLength(1);
      expect(mains[0].getAttribute('data-testid')).toBe('ide-mode-body');
    });
  }

  it('keeps the Project design-overview region present as a section, not a main', async () => {
    seedLoadedProjectAt('project');
    const view = render(
      <ThemeProvider>
        <IdeApp />
      </ThemeProvider>
    );
    const overview = await view.findByTestId('ide-project-design-overview', {}, { timeout: 5000 });
    expect(overview.tagName).not.toBe('MAIN');
    expect(overview.closest('main')?.getAttribute('data-testid')).toBe('ide-mode-body');
  });
});
