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

  // P2.5H - one authority per gesture. `onPointerDown` used to set the switch absolutely from
  // where the student pressed, and the click React dispatches right after it toggled the same
  // switch again, undoing the press. Clicking the lower half of an ON switch was a silent no-op,
  // and the hitbox midpoint is the on/off boundary, so a centre click could never turn one off.
  // A press that does not travel is now an ordinary click and simply toggles.
  it('toggles on an ordinary press-and-release, wherever it lands on the switch', () => {
    const { container, onSetSwitch, onToggleSwitch } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);

    // jsdom reports a zero-sized rect, so clientY 8 is below the midpoint: the old code set 0 here
    // and the click then flipped it back, which is exactly the no-op this test rules out.
    fireEvent.pointerDown(sw0Hitbox, { clientY: 8 });
    fireEvent.pointerUp(sw0Hitbox, { clientY: 8 });
    fireEvent.click(sw0Hitbox, { clientY: 8 });

    expect(onToggleSwitch).toHaveBeenCalledTimes(1);
    expect(onToggleSwitch).toHaveBeenCalledWith(0);
    expect(onSetSwitch, 'a tap must not also drive the switch by position').not.toHaveBeenCalled();
  });

  it('slides the switch by pointer position once the gesture travels, and the click does not undo it', () => {
    const { container, onSetSwitch, onToggleSwitch } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);

    // Press near the top, drag well below the midpoint: the slide decides the value.
    fireEvent.pointerDown(sw0Hitbox, { clientY: -20 });
    fireEvent.pointerMove(sw0Hitbox, { clientY: 24 });
    fireEvent.pointerUp(sw0Hitbox, { clientY: 24 });
    fireEvent.click(sw0Hitbox, { clientY: 24 });

    expect(onSetSwitch).toHaveBeenCalledWith(0, 0);
    expect(onToggleSwitch, 'the click must not invert what the slide just set').not.toHaveBeenCalled();
  });

  it('ignores pointer jitter below the slide threshold', () => {
    const { container, onSetSwitch, onToggleSwitch } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);

    fireEvent.pointerDown(sw0Hitbox, { clientY: 8 });
    fireEvent.pointerMove(sw0Hitbox, { clientY: 10 });
    fireEvent.click(sw0Hitbox, { clientY: 10 });

    expect(onSetSwitch, 'a two-pixel wobble is a click, not a slide').not.toHaveBeenCalled();
    expect(onToggleSwitch).toHaveBeenCalledTimes(1);
  });

  it('does not latch: the gesture after a slide toggles again', () => {
    const { container, onToggleSwitch } = renderBoard();
    const sw0Hitbox = getSwitchHitbox(container, 0);

    fireEvent.pointerDown(sw0Hitbox, { clientY: -20 });
    fireEvent.pointerMove(sw0Hitbox, { clientY: 24 });
    fireEvent.click(sw0Hitbox, { clientY: 24 });
    expect(onToggleSwitch).not.toHaveBeenCalled();

    fireEvent.pointerDown(sw0Hitbox, { clientY: 8 });
    fireEvent.click(sw0Hitbox, { clientY: 8 });
    expect(onToggleSwitch).toHaveBeenCalledTimes(1);
  });

  it('publishes switch and led state as a machine-readable attribute', () => {
    const sw = buildBits(16, 0);
    sw[3] = 1;
    const ld = buildBits(16, 0);
    ld[5] = 1;
    const { getByTestId } = renderBoard({ sw, ld });

    expect(getByTestId('ide-hw-sw-3').getAttribute('data-on')).toBe('1');
    expect(getByTestId('ide-hw-sw-2').getAttribute('data-on')).toBe('0');
    expect(getByTestId('ide-hw-ld-5').getAttribute('data-on')).toBe('1');
    expect(getByTestId('ide-hw-ld-4').getAttribute('data-on')).toBe('0');
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
