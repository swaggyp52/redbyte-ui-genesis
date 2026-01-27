// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { TerminalApp } from '../apps/TerminalApp';

const TerminalComponent = TerminalApp.component;

describe('Terminal commands', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens apps via open command', () => {
    const onOpenApp = vi.fn();
    render(<TerminalComponent onOpenApp={onOpenApp} />);

    const input = screen.getByLabelText('Terminal command input');
    fireEvent.change(input, { target: { value: 'open settings' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(onOpenApp).toHaveBeenCalledWith('settings');
  });

  it('starts determinism recording via record on', () => {
    const startRecording = vi.fn();
    const determinismRecorder = {
      startRecording,
      stopRecording: vi.fn(),
      isRecording: false,
    };
    const getCurrentCircuit = vi.fn(() => ({ version: 'v1', nodes: [], connections: [] }));

    render(
      <TerminalComponent
        determinismRecorder={determinismRecorder}
        getCurrentCircuit={getCurrentCircuit}
      />
    );

    const input = screen.getByLabelText('Terminal command input');
    fireEvent.change(input, { target: { value: 'record on' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(startRecording).toHaveBeenCalled();
  });
});
