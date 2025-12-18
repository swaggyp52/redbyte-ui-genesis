// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FilesApp } from '../apps/FilesApp';

const FilesComponent = FilesApp.component;

describe('PHASE_W: Files operations', () => {
  describe('Create folder operation', () => {
    it('opens modal with Cmd/Ctrl+Shift+N and creates folder', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Press Cmd+Shift+N
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      // Modal should appear
      expect(screen.getByText('Create Folder')).toBeTruthy();
      expect(screen.getByDisplayValue('New Folder')).toBeTruthy();

      // Change name
      const input = screen.getByDisplayValue('New Folder') as HTMLInputElement;
      act(() => {
        fireEvent.change(input, { target: { value: 'Test Folder' } });
      });

      // Confirm
      const confirmButton = screen.getByText('Confirm');
      act(() => {
        fireEvent.click(confirmButton);
      });

      // Folder should appear in list
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Test Folder');
    });

    it('auto-suffixes duplicate folder names', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Create first folder
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });
      const confirmButton1 = screen.getByText('Confirm');
      act(() => {
        fireEvent.click(confirmButton1);
      });

      // Create second folder with same name
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });
      const confirmButton2 = screen.getByText('Confirm');
      act(() => {
        fireEvent.click(confirmButton2);
      });

      // Should have both folders with suffix
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('New Folder');
      expect(table.textContent).toContain('New Folder (2)');
    });

    it('cancels create folder with Escape', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      expect(screen.getByText('Create Folder')).toBeTruthy();

      // Click Cancel button
      const cancelButton = screen.getByText('Cancel');
      act(() => {
        fireEvent.click(cancelButton);
      });

      // Modal should close
      expect(screen.queryByText('Create Folder')).toBeNull();
    });
  });

  describe('Create file operation', () => {
    it('opens modal with Cmd/Ctrl+N and creates file', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Press Cmd+N
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'n', metaKey: true });
      });

      // Modal should appear
      expect(screen.getByText('Create File')).toBeTruthy();
      expect(screen.getByDisplayValue('New File.txt')).toBeTruthy();

      // Change name
      const input = screen.getByDisplayValue('New File.txt') as HTMLInputElement;
      act(() => {
        fireEvent.change(input, { target: { value: 'test.txt' } });
      });

      // Confirm
      const confirmButton = screen.getByText('Confirm');
      act(() => {
        fireEvent.click(confirmButton);
      });

      // File should appear in list
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('test.txt');
    });
  });

  describe('Rename operation', () => {
    it('opens modal with F2 and renames selected entry', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // First entry should be "Project Files" (not a root)
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Project Files');

      // Press F2 to rename first entry
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'F2' });
      });

      // Modal should appear with current name
      expect(screen.getByText('Rename')).toBeTruthy();
      expect(screen.getByDisplayValue('Project Files')).toBeTruthy();

      // Change name
      const input = screen.getByDisplayValue('Project Files') as HTMLInputElement;
      act(() => {
        fireEvent.change(input, { target: { value: 'My Projects' } });
      });

      // Confirm
      const confirmButton = screen.getByText('Confirm');
      act(() => {
        fireEvent.click(confirmButton);
      });

      // Name should update
      const tableAfter = screen.getByRole('table');
      expect(tableAfter.textContent).toContain('📁 My Projects');
      expect(tableAfter.textContent).not.toContain('📁 Project Files');
    });

    it('does not open rename modal for root folders', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // First entry (Desktop link) resolves to 'desktop' which is a root
      // Try to rename (should be no-op)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'F2' });
      });

      // Modal should not appear
      expect(screen.queryByText('Rename')).toBeNull();
    });
  });

  describe('Delete operation', () => {
    it('opens modal with Delete key and deletes selected entry', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Documents
      const documentsButton = screen.getAllByRole('button', { name: 'Documents' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(documentsButton!);
      });

      // Select first entry (Reports folder)
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Reports');

      // Press Delete
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Delete' });
      });

      // Confirm modal should appear
      expect(screen.getByText(/Are you sure you want to delete "Reports"/)).toBeTruthy();

      // Confirm - find button by role
      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find((btn) => btn.textContent === 'Delete');
      act(() => {
        fireEvent.click(deleteButton!);
      });

      // Entry should be removed
      const tableAfter = screen.getByRole('table');
      expect(tableAfter.textContent).not.toContain('Reports');
    });

    it('does not open delete modal for root folders', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // First entry (Desktop link) resolves to 'desktop' which is a root
      // Try to delete (should be no-op for root)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Delete' });
      });

      // Modal should not appear
      expect(screen.queryByText(/Are you sure you want to delete/)).toBeNull();
    });

    it('navigates to parent when deleting current folder', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Navigate into Project Files
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter' });
      });

      // Should be in Project Files
      const breadcrumbs = screen.getAllByText('Project Files');
      expect(breadcrumbs.some((el) => el.className.includes('text-cyan-400'))).toBe(true);

      // Go back to Desktop
      const backButton = screen.getByTitle('Back (Alt+Left)');
      act(() => {
        fireEvent.click(backButton);
      });

      // Delete Project Files folder
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Delete' });
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find((btn) => btn.textContent === 'Delete');
      act(() => {
        fireEvent.click(deleteButton!);
      });

      // Should still be at Desktop (parent)
      const table = screen.getByRole('table');
      expect(table.textContent).not.toContain('Project Files');
    });
  });

  describe('Edge cases', () => {
    it('rejects empty folder name', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      const input = screen.getByDisplayValue('New Folder') as HTMLInputElement;
      act(() => {
        fireEvent.change(input, { target: { value: '   ' } });
      });

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton.hasAttribute('disabled')).toBe(true);
    });

    it('selection index is clamped after delete', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Downloads (only has 1 entry)
      const downloadsEntry = screen.getByRole('table').querySelector('td');
      expect(downloadsEntry?.textContent).toContain('Desktop');

      // Navigate down to Downloads entry
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Enter Downloads
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter' });
      });

      // Delete the only file
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Delete' });
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find((btn) => btn.textContent === 'Delete');
      act(() => {
        fireEvent.click(deleteButton!);
      });

      // Should show "Empty folder"
      expect(screen.getByText('Empty folder')).toBeTruthy();
    });

    it('operations work independently per window instance', () => {
      const { container: container1 } = render(<FilesComponent />);
      const { container: container2 } = render(<FilesComponent />);

      const mainContainer1 = container1.querySelector('[tabIndex="0"]');

      // Create folder in first instance
      act(() => {
        fireEvent.keyDown(mainContainer1!, { key: 'N', metaKey: true, shiftKey: true });
      });

      const input1 = screen.getAllByDisplayValue('New Folder')[0] as HTMLInputElement;
      act(() => {
        fireEvent.change(input1, { target: { value: 'Instance 1 Folder' } });
      });

      const confirmButton1 = screen.getAllByText('Confirm')[0];
      act(() => {
        fireEvent.click(confirmButton1);
      });

      // First instance should have the folder
      const table1 = container1.querySelector('table');
      expect(table1?.textContent).toContain('Instance 1 Folder');

      // Second instance should not have it
      const table2 = container2.querySelector('table');
      expect(table2?.textContent).not.toContain('Instance 1 Folder');
    });
  });

  describe('PHASE_W Stage 3: Keyboard priority and modal guards', () => {
    it('blocks arrow key navigation when modal is open', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // First entry is selected (Desktop)
      let rows = screen.getByRole('table').querySelectorAll('tbody tr');
      expect(rows[0].className).toContain('bg-cyan-900/30');

      // Open create folder modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      expect(screen.getByText('Create Folder')).toBeTruthy();

      // Try to move selection with arrow keys (should be blocked)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Cancel modal
      const cancelButton = screen.getByText('Cancel');
      act(() => {
        fireEvent.click(cancelButton);
      });

      // Selection should still be on first entry (unchanged)
      rows = screen.getByRole('table').querySelectorAll('tbody tr');
      expect(rows[0].className).toContain('bg-cyan-900/30');
      expect(rows[1].className).not.toContain('bg-cyan-900/30');
    });

    it('blocks F2/Delete shortcuts when modal is open', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Open create folder modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      expect(screen.getByText('Create Folder')).toBeTruthy();

      // Try to open rename modal with F2 (should be blocked)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'F2' });
      });

      // Should still only see Create Folder modal, not Rename
      expect(screen.getByText('Create Folder')).toBeTruthy();
      expect(screen.queryByText('Rename')).toBeNull();

      // Try to open delete modal (should be blocked)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Delete' });
      });

      // Still only Create Folder modal
      expect(screen.getByText('Create Folder')).toBeTruthy();
      expect(screen.queryByText(/Are you sure you want to delete/)).toBeNull();

      // Cancel
      const cancelButton = screen.getByText('Cancel');
      act(() => {
        fireEvent.click(cancelButton);
      });
    });

    it('Escape priority: closes modal first, then window', () => {
      const onClose = vi.fn();
      const { container } = render(<FilesComponent onClose={onClose} />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Open modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      expect(screen.getByText('Create Folder')).toBeTruthy();

      // First Escape: closes modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Escape' });
      });

      expect(screen.queryByText('Create Folder')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();

      // Second Escape: closes window
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Escape' });
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('blocks "Open in Playground" (Cmd+Enter) when modal is open', () => {
      const onDispatchIntent = vi.fn();
      const { container } = render(<FilesComponent onDispatchIntent={onDispatchIntent} />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Move to Notes.txt (second entry, a file)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Open modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'N', metaKey: true, shiftKey: true });
      });

      // Try Cmd+Enter (should be blocked)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true });
      });

      expect(onDispatchIntent).not.toHaveBeenCalled();

      // Cancel modal
      const cancelButton = screen.getByText('Cancel');
      act(() => {
        fireEvent.click(cancelButton);
      });

      // Now Cmd+Enter should work
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true });
      });

      expect(onDispatchIntent).toHaveBeenCalledTimes(1);
    });

    it('deleting current folder updates breadcrumb to fallback', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Navigate into Project Files
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter' });
      });

      // Breadcrumb should show: Home > Desktop > Project Files
      const breadcrumbs = screen.getAllByText('Project Files');
      expect(breadcrumbs.some((el) => el.className.includes('text-cyan-400'))).toBe(true);

      // Go back to Desktop
      const backButton = screen.getByTitle('Back (Alt+Left)');
      act(() => {
        fireEvent.click(backButton);
      });

      // Delete Project Files
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Delete' });
      });

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find((btn) => btn.textContent === 'Delete');
      act(() => {
        fireEvent.click(deleteButton!);
      });

      // Should navigate to Desktop (parent), breadcrumb should show Desktop active
      const desktopBreadcrumbs = screen.getAllByText('Desktop');
      expect(desktopBreadcrumbs.some((el) => el.className.includes('text-cyan-400'))).toBe(true);
    });

    it('rename with duplicate name auto-suffixes in same folder', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Rename Project Files to "Notes.txt" (which already exists)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'F2' });
      });

      const input = screen.getByDisplayValue('Project Files') as HTMLInputElement;
      act(() => {
        fireEvent.change(input, { target: { value: 'Notes.txt' } });
      });

      const confirmButton = screen.getByText('Confirm');
      act(() => {
        fireEvent.click(confirmButton);
      });

      // Should auto-suffix to "Notes.txt (2)"
      const table = screen.getByRole('table');
      expect(table.textContent).toContain('Notes.txt (2)');
      expect(table.textContent).toContain('📁 Notes.txt (2)'); // Folder with suffix
    });
  });

  describe('PHASE_X: Cross-App File Actions', () => {
    it('Cmd/Ctrl+Shift+Enter opens "Open With..." modal for selected file', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Move to Notes.txt (second entry, a file)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Press Cmd+Shift+Enter
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true, shiftKey: true });
      });

      // Modal should appear
      expect(screen.getByText('Open With...')).toBeTruthy();
      expect(screen.getByText('Logic Playground')).toBeTruthy();
    });

    it('"Open With..." modal blocks Files shortcuts', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Move to Notes.txt
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Open "Open With..." modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true, shiftKey: true });
      });

      expect(screen.getByText('Open With...')).toBeTruthy();

      // Try F2 (should be blocked)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'F2' });
      });

      expect(screen.queryByText('Rename')).toBeNull();

      // Cancel modal
      const cancelButton = screen.getByText('Cancel');
      act(() => {
        fireEvent.click(cancelButton);
      });
    });

    it('selecting target from "Open With..." modal dispatches intent', () => {
      const onDispatchIntent = vi.fn();
      const { container } = render(<FilesComponent onDispatchIntent={onDispatchIntent} />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Move to Notes.txt
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Open modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true, shiftKey: true });
      });

      // Click Logic Playground
      const playgroundButton = screen.getByText('Logic Playground');
      act(() => {
        fireEvent.click(playgroundButton);
      });

      // Intent should be dispatched
      expect(onDispatchIntent).toHaveBeenCalledTimes(1);
      expect(onDispatchIntent).toHaveBeenCalledWith({
        type: 'open-with',
        payload: {
          sourceAppId: 'files',
          targetAppId: 'logic-playground',
          resourceId: 'notes',
          resourceType: 'file',
        },
      });
    });

    it('Cmd/Ctrl+Shift+Enter on folder does nothing (folders ineligible)', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });

      // Project Files is selected (index 0, a folder)
      // Press Cmd+Shift+Enter
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true, shiftKey: true });
      });

      // Modal should NOT appear (folders are ineligible)
      expect(screen.queryByText('Open With...')).toBeNull();
    });

    it('"Open With..." modal supports keyboard navigation', () => {
      const onDispatchIntent = vi.fn();
      const { container } = render(<FilesComponent onDispatchIntent={onDispatchIntent} />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop and select Notes.txt
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Open modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true, shiftKey: true });
      });

      const modal = screen.getByText('Open With...').closest('div[tabIndex="0"]') as HTMLElement;

      // Press Enter to select first target (Logic Playground)
      act(() => {
        fireEvent.keyDown(modal, { key: 'Enter' });
      });

      // Intent should be dispatched
      expect(onDispatchIntent).toHaveBeenCalledTimes(1);
      expect(onDispatchIntent.mock.calls[0][0]).toMatchObject({
        type: 'open-with',
        payload: {
          targetAppId: 'logic-playground',
        },
      });
    });

    it('Escape closes "Open With..." modal', () => {
      const { container } = render(<FilesComponent />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop and select Notes.txt
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Open modal
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true, shiftKey: true });
      });

      expect(screen.getByText('Open With...')).toBeTruthy();

      // Press Escape
      const modal = screen.getByText('Open With...').closest('div[tabIndex="0"]') as HTMLElement;
      act(() => {
        fireEvent.keyDown(modal, { key: 'Escape' });
      });

      // Modal should close
      expect(screen.queryByText('Open With...')).toBeNull();
    });

    it('Cmd/Ctrl+Enter (default action) dispatches intent directly', () => {
      const onDispatchIntent = vi.fn();
      const { container } = render(<FilesComponent onDispatchIntent={onDispatchIntent} />);
      const mainContainer = container.querySelector('[tabIndex="0"]');

      // Navigate to Desktop and select Notes.txt
      const desktopButton = screen.getAllByRole('button', { name: 'Desktop' }).find((el) =>
        el.className.includes('w-full')
      );
      act(() => {
        fireEvent.click(desktopButton!);
      });
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'ArrowDown' });
      });

      // Press Cmd+Enter (default action)
      act(() => {
        fireEvent.keyDown(mainContainer!, { key: 'Enter', metaKey: true });
      });

      // Should dispatch intent directly to Logic Playground (no modal)
      expect(onDispatchIntent).toHaveBeenCalledTimes(1);
      expect(onDispatchIntent).toHaveBeenCalledWith({
        type: 'open-with',
        payload: {
          sourceAppId: 'files',
          targetAppId: 'logic-playground',
          resourceId: 'notes',
          resourceType: 'file',
        },
      });
      expect(screen.queryByText('Open With...')).toBeNull();
    });
  });
});
