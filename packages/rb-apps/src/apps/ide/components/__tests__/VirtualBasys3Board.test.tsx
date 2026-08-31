// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VirtualBasys3Board } from '../VirtualBasys3Board';

const zeros16 = Array.from({ length: 16 }, () => 0 as const);

function baseProps() {
  return {
    switches: [...zeros16] as (0 | 1)[],
    leds: [...zeros16] as (0 | 1)[],
    mappedSwitches: Array.from({ length: 16 }, (_, i) => i < 2),
    mappedLeds: Array.from({ length: 16 }, (_, i) => i < 2),
    resourceMap: {
      SW0: { signalLabel: 'A[0]', pin: 'V17' },
      SW1: { signalLabel: 'A[1]', pin: 'V16' },
      LD0: { signalLabel: 'SUM[0]', pin: 'U16' },
      LD1: { signalLabel: 'SUM[1]', pin: 'E19' },
    },
  };
}

describe('VirtualBasys3Board', () => {
  it('labels itself as browser simulation, not hardware proof', () => {
    render(<VirtualBasys3Board {...baseProps()} />);
    const boundary = screen.getByTestId('ide-virtual-board-boundary');
    expect(boundary.textContent).toMatch(/Not synthesis, bitstream, or hardware/i);
  });

  it('drives only mapped switches and reports the mapped signal', () => {
    const onToggleSwitch = vi.fn();
    render(<VirtualBasys3Board {...baseProps()} onToggleSwitch={onToggleSwitch} />);

    const sw0 = screen.getByTestId('ide-virtual-board-sw-0');
    expect(sw0).not.toBeDisabled();
    expect(sw0.getAttribute('title')).toBe('SW0 → A[0] · V17');
    fireEvent.click(sw0);
    expect(onToggleSwitch).toHaveBeenCalledWith(0);

    // An unmapped switch is inert.
    const sw5 = screen.getByTestId('ide-virtual-board-sw-5');
    expect(sw5).toBeDisabled();
    fireEvent.click(sw5);
    expect(onToggleSwitch).toHaveBeenCalledTimes(1);
  });

  it('shows switch and LED live state through data attributes', () => {
    const props = baseProps();
    props.switches[0] = 1;
    props.leds[1] = 1;
    render(<VirtualBasys3Board {...props} />);
    expect(screen.getByTestId('ide-virtual-board-sw-0').getAttribute('data-on')).toBe('1');
    expect(screen.getByTestId('ide-virtual-board-sw-1').getAttribute('data-on')).toBe('0');
    expect(screen.getByTestId('ide-virtual-board-led-1').getAttribute('data-on')).toBe('1');
    expect(screen.getByTestId('ide-virtual-board-led-0').getAttribute('data-on')).toBe('0');
  });

  it('cross-probes the focused resource into the readout', () => {
    const onFocusResource = vi.fn();
    render(<VirtualBasys3Board {...baseProps()} onFocusResource={onFocusResource} />);
    const ld1cell = screen.getByTestId('ide-virtual-board-led-1').parentElement!;
    fireEvent.mouseEnter(ld1cell);
    expect(onFocusResource).toHaveBeenCalledWith('LD1');
    expect(screen.getByTestId('ide-virtual-board-readout').textContent).toBe('LD1 → SUM[1] · E19');
  });
});
