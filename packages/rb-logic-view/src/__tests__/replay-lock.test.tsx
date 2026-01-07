// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TickEngine } from '@redbyte/rb-logic-core';
import { LogicCanvas } from '../LogicCanvas';

describe('replay lock', () => {
  it('blocks switch toggle events during replay', () => {
    const engine = new TickEngine({
      nodes: [
        { id: 'sw1', type: 'Switch', position: { x: 0, y: 0 }, state: { isOn: 0 } },
      ],
      connections: [],
    }, { tickRate: 1 });

    const onInputToggled = vi.fn();

    const { getByTestId } = render(
      <LogicCanvas
        engine={engine}
        width={400}
        height={300}
        showToolbar={false}
        showHints={false}
        onInputToggled={onInputToggled}
        isReplayMode={true}
      />
    );

    fireEvent.click(getByTestId('switch-toggle-sw1'));
    expect(onInputToggled).not.toHaveBeenCalled();
  });
});
