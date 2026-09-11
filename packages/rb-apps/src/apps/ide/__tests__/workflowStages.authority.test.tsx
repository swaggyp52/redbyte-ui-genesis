// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { WorkspaceRail } from '../components/WorkspaceRail';
import { WorkbenchCommandBar } from '../components/WorkbenchCommandBar';
import { IDE_COMMAND_IDS, createIdeCommandRegistry, type IdeCommand } from '../ideCommandRegistry';
import {
  IDE_MODE_DEFINITIONS,
  STUDENT_WORKFLOW_STAGES,
  STUDENT_WORKFLOW_SUMMARY,
} from '../workflowStages';

type Ctx = { hasCircuit: boolean };

function registryWith(overrides: Partial<Record<string, () => void>> = {}) {
  const noop = () => {};
  const commands: IdeCommand<Ctx>[] = [
    { id: IDE_COMMAND_IDS.openProject, title: 'Open Existing Project...', category: 'project', keywords: [], execute: overrides.openProject ?? noop },
    { id: IDE_COMMAND_IDS.saveProject, title: 'Save Project', category: 'project', keywords: [], shortcut: { key: 's', modifiers: ['primary'], label: 'Ctrl S' }, execute: noop },
    { id: IDE_COMMAND_IDS.resetWorkspaceLayout, title: 'Restore Default Workspace Layout', category: 'workspace', keywords: [], execute: overrides.resetWorkspace ?? noop },
    { id: IDE_COMMAND_IDS.openHelp, title: 'Open Help and Keyboard Shortcuts', category: 'help', keywords: [], shortcut: { key: '?', label: '?' }, execute: overrides.help ?? noop },
    { id: IDE_COMMAND_IDS.runSimulation, title: 'Run Simulation (Observe)', category: 'simulation', keywords: [], availability: (ctx) => ctx.hasCircuit ? { state: 'available' } : { state: 'disabled', reason: 'Open a project with a design first.' }, execute: noop },
  ];
  return createIdeCommandRegistry(commands);
}

describe('workflow stage authority', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the five workspaces once, in spine order, on the workspace rail', () => {
    const view = render(<WorkspaceRail currentMode="hardware" onModeChange={vi.fn()} />);
    const buttons = view.container.querySelectorAll('[role="tablist"] [data-testid^="mode-button-"]');
    expect(Array.from(buttons).map((b) => b.getAttribute('data-stage'))).toEqual([
      'project',
      'design',
      'verify',
      'hardware',
      'export',
    ]);
    expect(view.getByTestId('mode-button-hardware')).toHaveAttribute('aria-selected', 'true');
    expect(view.getByTestId('mode-button-hardware')).toHaveAttribute('data-state', 'current');
    // Terse rail labels; the full stage names are document titles, not rail chrome.
    expect(view.getByTestId('mode-button-hardware').textContent).toBe('Board');
    // No completion marks, no status subtitles, no stage numbers.
    expect(view.container.textContent).not.toMatch(/✓|Step \d|Loaded|Not run|assigned/);
  });

  it('keeps Import / Recover as a utility below the workspaces and shows a blocked dot only when actionable', () => {
    const onModeChange = vi.fn();
    const view = render(
      <WorkspaceRail currentMode="design" onModeChange={onModeChange} stepsBlocked={{ export: true, design: true }} />
    );
    const importButton = view.getByTestId('mode-button-import');
    expect(importButton.closest('[role="tablist"]')).toBeNull();
    fireEvent.click(importButton);
    expect(onModeChange).toHaveBeenCalledWith('import');
    expect(view.getByTestId('mode-button-export')).toHaveAttribute('data-state', 'blocked');
    // The current workspace never shows itself as blocked.
    expect(view.getByTestId('mode-button-design')).toHaveAttribute('data-state', 'current');
  });

  it('command bar exposes identity, save state, palette, Save, and real menus', () => {
    const help = vi.fn();
    const view = render(
      <WorkbenchCommandBar
        projectName="Adder"
        saveState="saved"
        buildIdentity={{ fullSha: 'abcdef123456', shortSha: 'abcdef1', buildDate: null, envLabel: 'dev', title: 'Build abcdef1 · env dev', branch: 'local', runtime: 'node', devUrl: 'http://localhost:5173' }}
        registry={registryWith({ help })}
        context={{ hasCircuit: false }}
        onSave={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onRenameProject={vi.fn()}
      />
    );

    // The board target is a status-bar fact; the command bar never repeats it.
    expect(view.queryByTestId('ide-board-chip')).toBeNull();
    expect(view.getByTestId('ide-top-bar')).toHaveAttribute('data-build-sha', 'abcdef1');
    expect(view.getByTestId('ide-save-state').getAttribute('aria-label')).toBe('saved');
    expect(view.getByTestId('ide-topbar-save-btn').textContent).toBe('Save');
    expect(view.getByTestId('ide-topbar-project-rename').textContent).toBe('Adder');

    // Menus are derived from the registry; opening Help and executing the item runs the command.
    fireEvent.click(view.getByTestId('ide-menu-help'));
    fireEvent.click(view.getByTestId(`ide-menu-item-${IDE_COMMAND_IDS.openHelp}`));
    expect(help).toHaveBeenCalledTimes(1);
    // The menu closes after an action so it cannot obstruct the workspace.
    expect(view.queryByTestId('ide-menu-help-popup')).toBeNull();
  });

  it('menu items honour command availability and carry the disabled reason', () => {
    const view = render(
      <WorkbenchCommandBar
        projectName="Adder"
        saveState="unsaved"
        registry={registryWith()}
        context={{ hasCircuit: false }}
      />
    );
    fireEvent.click(view.getByTestId('ide-menu-run'));
    const item = view.getByTestId(`ide-menu-item-${IDE_COMMAND_IDS.runSimulation}`);
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item.getAttribute('title')).toContain('Open a project with a design first.');
  });

  it('keeps import out of the student-facing mode definitions', () => {
    expect(IDE_MODE_DEFINITIONS.map((definition) => definition.id)).toEqual([
      'project',
      'design',
      'verify',
      'hardware',
      'export',
    ]);
  });

  it('uses one five-stage authority for flow order and labels', () => {
    expect(STUDENT_WORKFLOW_STAGES.map((stage) => stage.id)).toEqual([
      'project',
      'design',
      'verify',
      'hardware',
      'export',
    ]);
    expect(STUDENT_WORKFLOW_SUMMARY).toBe(
      'Project → Design → Simulate → Board & Constraints → Build & Export',
    );
  });
});
