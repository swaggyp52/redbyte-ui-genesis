// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WindowSwitcher } from '../modals/WindowSwitcher';
import type { WindowState } from '@redbyte/rb-windowing';

describe('WindowSwitcher', () => {
  const createMockWindow = (overrides: Partial<WindowState>): WindowState => ({
    id: 'win-1',
    title: 'Test Window',
    bounds: { x: 0, y: 0, width: 400, height: 300 },
    mode: 'normal',
    zIndex: 1,
    focused: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    contentId: 'test-app',
    ...overrides,
  });

  describe('MRU Ordering', () => {
    it('sorts windows by lastFocusedAt DESC (most recent first)', () => {
      const now = Date.now();
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Oldest', contentId: 'app1', lastFocusedAt: now - 10000 }),
        createMockWindow({ id: 'win-2', title: 'Newest', contentId: 'app2', lastFocusedAt: now }),
        createMockWindow({ id: 'win-3', title: 'Middle', contentId: 'app3', lastFocusedAt: now - 5000 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const items = screen.getAllByText(/app/);
      expect(items[0]).toHaveTextContent('app2'); // Newest first
      expect(items[1]).toHaveTextContent('app3'); // Middle second
      expect(items[2]).toHaveTextContent('app1'); // Oldest last
    });

    it('uses windowId ASC for tie-break when lastFocusedAt is equal', () => {
      const now = Date.now();
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-c', title: 'Window C', contentId: 'app-c', lastFocusedAt: now }),
        createMockWindow({ id: 'win-a', title: 'Window A', contentId: 'app-a', lastFocusedAt: now }),
        createMockWindow({ id: 'win-b', title: 'Window B', contentId: 'app-b', lastFocusedAt: now }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const items = screen.getAllByText(/app-/);
      expect(items[0]).toHaveTextContent('app-a'); // win-a first (alphabetical)
      expect(items[1]).toHaveTextContent('app-b'); // win-b second
      expect(items[2]).toHaveTextContent('app-c'); // win-c last
    });

    it('handles windows without lastFocusedAt (defaults to 0)', () => {
      const now = Date.now();
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Has timestamp', contentId: 'app1', lastFocusedAt: now }),
        createMockWindow({ id: 'win-2', title: 'No timestamp', contentId: 'app2' }), // No lastFocusedAt
        createMockWindow({ id: 'win-3', title: 'Also no timestamp', contentId: 'app3' }), // No lastFocusedAt
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const items = screen.getAllByText(/app/);
      expect(items[0]).toHaveTextContent('app1'); // Has timestamp -> first
      expect(items[1]).toHaveTextContent('app2'); // No timestamp -> win-2 before win-3 (id sort)
      expect(items[2]).toHaveTextContent('app3');
    });
  });

  describe('Keyboard Navigation', () => {
    it('Tab cycles forward through windows', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 3 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-3', title: 'Window 3', contentId: 'app3', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;
      expect(overlay).toBeTruthy();

      // Initial: win-1 selected (index 0)
      expect(screen.getByTestId('window-item-win-1')).toHaveAttribute('data-selected', 'true');

      // Press Tab -> win-2 selected (index 1)
      fireEvent.keyDown(overlay, { key: 'Tab' });
      expect(screen.getByTestId('window-item-win-2')).toHaveAttribute('data-selected', 'true');

      // Press Tab -> win-3 selected (index 2)
      fireEvent.keyDown(overlay, { key: 'Tab' });
      expect(screen.getByTestId('window-item-win-3')).toHaveAttribute('data-selected', 'true');

      // Press Tab -> wrap to win-1 (index 0)
      fireEvent.keyDown(overlay, { key: 'Tab' });
      expect(screen.getByTestId('window-item-win-1')).toHaveAttribute('data-selected', 'true');
    });

    it('Shift+Tab cycles backward through windows', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 3 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-3', title: 'Window 3', contentId: 'app3', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;
      expect(overlay).toBeTruthy();

      // Initial: win-1 selected (index 0)
      expect(screen.getByTestId('window-item-win-1')).toHaveAttribute('data-selected', 'true');

      // Press Shift+Tab -> wrap to win-3 (index 2)
      fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true });
      expect(screen.getByTestId('window-item-win-3')).toHaveAttribute('data-selected', 'true');

      // Press Shift+Tab -> win-2 (index 1)
      fireEvent.keyDown(overlay, { key: 'Tab', shiftKey: true });
      expect(screen.getByTestId('window-item-win-2')).toHaveAttribute('data-selected', 'true');
    });

    it('ArrowDown cycles forward through windows', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;

      // Press ArrowDown -> win-2 selected
      fireEvent.keyDown(overlay, { key: 'ArrowDown' });
      expect(screen.getByTestId('window-item-win-2')).toHaveAttribute('data-selected', 'true');
    });

    it('ArrowUp cycles backward through windows', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;

      // Press ArrowUp -> wrap to win-2
      fireEvent.keyDown(overlay, { key: 'ArrowUp' });
      expect(screen.getByTestId('window-item-win-2')).toHaveAttribute('data-selected', 'true');
    });
  });

  describe('Window Selection', () => {
    it('Enter calls onSelect with selected window id', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;

      // Press Enter (should select win-1, which is at index 0)
      fireEvent.keyDown(overlay, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledWith('win-1');
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('Enter selects correct window after Tab navigation', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 3 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-3', title: 'Window 3', contentId: 'app3', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;

      // Tab twice -> select win-3
      fireEvent.keyDown(overlay, { key: 'Tab' });
      fireEvent.keyDown(overlay, { key: 'Tab' });
      fireEvent.keyDown(overlay, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith('win-3');
    });

    it('clicking a window calls onSelect with that window id', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 1 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const window2 = screen.getByTestId('window-item-win-2');
      fireEvent.click(window2);

      expect(onSelect).toHaveBeenCalledWith('win-2');
    });
  });

  describe('Cancel Behavior', () => {
    it('Escape calls onCancel', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1' }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(overlay, { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('clicking overlay background calls onCancel', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1' }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      // Click the overlay background (not the inner modal)
      const overlay = container.querySelector('div.fixed.inset-0') as HTMLElement;
      fireEvent.click(overlay);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('clicking inside modal does NOT call onCancel', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1' }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      // Click the modal content
      const modal = screen.getByText('Switch Window').closest('div.bg-slate-900') as HTMLElement;
      fireEvent.click(modal);

      expect(onCancel).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Minimized Windows', () => {
    it('displays "Minimized" badge for minimized windows', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Normal Window', contentId: 'app1', mode: 'normal' }),
        createMockWindow({ id: 'win-2', title: 'Minimized Window', contentId: 'app2', mode: 'minimized' }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      // Check that minimized window has badge
      expect(screen.getByText('Minimized')).toBeInTheDocument();
    });

    it('does not display badge for normal windows', () => {
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Normal Window', contentId: 'app1', mode: 'normal' }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      // No badge should be present
      expect(screen.queryByText('Minimized')).not.toBeInTheDocument();
    });

    it('includes minimized windows in MRU list', () => {
      const now = Date.now();
      const windows: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Normal', contentId: 'app1', mode: 'normal', lastFocusedAt: now - 1000 }),
        createMockWindow({ id: 'win-2', title: 'Minimized', contentId: 'app2', mode: 'minimized', lastFocusedAt: now }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={windows} onSelect={onSelect} onCancel={onCancel} />);

      // Minimized window should be first (most recent)
      const items = screen.getAllByText(/app/);
      expect(items[0]).toHaveTextContent('app2'); // Minimized but most recent
      expect(items[1]).toHaveTextContent('app1');
    });
  });

  describe('Edge Cases', () => {
    it('displays empty state when no windows', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      render(<WindowSwitcher windows={[]} onSelect={onSelect} onCancel={onCancel} />);

      expect(screen.getByText('No windows open')).toBeInTheDocument();
    });

    it('does not call onSelect when Enter pressed with no windows', () => {
      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container } = render(<WindowSwitcher windows={[]} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;
      fireEvent.keyDown(overlay, { key: 'Enter' });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('resets selection to 0 when windows list changes', () => {
      const windows1: WindowState[] = [
        createMockWindow({ id: 'win-1', title: 'Window 1', contentId: 'app1', lastFocusedAt: 2 }),
        createMockWindow({ id: 'win-2', title: 'Window 2', contentId: 'app2', lastFocusedAt: 1 }),
      ];

      const windows2: WindowState[] = [
        createMockWindow({ id: 'win-3', title: 'Window 3', contentId: 'app3', lastFocusedAt: 3 }),
      ];

      const onSelect = vi.fn();
      const onCancel = vi.fn();

      const { container, rerender } = render(<WindowSwitcher windows={windows1} onSelect={onSelect} onCancel={onCancel} />);

      const overlay = container.querySelector('div[tabindex="0"]') as HTMLElement;

      // Navigate to second window
      fireEvent.keyDown(overlay, { key: 'Tab' });

      // Change windows list
      rerender(<WindowSwitcher windows={windows2} onSelect={onSelect} onCancel={onCancel} />);

      // Press Enter - should select first window of new list
      fireEvent.keyDown(overlay, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledWith('win-3');
    });
  });
});
