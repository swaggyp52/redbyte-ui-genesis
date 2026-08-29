// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import {
  DesignComponentLibrary,
  describeComponentPortSignature,
  type DesignComponentLibraryProps,
  type DesignLibraryPaletteItem,
} from '../surfaces/DesignComponentLibrary';

function item(type: string, overrides: Partial<DesignLibraryPaletteItem> = {}): DesignLibraryPaletteItem {
  return {
    type,
    title: overrides.title ?? type,
    subtitle: overrides.subtitle ?? `${type} subtitle`,
    glyph: overrides.glyph ?? type.slice(0, 2).toUpperCase(),
    ...overrides,
  };
}

function makeProps(overrides: Partial<DesignComponentLibraryProps> = {}): DesignComponentLibraryProps {
  return {
    query: '',
    onQueryChange: vi.fn(),
    commonItems: [item('INPUT'), item('AND')],
    categories: {
      io: [item('INPUT'), item('OUTPUT')],
      logic: [item('AND'), item('XOR')],
      sequential: [item('Register1', { paletteBadge: 'Native' })],
      sequentialRegisters: [item('Register1', { paletteBadge: 'Native' })],
      sequentialTiming: [],
      sequentialLegacy: [],
      components: [item('FULL_ADDER', { title: 'Full Adder' })],
    },
    boardGroups: [
      {
        id: 'switches',
        title: 'Switches (SW0–SW15)',
        description: 'Adds a pre-named input pin.',
        entries: [
          { alias: 'SW0', kind: 'switch', direction: 'in' },
          { alias: 'SW1', kind: 'switch', direction: 'in' },
        ],
      },
    ],
    boardResourcesCount: 2,
    pendingPlacement: null,
    onBeginNodePlacement: vi.fn(),
    onBeginBoardIoPlacement: vi.fn(),
    isBoardEntryPlaced: () => false,
    boardEntryTooltip: (entry) => `${entry.alias} tooltip`,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('DesignComponentLibrary', () => {
  it('preserves the established palette testids and section structure', () => {
    const { getByTestId } = render(<DesignComponentLibrary {...makeProps()} />);
    getByTestId('ide-design-dock-palette');
    getByTestId('ide-design-search');
    getByTestId('ide-design-palette-section-common');
    getByTestId('ide-design-palette-section-board');
    getByTestId('ide-design-board-io-palette');
    getByTestId('ide-design-board-input-sw0');
    getByTestId('ide-design-palette-section-io');
    getByTestId('ide-design-palette-section-logic');
    getByTestId('ide-design-palette-section-sequential');
    getByTestId('ide-design-palette-section-reusable');
    getByTestId('ide-design-palette-sequential-registers');
    getByTestId('ide-design-common-input');
    getByTestId('ide-design-palette-and');
  });

  it('arms node placement through the provided callback', () => {
    const props = makeProps();
    const { getByTestId } = render(<DesignComponentLibrary {...props} />);
    fireEvent.click(getByTestId('ide-design-palette-xor'));
    expect(props.onBeginNodePlacement).toHaveBeenCalledWith('XOR');
  });

  it('arms board placement and disables already-placed resources', () => {
    const props = makeProps({
      isBoardEntryPlaced: (entry) => entry.alias === 'SW1',
    });
    const { getByTestId } = render(<DesignComponentLibrary {...props} />);
    fireEvent.click(getByTestId('ide-design-board-input-sw0'));
    expect(props.onBeginBoardIoPlacement).toHaveBeenCalledWith(
      expect.objectContaining({ alias: 'SW0', direction: 'in' })
    );
    expect((getByTestId('ide-design-board-input-sw1') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the results count for a query and the empty state when nothing matches', () => {
    const empty = {
      io: [],
      logic: [],
      sequential: [],
      sequentialRegisters: [],
      sequentialTiming: [],
      sequentialLegacy: [],
      components: [],
    };
    const props = makeProps({ query: 'zzz', categories: empty, boardGroups: [], boardResourcesCount: 0, commonItems: [] });
    const { getByTestId } = render(<DesignComponentLibrary {...props} />);
    expect(getByTestId('ide-design-palette-results').textContent).toContain('No results for "zzz"');
    getByTestId('ide-design-palette-empty');
  });

  it('records recently placed components and lists them first when the query is empty', () => {
    const props = makeProps();
    const view = render(<DesignComponentLibrary {...props} />);
    expect(view.queryByTestId('ide-design-palette-section-recent')).toBeNull();
    fireEvent.click(view.getByTestId('ide-design-palette-xor'));
    view.getByTestId('ide-design-palette-section-recent');
    view.getByTestId('ide-design-recent-xor');
    const sections = view
      .getByTestId('ide-design-dock-palette')
      .querySelectorAll('.ide-palette-section');
    expect(sections[0].getAttribute('data-testid')).toBe('ide-design-palette-section-recent');
  });

  it('survives blocked storage when recording recents', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const props = makeProps();
      const view = render(<DesignComponentLibrary {...props} />);
      fireEvent.click(view.getByTestId('ide-design-palette-and'));
      expect(props.onBeginNodePlacement).toHaveBeenCalledWith('AND');
      view.getByTestId('ide-design-recent-and');
    } finally {
      setItem.mockRestore();
    }
  });

  it('supports keyboard navigation from the search field into the card list', () => {
    const view = render(<DesignComponentLibrary {...makeProps()} />);
    const search = view.getByTestId('ide-design-search');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    const active = document.activeElement as HTMLElement;
    expect(active.matches('button.ide-palette-card, button.ide-design-resource-tile')).toBe(true);
    fireEvent.keyDown(active, { key: 'ArrowDown' });
    const second = document.activeElement as HTMLElement;
    expect(second).not.toBe(active);
    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(active);
  });

  it('clears the query with Escape from the search field', () => {
    const props = makeProps({ query: 'and' });
    const view = render(<DesignComponentLibrary {...props} />);
    fireEvent.keyDown(view.getByTestId('ide-design-search'), { key: 'Escape' });
    expect(props.onQueryChange).toHaveBeenCalledWith('');
  });

  it('marks the pending placement card as active', () => {
    const props = makeProps({ pendingPlacement: { kind: 'node', nodeType: 'AND' } });
    const view = render(<DesignComponentLibrary {...props} />);
    expect(view.getByTestId('ide-design-palette-and').getAttribute('aria-pressed')).toBe('true');
  });

  it('renders the reusable slot content inside the Reusable Blocks section', () => {
    const props = makeProps({
      reusableSlot: <div data-testid="reusable-slot-probe" />,
      reusableExtraCount: 1,
    });
    const view = render(<DesignComponentLibrary {...props} />);
    const section = view.getByTestId('ide-design-palette-section-reusable');
    expect(section.querySelector('[data-testid="reusable-slot-probe"]')).not.toBeNull();
  });
});

describe('describeComponentPortSignature', () => {
  it('produces an inputs → outputs signature from the canonical catalog', () => {
    const signature = describeComponentPortSignature('AND');
    expect(signature).toBeTruthy();
    expect(signature).toContain('→');
  });

  it('returns null for unknown types', () => {
    expect(describeComponentPortSignature('NOT_A_REAL_TYPE')).toBeNull();
  });
});
