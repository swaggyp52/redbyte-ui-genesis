// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// RC-P5: Canvas focus model regression test

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { CanvasHost } from '../CanvasHost.js';
import { isCanvasActive, clearIfActive } from '../activeCanvas.js';

describe('CanvasHost — click-to-focus model (RC-P5)', () => {
  beforeEach(() => {
    // Reset global active canvas between tests
    clearIfActive('test-canvas');
  });

  it('canvas is NOT active initially', () => {
    render(
      React.createElement(CanvasHost, { id: 'test-canvas' },
        React.createElement('div', { 'data-testid': 'inner' }, 'content')
      )
    );
    expect(isCanvasActive('test-canvas')).toBe(false);
  });

  it('pointerDown activates canvas', () => {
    const onActive = vi.fn();
    const { container } = render(
      React.createElement(CanvasHost, { id: 'test-canvas', onActive },
        React.createElement('div', null, 'content')
      )
    );

    const host = container.firstChild as HTMLElement;
    fireEvent.pointerDown(host);

    expect(isCanvasActive('test-canvas')).toBe(true);
    expect(onActive).toHaveBeenCalled();
  });

  it('does NOT have onPointerEnter handler (no hover activation)', () => {
    const { container } = render(
      React.createElement(CanvasHost, { id: 'test-canvas' },
        React.createElement('div', null, 'content')
      )
    );

    const host = container.firstChild as HTMLElement;

    // Hover should NOT activate the canvas
    fireEvent.pointerEnter(host);
    expect(isCanvasActive('test-canvas')).toBe(false);
  });

  it('has tabIndex for keyboard accessibility', () => {
    const { container } = render(
      React.createElement(CanvasHost, { id: 'test-canvas' },
        React.createElement('div', null, 'content')
      )
    );

    const host = container.firstChild as HTMLElement;
    expect(host.getAttribute('tabindex')).toBe('0');
    expect(host.getAttribute('role')).toBe('region');
    expect(host.getAttribute('aria-label')).toBe('Interactive circuit canvas');
  });

  it('focus activates canvas', () => {
    const onActive = vi.fn();
    const { container } = render(
      React.createElement(CanvasHost, { id: 'test-canvas', onActive },
        React.createElement('div', null, 'content')
      )
    );

    const host = container.firstChild as HTMLElement;
    fireEvent.focus(host);

    expect(isCanvasActive('test-canvas')).toBe(true);
    expect(onActive).toHaveBeenCalled();
  });
});
