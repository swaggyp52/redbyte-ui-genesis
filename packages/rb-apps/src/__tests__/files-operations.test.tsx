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
});
