// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';

afterEach(() => cleanup());

describe('KeyboardShortcutsModal stage contract', () => {
  it('documents the same five numbered stages executed by the workbench', () => {
    const view = render(<KeyboardShortcutsModal onClose={vi.fn()} />);
    const expectedRows = [
      ['Switch to Project', '1'],
      ['Switch to Design', '2'],
      ['Switch to Simulate', '3'],
      ['Switch to Board & Constraints', '4'],
      ['Switch to Build & Export', '5'],
    ] as const;

    for (const [action, key] of expectedRows) {
      const row = view.getByText(action).closest('tr');
      expect(row?.textContent).toContain(key);
    }

    expect(view.queryByText('Switch to Verify')).toBeNull();
    expect(view.getByTestId('ide-shortcuts-section-simulate').textContent).toBe('Simulate');
    expect(view.queryByText('Switch to Import')).toBeNull();
  });
});
