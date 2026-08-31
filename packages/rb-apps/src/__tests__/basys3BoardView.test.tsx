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

  it('fires onSelectAlias when clicking the clock resource', () => {
    const onSelectAlias = vi.fn();
    render(
      <Basys3BoardView
        mappedAliases={new Set()}
        onSelectAlias={onSelectAlias}
      />
    );
    fireEvent.click(screen.getByTestId('ide-hw-map-clock'));
    expect(onSelectAlias).toHaveBeenCalledWith('CLK100MHZ');
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

  it('keeps switch, LED, button, and clock aliases above the board readability floor', () => {
    const { container } = render(
      <Basys3BoardView
        mappedAliases={new Set(['SW3', 'LD0'])}
        onSelectAlias={vi.fn()}
      />
    );

    const primaryAliases = container.querySelectorAll<SVGTextElement>(
      '[data-board-alias-kind="switch"], [data-board-alias-kind="led"], [data-board-alias-kind="button"]'
    );
    expect(primaryAliases).toHaveLength(37);
    for (const alias of primaryAliases) {
      expect(Number(alias.getAttribute('font-size'))).toBeGreaterThanOrEqual(11);
      expect(alias.getAttribute('data-board-alias')).toBeTruthy();
    }

    const clockAlias = screen.getByTestId('ide-hw-map-clock-alias');
    expect(clockAlias.getAttribute('data-board-alias')).toBe('CLK100MHZ');
    expect(Number(clockAlias.getAttribute('font-size'))).toBeGreaterThanOrEqual(13);
    expect(clockAlias.textContent).toContain('W5');
    expect(clockAlias.textContent).toContain('100 MHz');

    const clockRegion = screen.getByTestId('ide-hw-map-clock');
    expect(Number(clockRegion.getAttribute('y')) + Number(clockRegion.getAttribute('height')))
      .toBeLessThan(10);
    expect(screen.getByTestId('ide-hw-board-map').getAttribute('viewBox')).toBe('0 -48 620 308');
  });

  it('exposes unmistakable selected, mapped, available, and unavailable resource states', () => {
    render(
      <Basys3BoardView
        mappedAliases={new Set(['SW3', 'LD0'])}
        highlightedAlias="SW3"
        allowedAliases={new Set(['SW2', 'SW3', 'LD0'])}
        assignmentMode
        onSelectAlias={vi.fn()}
      />
    );

    const selected = screen.getByTestId('ide-hw-map-sw-3');
    const mapped = screen.getByTestId('ide-hw-map-ld-0');
    const available = screen.getByTestId('ide-hw-map-sw-2');
    const unavailable = screen.getByTestId('ide-hw-map-sw-1');

    expect(selected.getAttribute('data-resource-state')).toBe('selected');
    expect(mapped.getAttribute('data-resource-state')).toBe('mapped');
    expect(available.getAttribute('data-resource-state')).toBe('available');
    expect(unavailable.getAttribute('data-resource-state')).toBe('unavailable');
    expect(selected.getAttribute('fill')).not.toBe(mapped.getAttribute('fill'));
    expect(mapped.getAttribute('fill')).not.toBe(available.getAttribute('fill'));
    expect(Number(selected.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(mapped.getAttribute('stroke-width'))
    );
  });
});
