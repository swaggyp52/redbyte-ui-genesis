import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import { LauncherSearchPanel } from './LauncherSearchPanel';
import { executeLauncherAction } from './launcherActions';

vi.mock('./launcherActions', () => ({
  executeLauncherAction: vi.fn(),
}));

describe('LauncherSearchPanel', () => {
  it('executes the active action when Enter is pressed', () => {
    render(<LauncherSearchPanel />);

    const input = screen.getByPlaceholderText(/search actions/i);
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(executeLauncherAction).toHaveBeenCalledWith('open-settings');
  });
});
