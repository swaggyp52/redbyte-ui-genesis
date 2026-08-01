// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { IdeStageNav } from '../components/IdeStageNav';
import { IdeTopBar } from '../components/IdeTopBar';
import {
  IDE_MODE_DEFINITIONS,
  STUDENT_WORKFLOW_STAGES,
  STUDENT_WORKFLOW_SUMMARY,
} from '../workflowStages';

describe('workflow stage authority', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.clear();
  });

  it('shows Board & Constraints as the hardware route label in the top bar and horizontal stage nav', () => {
    const topBar = render(
      <IdeTopBar
        projectName="Adder"
        saveState="saved"
        currentMode="hardware"
      />
    );
    expect(topBar.getByTestId('ide-topbar-mode-label').textContent).toBe('Board & Constraints');

    const stageNav = render(
      <IdeStageNav
        currentMode="hardware"
        onModeChange={vi.fn()}
      />
    );
    expect(stageNav.getByTestId('mode-button-hardware').textContent).toContain('Board & Constraints');
  });

  it('keeps top-bar context focused on project, board, save, Import, and Help', () => {
    const onHelp = vi.fn();
    const view = render(
      <IdeTopBar
        projectName="Adder"
        boardTarget="Basys3"
        saveState="saved"
        currentMode="design"
        buildIdentity={{
          fullSha: 'abcdef123456',
          shortSha: 'abcdef1',
          buildDate: null,
          envLabel: 'dev',
          title: 'Build abcdef1 · env dev',
        }}
        onHelp={onHelp}
        onSave={vi.fn()}
        onImport={vi.fn()}
      />
    );

    expect(view.getByTestId('ide-board-chip').textContent).toBe('BoardBasys3');
    expect(view.getByTestId('ide-top-bar')).toHaveAttribute('data-build-sha', 'abcdef1');
    expect(view.getByTestId('ide-save-state').getAttribute('aria-label')).toBe('saved');
    expect(view.getByTestId('ide-topbar-save-btn').textContent).toBe('Save');
    expect(view.getByTestId('mode-button-import').textContent).toBe('Import / Recover');
    expect(view.getByTestId('ide-topbar-help-btn').textContent).toBe('Help');
    expect(view.queryByTestId('ide-topbar-workflow-help-btn')).toBeNull();

    fireEvent.click(view.getByTestId('ide-topbar-help-btn'));
    expect(onHelp).toHaveBeenCalledTimes(1);
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

  it('closes top-bar menus after an action so they cannot obstruct the workspace', () => {
    const onResetWorkspace = vi.fn();
    const onLoad = vi.fn();
    const view = render(
      <IdeTopBar
        projectName="Adder"
        saveState="saved"
        currentMode="design"
        activeWorkspacePreset="authoring"
        onApplyWorkspacePreset={vi.fn()}
        onResetWorkspace={onResetWorkspace}
        onLoad={onLoad}
      />
    );

    const workspaceMenu = view.getByTestId('ide-workspace-menu') as HTMLDetailsElement;
    workspaceMenu.open = true;
    fireEvent.click(view.getByTestId('ide-workspace-reset'));
    expect(onResetWorkspace).toHaveBeenCalledTimes(1);
    expect(workspaceMenu.open).toBe(false);

    const projectMenu = view.getByTestId('ide-project-menu') as HTMLDetailsElement;
    projectMenu.open = true;
    fireEvent.click(view.getByText('Open project...'));
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(projectMenu.open).toBe(false);
  });

  it('uses one five-stage authority for horizontal flow order and labels', () => {
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
