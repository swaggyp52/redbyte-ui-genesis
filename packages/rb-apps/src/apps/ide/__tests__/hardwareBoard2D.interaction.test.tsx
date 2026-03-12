// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { HardwareBoard2D } from '../components/HardwareBoard2D';

function buildBits(length: number, value: 0 | 1 = 0): Array<0 | 1> {
  return Array.from({ length }, () => value);
}

function buildBooleanBits(length: number, value = true): boolean[] {
  return Array.from({ length }, () => value);
}

function renderBoard(overrides?: Partial<React.ComponentProps<typeof HardwareBoard2D>>) {
  const onToggleSwitch = vi.fn();
  const onSetSwitch = vi.fn();
  const onPressButton = vi.fn();
  const onSelectSignal = vi.fn();
  const onHoverSignal = vi.fn();

  const result = render(
    <HardwareBoard2D
      sw={buildBits(16, 0)}
      ld={buildBits(16, 0)}
      btn={buildBits(5, 0)}
      mappedSw={buildBooleanBits(16, true)}
      mappedLd={buildBooleanBits(16, true)}
      onToggleSwitch={onToggleSwitch}
      onSetSwitch={onSetSwitch}
      onPressButton={onPressButton}
      onSelectSignal={onSelectSignal}
      onHoverSignal={onHoverSignal}
      {...overrides}
    />
  );

  return {
    ...result,
    onHoverSignal,
    onPressButton,
    onSelectSignal,
    onSetSwitch,
    onToggleSwitch,
  };
}

function getSwitchHitbox(container: HTMLElement, switchIndex: number): SVGRectElement {
  const switchGroup = container.querySelector(`[data-testid="ide-hw-sw-${switchIndex}"]`);
  const hitbox = switchGroup?.querySelector('rect[fill="transparent"]') as SVGRectElement | null;
  if (!hitbox) throw new Error(`Switch hitbox for sw${switchIndex} not found.`);
  return hitbox;
}

describe('HardwareBoard2D interaction safety', () => {
  it('handles rapid repeated SW0 clicks with no missed toggle callback', () => {
    const { container, onToggleSwitch } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);

    for (let index = 0; index < 20; index += 1) {
      fireEvent.click(sw0Hitbox);
    }

    expect(onToggleSwitch).toHaveBeenCalledTimes(20);
    for (const call of onToggleSwitch.mock.calls) {
      expect(call[0]).toBe(0);
    }
  });

  it('accepts border clicks on switch hitbox and keeps label non-intercepting', () => {
    const { container, onToggleSwitch, getByText } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);

    fireEvent.click(sw0Hitbox, { clientX: 1, clientY: 1 });

    const sw0Label = getByText('SW0');
    const labelStyle = sw0Label.getAttribute('style') ?? '';

    expect(onToggleSwitch).toHaveBeenCalledTimes(1);
    expect(labelStyle).toContain('pointer-events: none');
  });

  it('keeps hover signal callbacks active for switches and leds after hitbox changes', () => {
    const { container, getByTestId, onHoverSignal } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);
    const ld0 = getByTestId('ide-hw-ld-0');

    fireEvent.mouseEnter(sw0Hitbox);
    fireEvent.mouseLeave(sw0Hitbox);
    fireEvent.mouseEnter(ld0);
    fireEvent.mouseLeave(ld0);

    expect(onHoverSignal).toHaveBeenNthCalledWith(1, { type: 'sw', index: 0 });
    expect(onHoverSignal).toHaveBeenNthCalledWith(2, null);
    expect(onHoverSignal).toHaveBeenNthCalledWith(3, { type: 'ld', index: 0 });
    expect(onHoverSignal).toHaveBeenNthCalledWith(4, null);
  });

  it('updates LED lens state immediately when LED bit toggles', () => {
    const initial = buildBits(16, 0);
    const next = buildBits(16, 0);
    next[0] = 1;

    const { getByTestId, rerender } = renderBoard({ ld: initial });

    expect(getByTestId('ide-hw-ld-0').getAttribute('fill')).toBe('url(#ledLensOff)');

    rerender(
      <HardwareBoard2D
        sw={buildBits(16, 0)}
        ld={next}
        btn={buildBits(5, 0)}
        mappedSw={buildBooleanBits(16, true)}
        mappedLd={buildBooleanBits(16, true)}
        onToggleSwitch={vi.fn()}
        onSetSwitch={vi.fn()}
        onPressButton={vi.fn()}
      />
    );

    expect(getByTestId('ide-hw-ld-0').getAttribute('fill')).toBe('url(#ledLensOn)');
  });
});
