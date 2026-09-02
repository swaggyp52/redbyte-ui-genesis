// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { WorkbenchStatusBar } from '../components/WorkbenchStatusBar';
import { WorkbenchDocumentTabStrip } from '../components/WorkbenchDocumentTabStrip';
import type { WorkbenchDocument } from '../workbenchDocuments';

afterEach(() => cleanup());

describe('WorkbenchStatusBar', () => {
  it('shows compact actionable state only — no support narration, no duplicated workspace status', () => {
    const onShowProblems = vi.fn();
    const view = render(
      <WorkbenchStatusBar
        problemsCount={2}
        onShowProblems={onShowProblems}
        runState={{ label: 'Simulation stale', tone: 'warn' }}
      />
    );
    const text = view.getByTestId('ide-status-bar').textContent ?? '';
    expect(text).not.toContain('Support');
    expect(text).not.toContain('Checks');
    // Project identity and save state are command-bar facts, never repeated here.
    expect(text).not.toContain('Full Adder');
    expect(text).not.toContain('Saved');
    expect(view.getByTestId('ide-status-run').textContent).toBe('Simulation stale');
    // The selected object and the target belong to the application frame bar, never the status line.
    expect(view.queryByTestId('ide-status-selection')).toBeNull();
    expect(view.queryByTestId('ide-status-target')).toBeNull();

    fireEvent.click(view.getByTestId('ide-status-problems'));
    expect(onShowProblems).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('ide-status-problems').textContent).toBe('2 problems');
  });

  it('omits run state when it does not exist', () => {
    const view = render(<WorkbenchStatusBar problemsCount={0} />);
    expect(view.queryByTestId('ide-status-run')).toBeNull();
    expect(view.getByTestId('ide-status-problems').textContent).toBe('No problems');
  });
});

describe('WorkbenchDocumentTabStrip', () => {
  const open: WorkbenchDocument[] = [
    { kind: 'project-overview' },
    { kind: 'schematic', moduleId: 'half_adder' },
    { kind: 'cases', scenarioId: 'scn-1' },
  ];

  it('renders typed tabs with live labels, activates, closes, and keeps the overview pinned', () => {
    const onActivate = vi.fn();
    const onClose = vi.fn();
    const view = render(
      <WorkbenchDocumentTabStrip
        open={open}
        activeKey="schematic:half_adder"
        labelFor={(doc) => (doc.kind === 'schematic' ? 'Half Adder' : doc.kind === 'cases' ? 'Default — Cases' : null)}
        onActivate={onActivate}
        onClose={onClose}
      />
    );
    expect(view.getByTestId('ide-doc-tab-schematic:half_adder')).toHaveAttribute('aria-selected', 'true');
    expect(view.getByTestId('ide-doc-tab-schematic:half_adder').textContent).toContain('Half Adder');
    expect(view.getByTestId('ide-doc-tab-cases:scn-1').textContent).toContain('Default — Cases');
    expect(view.getByTestId('ide-doc-tab-project-overview').textContent).toContain('Overview');
    expect(view.queryByTestId('ide-doc-close-project-overview')).toBeNull();

    fireEvent.click(view.getByTestId('ide-doc-tab-cases:scn-1'));
    expect(onActivate).toHaveBeenCalledWith('cases:scn-1');
    fireEvent.click(view.getByTestId('ide-doc-close-cases:scn-1'));
    expect(onClose).toHaveBeenCalledWith('cases:scn-1');
  });

  it('hosts Back / Forward history and a module trail only when a parent exists', () => {
    const onBack = vi.fn();
    const view = render(
      <WorkbenchDocumentTabStrip
        open={open}
        activeKey="schematic:half_adder"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        history={{ canBack: true, canForward: false, onBack, onForward: vi.fn() }}
        trail={[
          { key: 'top', label: 'Top', onSelect: vi.fn() },
          { key: 'ha', label: 'u_ha' },
        ]}
      />
    );
    fireEvent.click(view.getByTestId('ide-location-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('ide-location-forward')).toBeDisabled();
    expect(view.getByTestId('ide-location-path').textContent).toContain('Top');
    expect(view.getByTestId('ide-location-path').textContent).toContain('u_ha');
  });

  it('renders no trail for a single-segment path', () => {
    const view = render(
      <WorkbenchDocumentTabStrip open={open} activeKey="project-overview" onActivate={vi.fn()} onClose={vi.fn()} trail={[{ key: 'top', label: 'Top' }]} />
    );
    expect(view.queryByTestId('ide-location-path')).toBeNull();
  });

  it('moves between tabs with arrow keys', () => {
    const onActivate = vi.fn();
    const view = render(
      <WorkbenchDocumentTabStrip open={open} activeKey="project-overview" onActivate={onActivate} onClose={vi.fn()} />
    );
    fireEvent.keyDown(view.getByTestId('ide-doc-tab-project-overview'), { key: 'ArrowRight' });
    expect(onActivate).toHaveBeenCalledWith('schematic:half_adder');
  });
});
