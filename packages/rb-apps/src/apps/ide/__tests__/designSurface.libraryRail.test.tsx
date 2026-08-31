// @vitest-environment jsdom
/**
 * Component Library rail contract: collapsible persisted sections,
 * arrow-key roving focus between cards, and palette drag-to-place arming
 * the same pendingPlacement pipeline the click path uses.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { DesignSurface } from '../surfaces/DesignSurface';
import type { RuntimeSimState } from '../projectRuntime';
import { useCircuitStore } from '../../../stores/circuitStore';
import { useLogicViewStore } from '@redbyte/rb-logic-view';

const EMPTY_CIRCUIT: Circuit = { nodes: [], connections: [] };

function makeRuntimeSim(): RuntimeSimState {
  return {
    tick: 0,
    running: false,
    lastAction: 'step',
    speedHz: 10,
    irHash: 'ir-hash',
    traceHash: 'trace-hash',
    inputs: {},
    signals: {},
    trace: [],
    selectedSignalKey: null,
    probes: [],
  };
}

function installResizeObserver(width = 1320, height = 720) {
  class ImmediateResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: {
              width,
              height,
              x: 0,
              y: 0,
              top: 0,
              left: 0,
              bottom: height,
              right: width,
              toJSON: () => ({}),
            },
          } as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
}

function renderSurface(overrides: Partial<React.ComponentProps<typeof DesignSurface>> = {}) {
  return render(
    <DesignSurface
      runtimeSim={makeRuntimeSim()}
      ioRows={[]}
      onRuntimeSimRun={vi.fn()}
      onRuntimeSimPause={vi.fn()}
      onRuntimeSimStep={vi.fn()}
      onRuntimeSimReset={vi.fn()}
      onRuntimeSimSetSpeed={vi.fn()}
      onRuntimeSimToggleProbe={vi.fn()}
      onGoToProject={vi.fn()}
      onGoToVerify={vi.fn()}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  installResizeObserver();
  localStorage.clear();
  useCircuitStore.getState().reset();
  useCircuitStore.setState({ circuit: structuredClone(EMPTY_CIRCUIT), isDirty: false });
  useLogicViewStore.setState({
    ...useLogicViewStore.getState(),
    toolMode: 'select',
    interactionMode: 'idle',
  });
});

afterEach(cleanup);

describe('DesignSurface library rail', () => {
  it('collapses a section, persists the choice, and reopens it on demand', async () => {
    const view = renderSurface();
    await waitFor(() => expect(view.getByTestId('ide-design-palette-section-logic')).toBeTruthy());
    expect(view.getByTestId('ide-design-palette-and')).toBeTruthy();

    fireEvent.click(view.getByTestId('ide-design-library-toggle-logic'));
    expect(view.getByTestId('ide-design-palette-section-logic').getAttribute('data-collapsed')).toBe('true');
    expect(view.queryByTestId('ide-design-palette-and')).toBeNull();
    expect(localStorage.getItem('rb.ide.design.libraryCollapsed.v1')).toContain('logic');

    // A fresh mount respects the stored collapse.
    cleanup();
    const remounted = renderSurface();
    await waitFor(() =>
      expect(remounted.getByTestId('ide-design-palette-section-logic').getAttribute('data-collapsed')).toBe('true')
    );
    expect(remounted.queryByTestId('ide-design-palette-and')).toBeNull();

    fireEvent.click(remounted.getByTestId('ide-design-library-toggle-logic'));
    expect(remounted.getByTestId('ide-design-palette-and')).toBeTruthy();
  });

  it('shows matches from a collapsed section while a search query is active', async () => {
    const view = renderSurface();
    await waitFor(() => expect(view.getByTestId('ide-design-palette-section-logic')).toBeTruthy());
    fireEvent.click(view.getByTestId('ide-design-library-toggle-logic'));
    expect(view.queryByTestId('ide-design-palette-and')).toBeNull();

    fireEvent.change(view.getByTestId('ide-design-search'), { target: { value: 'AND' } });
    expect(view.getByTestId('ide-design-palette-and')).toBeTruthy();

    fireEvent.change(view.getByTestId('ide-design-search'), { target: { value: '' } });
    expect(view.queryByTestId('ide-design-palette-and')).toBeNull();
  });

  it('moves focus between library cards with arrow keys', async () => {
    const view = renderSurface();
    await waitFor(() => expect(view.getByTestId('ide-design-palette-section-common')).toBeTruthy());
    const first = view.getByTestId('ide-design-common-input');
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).not.toBe(first);
    expect((document.activeElement as HTMLElement).classList.contains('ide-palette-card')).toBe(true);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });

  it('arms placement when a card drag passes the threshold and cancels on an off-canvas release', async () => {
    const view = renderSurface();
    await waitFor(() => expect(view.getByTestId('ide-design-palette-and')).toBeTruthy());
    const card = view.getByTestId('ide-design-palette-and');

    fireEvent.pointerDown(card, { button: 0, clientX: 100, clientY: 100 });
    expect(card.getAttribute('aria-pressed')).toBe('false');

    fireEvent.pointerMove(document, { clientX: 130, clientY: 130 });
    await waitFor(() => expect(view.getByTestId('ide-design-palette-and').getAttribute('aria-pressed')).toBe('true'));
    expect(useLogicViewStore.getState().interactionMode).toBe('placing');

    // Releasing far away from the canvas cancels instead of placing.
    fireEvent.pointerUp(document, { clientX: 4000, clientY: 4000 });
    await waitFor(() => expect(view.getByTestId('ide-design-palette-and').getAttribute('aria-pressed')).toBe('false'));
    expect(useCircuitStore.getState().circuit.nodes).toHaveLength(0);
  });

  it('keeps plain card clicks arming placement without starting a drag', async () => {
    const view = renderSurface();
    await waitFor(() => expect(view.getByTestId('ide-design-palette-and')).toBeTruthy());
    const card = view.getByTestId('ide-design-palette-and');

    fireEvent.pointerDown(card, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 100 });
    fireEvent.click(card);
    await waitFor(() => expect(card.getAttribute('aria-pressed')).toBe('true'));
    expect(useLogicViewStore.getState().interactionMode).toBe('placing');
  });
});
