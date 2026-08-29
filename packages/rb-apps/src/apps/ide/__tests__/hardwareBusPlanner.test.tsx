// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { HardwareBusPlanner } from '../components/HardwareBusPlanner';
import { getBasys3BoardResource } from '../../../fpga/boards/basys3/basys3Pins';

afterEach(cleanup);

const busRows = (pins: Partial<Record<string, string>> = {}) => [
  { id: 'a0', label: 'A[0]', direction: 'in' as const, pin: pins.a0 ?? '' },
  { id: 'a1', label: 'A[1]', direction: 'in' as const, pin: pins.a1 ?? '' },
  { id: 'a2', label: 'A[2]', direction: 'in' as const, pin: pins.a2 ?? '' },
  { id: 'a3', label: 'A[3]', direction: 'in' as const, pin: pins.a3 ?? '' },
  { id: 'carry', label: 'CARRY', direction: 'out' as const, pin: pins.carry ?? '' },
];

describe('HardwareBusPlanner', () => {
  it('renders nothing without a detectable bus', () => {
    const view = render(
      <HardwareBusPlanner
        rows={[{ id: 'x', label: 'CARRY', direction: 'out', pin: '' }]}
        onSetMappingPin={vi.fn()}
      />
    );
    expect(view.queryByTestId('ide-hw-bus-planner')).toBeNull();
  });

  it('previews LSB-first assignments and applies them as package pins', () => {
    const onSetMappingPin = vi.fn();
    const view = render(<HardwareBusPlanner rows={busRows()} onSetMappingPin={onSetMappingPin} />);

    expect(view.getByTestId('ide-hw-bus-planner')).toBeTruthy();
    fireEvent.change(view.getByTestId('ide-hw-bus-planner-start'), { target: { value: '4' } });
    expect(view.getByTestId('ide-hw-bus-planner-preview').textContent).toContain('SW4');
    expect(view.getByTestId('ide-hw-bus-planner-preview').textContent).toContain('SW7');

    fireEvent.click(view.getByTestId('ide-hw-bus-planner-apply'));
    expect(onSetMappingPin).toHaveBeenCalledTimes(4);
    expect(onSetMappingPin).toHaveBeenNthCalledWith(1, 'a0', getBasys3BoardResource('SW4')!.packagePin);
    expect(onSetMappingPin).toHaveBeenNthCalledWith(4, 'a3', getBasys3BoardResource('SW7')!.packagePin);
  });

  it('reverses so the MSB takes the start index', () => {
    const onSetMappingPin = vi.fn();
    const view = render(<HardwareBusPlanner rows={busRows()} onSetMappingPin={onSetMappingPin} />);
    fireEvent.click(view.getByTestId('ide-hw-bus-planner-reverse'));
    fireEvent.click(view.getByTestId('ide-hw-bus-planner-apply'));
    expect(onSetMappingPin).toHaveBeenNthCalledWith(1, 'a3', getBasys3BoardResource('SW0')!.packagePin);
    expect(onSetMappingPin).toHaveBeenNthCalledWith(4, 'a0', getBasys3BoardResource('SW3')!.packagePin);
  });

  it('blocks apply when a target resource is held by another signal', () => {
    const onSetMappingPin = vi.fn();
    const rows = [
      ...busRows(),
      { id: 'reset', label: 'RESET', direction: 'in' as const, pin: getBasys3BoardResource('SW2')!.packagePin },
    ];
    const view = render(<HardwareBusPlanner rows={rows} onSetMappingPin={onSetMappingPin} />);
    expect(view.getByTestId('ide-hw-bus-planner-blocked').textContent).toContain('blocked');
    expect((view.getByTestId('ide-hw-bus-planner-apply') as HTMLButtonElement).disabled).toBe(true);
    // Moving the start past the collision unblocks it.
    fireEvent.change(view.getByTestId('ide-hw-bus-planner-start'), { target: { value: '4' } });
    expect(view.queryByTestId('ide-hw-bus-planner-blocked')).toBeNull();
    expect((view.getByTestId('ide-hw-bus-planner-apply') as HTMLButtonElement).disabled).toBe(false);
  });

  it('reads as already mapped instead of "Assign 0 pins" when the whole bus is placed', () => {
    const rows = busRows({
      a0: getBasys3BoardResource('SW0')!.packagePin,
      a1: getBasys3BoardResource('SW1')!.packagePin,
      a2: getBasys3BoardResource('SW2')!.packagePin,
      a3: getBasys3BoardResource('SW3')!.packagePin,
    });
    const view = render(<HardwareBusPlanner rows={rows} onSetMappingPin={vi.fn()} />);
    const mapped = view.getByTestId('ide-hw-bus-planner-mapped');
    expect(mapped.textContent).toContain('Bus already mapped');
    // No misleading "Assign 0 pins" primary button.
    expect(view.queryByTestId('ide-hw-bus-planner-apply')).toBeNull();
  });

  it('reverts the whole bus assignment as one action', () => {
    const onSetMappingPin = vi.fn();
    const view = render(
      <HardwareBusPlanner
        rows={busRows({ a0: getBasys3BoardResource('SW9')!.packagePin })}
        onSetMappingPin={onSetMappingPin}
      />
    );
    fireEvent.click(view.getByTestId('ide-hw-bus-planner-apply'));
    onSetMappingPin.mockClear();

    fireEvent.click(view.getByTestId('ide-hw-bus-planner-revert'));
    expect(onSetMappingPin).toHaveBeenCalledTimes(4);
    expect(onSetMappingPin).toHaveBeenCalledWith('a0', getBasys3BoardResource('SW9')!.packagePin);
    expect(onSetMappingPin).toHaveBeenCalledWith('a1', '');
    expect(onSetMappingPin).toHaveBeenCalledWith('a2', '');
    expect(onSetMappingPin).toHaveBeenCalledWith('a3', '');
  });
});
