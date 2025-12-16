import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import { LauncherSearchPanel } from './LauncherSearchPanel';
import { executeLauncherAction } from './launcherActions';
import { useLauncherSearchToggle } from './useLauncherSearchToggle';

vi.mock('./launcherActions', () => ({
  executeLauncherAction: vi.fn(),
}));

function LauncherHarness() {
  const { isLauncherOpen, closeLauncher, shellRef } = useLauncherSearchToggle();

  return (
    <div ref={shellRef} data-testid="playground-shell" tabIndex={-1}>
      {isLauncherOpen && <LauncherSearchPanel onClose={closeLauncher} />}
    </div>
  );
}

describe('LauncherSearchPanel', () => {
  it('executes the active action when Enter is pressed', () => {
    render(<LauncherSearchPanel />);

    const input = screen.getByPlaceholderText(/search actions/i);
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(executeLauncherAction).toHaveBeenCalledWith('open-settings');
  });

  it('supports keyboard navigation and clearing the query', () => {
    render(<LauncherSearchPanel />);

    const input = screen.getByPlaceholderText(/search actions/i);
    input.focus();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(executeLauncherAction).toHaveBeenLastCalledWith('open-docs');

    fireEvent.change(input, { target: { value: 'docs' } });
    expect(input).toHaveValue('docs');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('opens via Ctrl+K and focuses the search input', () => {
    render(<LauncherHarness />);

    expect(screen.queryByPlaceholderText(/search actions/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const input = screen.getByPlaceholderText(/search actions/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('closes on Escape when the query is empty and returns focus', async () => {
    render(<LauncherHarness />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const input = screen.getByPlaceholderText(/search actions/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/search actions/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('playground-shell')).toHaveFocus();
    });
  });
});
