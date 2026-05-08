// @vitest-environment jsdom
// Contract tests for IdeLeftRail stage grammar:
// - exactly 5 nav buttons: project, design, verify, hardware, export
// - no import navigation button (Import is now a utility action, not a stage)
// - no program navigation button (Program is an external handoff, not a stage)
// - no HQ navigation button (Marcus is a separate local companion app)

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { IdeLeftRail } from '../components/IdeLeftRail';
import { STUDENT_WORKFLOW_SPINE } from '../workflowStages';

describe('IdeLeftRail stage grammar', () => {
  it('renders the Project navigation button', () => {
    const { getByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(getByTestId('mode-button-project')).toBeDefined();
  });

  it('does NOT render an HQ utility button', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('mode-button-hq')).toBeNull();
  });

  it('renders all four workflow stage buttons: design, verify, hardware, export', () => {
    const { getByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(getByTestId('mode-button-design')).toBeDefined();
    expect(getByTestId('mode-button-verify')).toBeDefined();
    expect(getByTestId('mode-button-hardware')).toBeDefined();
    expect(getByTestId('mode-button-export')).toBeDefined();
  });

  it('does NOT render an Import navigation button', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('mode-button-import')).toBeNull();
  });

  it('does NOT render a Program navigation button', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('mode-button-program')).toBeNull();
  });

  it('renders exactly 5 interactive navigation buttons (project + 4 workflow stages)', () => {
    const { container } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    const modeButtons = container.querySelectorAll('[data-testid^="mode-button-"]');
    expect(modeButtons).toHaveLength(5);
  });

  it('does NOT render the legacy bottom-left rail expander', () => {
    const { queryByTestId } = render(
      <IdeLeftRail currentMode="design" onModeChange={vi.fn()} />
    );
    expect(queryByTestId('ide-rail-collapse-toggle')).toBeNull();
  });
});

describe('STUDENT_WORKFLOW_SPINE stage grammar', () => {
  it('has exactly 4 stages: Design, Verify, Map Pins, Export', () => {
    expect(STUDENT_WORKFLOW_SPINE).toHaveLength(4);
    expect(STUDENT_WORKFLOW_SPINE[0]).toBe('Design');
    expect(STUDENT_WORKFLOW_SPINE[1]).toBe('Verify');
    expect(STUDENT_WORKFLOW_SPINE[2]).toBe('Map Pins');
    expect(STUDENT_WORKFLOW_SPINE[3]).toBe('Export');
  });

  it('does NOT include Program in the student workflow spine', () => {
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('Program');
  });

  it('does NOT include Import in the student workflow spine', () => {
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('Import');
  });

  it('does NOT include HQ in the student workflow spine', () => {
    expect(STUDENT_WORKFLOW_SPINE).not.toContain('HQ');
  });
});
