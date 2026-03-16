import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Basys3BoardView } from '../apps/ide/components/Basys3BoardView';

describe('Basys3BoardView', () => {
  it('renders the board SVG', () => {
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={vi.fn()}
      />
    );
    expect(screen.getByTestId('ide-hw-board-map')).toBeTruthy();
  });

  it('fires onSelectAlias when clicking an LED region', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-ld-0'));
    expect(onSelectAlias).toHaveBeenCalledWith('LD0');
  });

  it('fires onSelectAlias with correct index for LD15', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-ld-15'));
    expect(onSelectAlias).toHaveBeenCalledWith('LD15');
  });

  it('fires onSelectAlias when clicking a switch region', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-sw-3'));
    expect(onSelectAlias).toHaveBeenCalledWith('SW3');
  });

  it('fires onSelectAlias when clicking a button region', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-btn-c'));
    expect(onSelectAlias).toHaveBeenCalledWith('BTNC');
  });

  it('fires onSelectAlias with CA when clicking a segment on any digit', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    // Each digit has a CA segment; clicking the AN3 digit's CA segment
    fireEvent.click(screen.getByTestId('ide-hw-map-seg-ca-an3'));
    expect(onSelectAlias).toHaveBeenCalledWith('CA');
  });

  it('fires onSelectAlias with AN0 when clicking the AN0 digit-enable region', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-an0'));
    expect(onSelectAlias).toHaveBeenCalledWith('AN0');
  });

  it('fires onSelectAlias with DP when clicking the decimal point', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-dp-an0'));
    expect(onSelectAlias).toHaveBeenCalledWith('DP');
  });

  it('applies map-hl class to highlighted alias region', () => {
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        highlightedAlias="SW5"
        onSelectAlias={vi.fn()}
      />
    );
    const sw5 = screen.getByTestId('ide-hw-map-sw-5');
    expect(sw5.classList.contains('map-hl')).toBe(true);
  });

  it('does NOT apply map-hl class to non-highlighted regions', () => {
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        highlightedAlias="SW5"
        onSelectAlias={vi.fn()}
      />
    );
    const sw3 = screen.getByTestId('ide-hw-map-sw-3');
    expect(sw3.classList.contains('map-hl')).toBe(false);
  });
});
