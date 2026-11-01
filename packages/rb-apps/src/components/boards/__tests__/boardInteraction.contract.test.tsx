// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { Basys3Board } from '../Basys3Board';
import { Spartan3EBoard } from '../Spartan3EBoard';
import type { BoardInteractionHandler } from '../boardInteraction';

const boards = [
  { name: 'Basys3', Board: Basys3Board, switchLabel: 'SWITCHES', switchMask: 1 << 15, buttonLabel: 'BTNU', buttonMask: 1 << 1 },
  { name: 'Spartan3E', Board: Spartan3EBoard, switchLabel: 'SW', switchMask: 1 << 3, buttonLabel: 'N', buttonMask: 1 << 2 },
];

describe('retained board interaction contract', () => {
  it.each(boards)('$name emits numeric groups while preserving other bits and the supplied snapshot', ({ Board, switchLabel, switchMask, buttonLabel, buttonMask }) => {
    const onInteraction = vi.fn<BoardInteractionHandler>();
    const snapshot = { timestamp: '2026-10-01T00:00:00.000Z', inputs: { SW: 1, BTN: 1 }, outputs: { LED: 0 } };
    const before = JSON.stringify(snapshot);
    const view = render(<Board ioSnapshot={snapshot} onInteraction={onInteraction} />);
    const switchButton = view.getByText(switchLabel).parentElement?.querySelector('button');
    const momentaryButton = view.queryByTitle(buttonLabel) ?? view.getByText(buttonLabel).parentElement?.querySelector('button');
    if (!switchButton || !momentaryButton) throw new Error('Expected interactive board controls');
    fireEvent.click(switchButton);
    fireEvent.mouseDown(momentaryButton);
    fireEvent.mouseUp(momentaryButton);
    expect(onInteraction.mock.calls).toEqual([['SW', 1 | switchMask], ['BTN', 1 | buttonMask], ['BTN', 1]]);
    expect(JSON.stringify(snapshot)).toBe(before);
    view.rerender(<Board ioSnapshot={snapshot} onInteraction={onInteraction} readOnly />);
    onInteraction.mockClear();
    fireEvent.click(switchButton);
    fireEvent.mouseDown(momentaryButton);
    expect(onInteraction).not.toHaveBeenCalled();
  });
});
