// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { IdeCommandPalette } from '../components/IdeCommandPalette';
import { IdeCommandRegistry, type IdeCommand } from '../ideCommandRegistry';

interface PaletteContext {
  readonly canSave: boolean;
}

const CONTEXT: PaletteContext = { canSave: false };

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function createRegistry(commands: readonly IdeCommand<PaletteContext>[]) {
  return new IdeCommandRegistry(commands);
}

describe('IdeCommandPalette', () => {
  it('groups commands by category and follows the rendered group order with the keyboard', async () => {
    const openProject = vi.fn();
    const saveProject = vi.fn();
    const openDesign = vi.fn();
    const onClose = vi.fn();
    const registry = createRegistry([
      {
        id: 'surface.project.open',
        title: 'Open Project',
        category: 'navigation',
        keywords: ['project'],
        execute: openProject,
      },
      {
        id: 'project.save',
        title: 'Save Project',
        category: 'project',
        keywords: ['save'],
        execute: saveProject,
      },
      {
        id: 'surface.design.open',
        title: 'Open Design',
        category: 'navigation',
        keywords: ['design'],
        execute: openDesign,
      },
    ]);

    const view = render(
      <IdeCommandPalette
        open
        registry={registry}
        context={CONTEXT}
        onClose={onClose}
      />
    );

    const navigationGroup = view.getByRole('group', { name: 'Navigation' });
    const projectGroup = view.getByRole('group', { name: 'Project' });
    expect(within(navigationGroup).getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringContaining('Open Project'),
      expect.stringContaining('Open Design'),
    ]);
    expect(within(projectGroup).getByRole('option').textContent).toContain('Save Project');

    const query = view.getByTestId('ide-command-palette-query');
    expect(query).toHaveAttribute(
      'aria-activedescendant',
      'ide-command-option-surface-project-open'
    );
    fireEvent.keyDown(query, { key: 'ArrowDown' });
    expect(query).toHaveAttribute(
      'aria-activedescendant',
      'ide-command-option-surface-design-open'
    );
    fireEvent.keyDown(query, { key: 'Enter' });

    await waitFor(() => expect(openDesign).toHaveBeenCalledTimes(1));
    expect(openProject).not.toHaveBeenCalled();
    expect(saveProject).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled commands visible and reports their reason without executing', async () => {
    const saveProject = vi.fn();
    const onClose = vi.fn();
    const registry = createRegistry([
      {
        id: 'project.save',
        title: 'Save Project',
        category: 'project',
        keywords: ['save'],
        availability: (context) =>
          context.canSave
            ? { state: 'available' }
            : { state: 'disabled', reason: 'Save is unavailable until a project is open.' },
        execute: saveProject,
      },
    ]);

    const view = render(
      <IdeCommandPalette
        open
        registry={registry}
        context={CONTEXT}
        onClose={onClose}
      />
    );

    const option = view.getByRole('option', { name: /Save Project/i });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option.textContent).toContain('Save is unavailable until a project is open.');

    fireEvent.keyDown(view.getByTestId('ide-command-palette-query'), { key: 'Enter' });

    await waitFor(() => {
      expect(view.getByText('Save is unavailable until a project is open.')).toBeTruthy();
    });
    expect(saveProject).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows directional cues when the command results overflow', () => {
    const registry = createRegistry([
      {
        id: 'surface.project.open',
        title: 'Open Project',
        category: 'navigation',
        keywords: ['project'],
        execute: vi.fn(),
      },
      {
        id: 'project.save',
        title: 'Save Project',
        category: 'project',
        keywords: ['save'],
        execute: vi.fn(),
      },
      {
        id: 'surface.design.open',
        title: 'Open Design',
        category: 'navigation',
        keywords: ['design'],
        execute: vi.fn(),
      },
    ]);
    const view = render(
      <IdeCommandPalette
        open
        registry={registry}
        context={CONTEXT}
        onClose={vi.fn()}
      />
    );
    const results = view.getByTestId('ide-command-palette-results');
    let scrollTop = 0;
    Object.defineProperties(results, {
      clientHeight: { configurable: true, value: 180 },
      scrollHeight: { configurable: true, value: 600 },
      scrollTop: {
        configurable: true,
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = value;
        },
      },
    });

    fireEvent.scroll(results);
    expect(view.getByTestId('ide-command-palette-scroll-down').textContent).toBe('More below');
    expect(view.queryByTestId('ide-command-palette-scroll-up')).toBeNull();

    scrollTop = 120;
    fireEvent.scroll(results);
    expect(view.getByTestId('ide-command-palette-scroll-up').textContent).toBe('More above');
    expect(view.getByTestId('ide-command-palette-scroll-down').textContent).toBe('More below');

    scrollTop = 420;
    fireEvent.scroll(results);
    expect(view.getByTestId('ide-command-palette-scroll-up').textContent).toBe('More above');
    expect(view.queryByTestId('ide-command-palette-scroll-down')).toBeNull();
  });

  it('keeps a valid active index when commands appear after an empty result set', async () => {
    const emptyRegistry = createRegistry([]);
    const openProject = vi.fn();
    const populatedRegistry = createRegistry([
      {
        id: 'surface.project.open',
        title: 'Open Project',
        category: 'navigation',
        keywords: ['project'],
        execute: openProject,
      },
    ]);
    const onClose = vi.fn();
    const view = render(
      <IdeCommandPalette
        open
        registry={emptyRegistry}
        context={CONTEXT}
        onClose={onClose}
      />
    );
    const query = view.getByTestId('ide-command-palette-query');

    expect(query).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(query, { key: 'ArrowDown' });

    view.rerender(
      <IdeCommandPalette
        open
        registry={populatedRegistry}
        context={CONTEXT}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(query).toHaveAttribute(
        'aria-activedescendant',
        'ide-command-option-surface-project-open'
      );
    });
    fireEvent.keyDown(query, { key: 'Enter' });
    await waitFor(() => expect(openProject).toHaveBeenCalledTimes(1));
  });
});
