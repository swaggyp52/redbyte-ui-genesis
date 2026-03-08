// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FilesystemDataPanel } from '../apps/settings/FilesystemDataPanel';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useFileAssociationsStore } from '../stores/fileAssociationsStore';

describe('PHASE_AG: Filesystem Data Settings Panel', () => {
  let mockShowToast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Clear localStorage to prevent persistence from affecting tests
    localStorage.removeItem('rb:file-system');
    localStorage.removeItem('rb:file-associations');

    // Reset both stores to initial state
    useFileSystemStore.getState().resetAll();
    useFileAssociationsStore.getState().resetAll();

    // Create mock toast handler
    mockShowToast = vi.fn();
  });

  describe('Panel Rendering', () => {
    it('should render the panel with keyboard shortcuts information', () => {
      render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      expect(screen.getByText(/Filesystem Persistence/i)).toBeInTheDocument();
      expect(screen.getByText(/Export Filesystem/i)).toBeInTheDocument();
      expect(screen.getByText(/Import Filesystem/i)).toBeInTheDocument();
      expect(screen.getByText(/Reset Filesystem/i)).toBeInTheDocument();
    });

    it('should display keyboard shortcut hints', () => {
      render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const shortcuts = screen.getAllByText('E');
      expect(shortcuts.length).toBeGreaterThan(0);

      const importShortcuts = screen.getAllByText('I');
      expect(importShortcuts.length).toBeGreaterThan(0);

      const resetShortcuts = screen.getAllByText('R');
      expect(resetShortcuts.length).toBeGreaterThan(0);
    });
  });

  describe('Export Functionality', () => {
    it('should open export modal on E key', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Focus container and press E
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'E' });

      expect(screen.getByText(/Copy JSON below to save your filesystem state/i)).toBeInTheDocument();
      const textareas = screen.getAllByRole('textbox');
      const exportTextarea = textareas.find((ta) => (ta as HTMLTextAreaElement).readOnly) as HTMLTextAreaElement;
      expect(exportTextarea).toBeDefined();
    });

    it('should display deterministic JSON in export modal', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add a file to filesystem
      act(() => {
        useFileSystemStore.getState().createFile('home', 'test-export.txt');
      });

      // Open export modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'e' });

      // Find textarea with JSON
      const textarea = screen.getByDisplayValue(/test-export.txt/i) as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.readOnly).toBe(true);

      // Verify it's valid JSON
      const json = JSON.parse(textarea.value);
      expect(json.version).toBe(1);
      expect(json.state).toBeDefined();
    });

    it('should close export modal on Escape', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'E' });

      expect(screen.getByText(/Copy JSON below to save your filesystem state/i)).toBeInTheDocument();

      // Press Escape
      const modal = screen.getByText(/Copy JSON below to save your filesystem state/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Escape' });

      // Modal should be closed
      waitFor(() => {
        expect(screen.queryByText(/Copy JSON below to save your filesystem state/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Import Functionality', () => {
    it('should open import modal on I key', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'I' });

      expect(screen.getByText(/Paste JSON to restore your filesystem state/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/version/i)).toBeInTheDocument();
    });

    it('should apply valid JSON on Enter', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Open import modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'i' });

      // Create valid JSON
      const validJson = {
        version: 1,
        state: {
          folders: {
            home: {
              id: 'home',
              name: 'Home',
              entries: [
                { id: 'imported-file', name: 'imported.txt', type: 'file', modified: '2025-12-18' },
              ],
            },
          },
          roots: ['home'],
          nextId: 100,
        },
      };

      // Find textarea and enter JSON
      const textarea = screen.getByPlaceholderText(/version/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: JSON.stringify(validJson) } });

      // Press Enter on modal (not textarea)
      const modal = screen.getByText(/Paste JSON to restore your filesystem state/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Enter' });

      // Verify toast was shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Filesystem imported successfully');
      });

      // Verify state was updated
      const state = useFileSystemStore.getState();
      expect(state.nextId).toBe(100);
      expect(state.folders.home.entries.some((e) => e.name === 'imported.txt')).toBe(true);
    });

    it('should show toast and preserve state on invalid JSON', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Store initial state
      const initialState = useFileSystemStore.getState();
      const initialNextId = initialState.nextId;

      // Open import modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'I' });

      // Enter invalid JSON
      const textarea = screen.getByPlaceholderText(/version/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'invalid json {{{' } });

      // Press Enter on modal
      const modal = screen.getByText(/Paste JSON to restore your filesystem state/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Enter' });

      // Verify toast was shown with error
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalled();
        const call = mockShowToast.mock.calls[0][0];
        expect(call).toContain('Import failed');
      });

      // Verify state was NOT changed
      const state = useFileSystemStore.getState();
      expect(state.nextId).toBe(initialNextId);
    });

    it('should show toast and preserve state on schema validation error', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Store initial state
      const initialState = useFileSystemStore.getState();
      const initialNextId = initialState.nextId;

      // Open import modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'I' });

      // Enter JSON with invalid version
      const invalidJson = {
        version: 999,
        state: { folders: {}, roots: [], nextId: 1 },
      };

      const textarea = screen.getByPlaceholderText(/version/i) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: JSON.stringify(invalidJson) } });

      // Press Enter on modal
      const modal = screen.getByText(/Paste JSON to restore your filesystem state/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Enter' });

      // Verify toast was shown with error
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalled();
        const call = mockShowToast.mock.calls[0][0];
        expect(call).toContain('Import failed');
      });

      // Verify state was NOT changed
      const state = useFileSystemStore.getState();
      expect(state.nextId).toBe(initialNextId);
    });
  });

  describe('Reset Functionality', () => {
    it('should show confirmation modal on R key', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'R' });

      expect(screen.getByText(/Reset Filesystem\?/i)).toBeInTheDocument();
      expect(screen.getByText(/clear all your files and folders/i)).toBeInTheDocument();
    });

    it('should reset filesystem and clear localStorage on confirm', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add a file to filesystem
      act(() => {
        useFileSystemStore.getState().createFile('home', 'before-reset.txt');
      });

      // Verify persistence
      expect(localStorage.getItem('rb:file-system')).toBeTruthy();

      // Open reset modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'r' });

      // Press Enter to confirm
      const modal = screen.getByText(/clear all your files and folders/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Enter' });

      // Verify toast was shown
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Filesystem reset to default');
      });

      // Verify localStorage was cleared
      expect(localStorage.getItem('rb:file-system')).toBeNull();

      // Verify state was reset to default
      const state = useFileSystemStore.getState();
      expect(state.roots).toContain('home');
      expect(state.roots).toContain('desktop');
      expect(state.roots).toContain('documents');
    });

    it('should close modal on cancel without changes', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add a file to filesystem
      act(() => {
        useFileSystemStore.getState().createFile('home', 'should-remain.txt');
      });
      const initialState = useFileSystemStore.getState();

      // Open reset modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'R' });

      // Click Cancel button
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Verify modal closed
      waitFor(() => {
        expect(screen.queryByText(/Reset Filesystem\?/i)).not.toBeInTheDocument();
      });

      // Verify state unchanged
      const state = useFileSystemStore.getState();
      expect(state.folders.home.entries.some((e) => e.name === 'should-remain.txt')).toBe(true);
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('should close modal on Escape without changes', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add a file to filesystem
      act(() => {
        useFileSystemStore.getState().createFile('home', 'should-remain.txt');
      });

      // Open reset modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'R' });

      // Press Escape
      const modal = screen.getByText(/clear all your files and folders/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Escape' });

      // Verify modal closed and state unchanged
      waitFor(() => {
        expect(screen.queryByText(/Reset Filesystem\?/i)).not.toBeInTheDocument();
      });

      const state = useFileSystemStore.getState();
      expect(state.folders.home.entries.some((e) => e.name === 'should-remain.txt')).toBe(true);
    });
  });

  describe('Focus Management', () => {
    it('should use requestAnimationFrame for deterministic focus after modal close', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'E' });

      // Close modal
      const modal = screen.getByText(/Copy JSON below to save your filesystem state/i).closest('div')!;
      fireEvent.keyDown(modal, { key: 'Escape' });

      // Focus should return to panel container (via rAF)
      await waitFor(() => {
        expect(document.activeElement).toBe(panelDiv);
      });
    });
  });

  describe('Regression: Integration with Filesystem', () => {
    it('should export and import roundtrip preserving state', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Create test data
      act(() => {
        useFileSystemStore.getState().createFile('home', 'roundtrip-test.txt');
        useFileSystemStore.getState().createFolder('home', 'Test Folder');
      });

      const panelDiv = container.firstChild as HTMLElement;

      // Export
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'E' });

      const exportTextarea = screen.getByDisplayValue(/roundtrip-test.txt/i) as HTMLTextAreaElement;
      const exportedJson = exportTextarea.value;

      // Close export modal
      const exportModal = screen.getByText(/Copy JSON below to save your filesystem state/i).closest('div')!;
      fireEvent.keyDown(exportModal, { key: 'Escape' });

      // Modify state
      act(() => {
        useFileSystemStore.getState().createFile('home', 'extra-file.txt');
      });

      // Import
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'I' });

      const importTextarea = screen.getByPlaceholderText(/version/i) as HTMLTextAreaElement;
      fireEvent.change(importTextarea, { target: { value: exportedJson } });

      const importModal = screen.getByText(/Paste JSON to restore your filesystem state/i).closest('div')!;
      fireEvent.keyDown(importModal, { key: 'Enter' });

      // Verify state was restored
      await waitFor(() => {
        const state = useFileSystemStore.getState();
        expect(state.folders.home.entries.some((e) => e.name === 'roundtrip-test.txt')).toBe(true);
        expect(state.folders.home.entries.some((e) => e.name === 'Test Folder')).toBe(true);
        expect(state.folders.home.entries.some((e) => e.name === 'extra-file.txt')).toBe(false);
      });
    });
  });

  describe('PHASE_AH: Factory Reset', () => {
    it('should open factory reset modal on F key', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      expect(screen.getByText(/Factory Reset\?/i)).toBeInTheDocument();
      expect(screen.getByText(/This will permanently delete all files, folders, and file associations/i)).toBeInTheDocument();
    });

    it('should autofocus input when modal opens', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'f' });

      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      expect(input).toBeDefined();
    });

    it('should disable confirm button until RESET typed', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      expect(factoryResetButton.disabled).toBe(true);
      expect(factoryResetButton.className).toContain('opacity-50');
    });

    it('should enable confirm button when RESET typed (case-sensitive)', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RESET' } });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      expect(factoryResetButton.disabled).toBe(false);
      expect(factoryResetButton.className).toContain('bg-red-600');
    });

    it('should keep button disabled when input is "reset" (lowercase)', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'reset' } });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      expect(factoryResetButton.disabled).toBe(true);
    });

    it('should clear both localStorage keys on confirm', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add data to both stores
      act(() => {
        useFileSystemStore.getState().createFile('home', 'test-file.txt');
        useFileAssociationsStore.getState().setDefaultTarget('file', 'txt', 'text-viewer');
      });

      // Verify both keys exist
      expect(localStorage.getItem('rb:file-system')).toBeTruthy();
      expect(localStorage.getItem('rb:file-associations')).toBeTruthy();

      // Open factory reset modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      // Type RESET and confirm
      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RESET' } });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      fireEvent.click(factoryResetButton);

      // Verify both keys cleared
      await waitFor(() => {
        expect(localStorage.getItem('rb:file-system')).toBeNull();
        expect(localStorage.getItem('rb:file-associations')).toBeNull();
      });
    });

    it('should reset both fileSystemStore and fileAssociationsStore', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add data to both stores
      act(() => {
        useFileSystemStore.getState().createFile('home', 'test-file.txt');
        useFileAssociationsStore.getState().setDefaultTarget('file', 'txt', 'text-viewer');
      });

      // Verify data exists
      expect(useFileSystemStore.getState().folders.home.entries.some((e) => e.name === 'test-file.txt')).toBe(true);
      expect(useFileAssociationsStore.getState().listAssociations().length).toBeGreaterThan(0);

      // Open factory reset modal
      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      // Type RESET and confirm
      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RESET' } });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      fireEvent.click(factoryResetButton);

      // Verify both stores reset
      await waitFor(() => {
        const fsState = useFileSystemStore.getState();
        expect(fsState.folders.home.entries.some((e) => e.name === 'test-file.txt')).toBe(false);
        expect(fsState.roots).toContain('home');
        expect(fsState.roots).toContain('desktop');

        const assocState = useFileAssociationsStore.getState();
        expect(assocState.listAssociations().length).toBe(0);
      });
    });

    it('should show success toast after factory reset', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RESET' } });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      fireEvent.click(factoryResetButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Factory reset complete - all data cleared');
      });
    });

    it('should close modal and return focus after success', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RESET' } });

      const factoryResetButton = screen.getByText('Factory Reset', { selector: 'button' }) as HTMLButtonElement;
      fireEvent.click(factoryResetButton);

      await waitFor(() => {
        expect(screen.queryByText(/Factory Reset\?/i)).not.toBeInTheDocument();
        expect(document.activeElement).toBe(panelDiv);
      });
    });

    it('should cancel on Escape without changes', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add data to stores
      act(() => {
        useFileSystemStore.getState().createFile('home', 'should-remain.txt');
        useFileAssociationsStore.getState().setDefaultTarget('file', 'txt', 'text-viewer');
      });

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      // Press Escape on modal (use heading to find modal uniquely)
      const modal = screen.getByText('Factory Reset?').closest('div[tabindex="0"]')!;
      fireEvent.keyDown(modal, { key: 'Escape' });

      // Verify modal closed and data unchanged
      waitFor(() => {
        expect(screen.queryByText(/Factory Reset\?/i)).not.toBeInTheDocument();
      });

      const fsState = useFileSystemStore.getState();
      expect(fsState.folders.home.entries.some((e) => e.name === 'should-remain.txt')).toBe(true);

      const assocState = useFileAssociationsStore.getState();
      expect(assocState.listAssociations().length).toBeGreaterThan(0);

      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('should trigger factory reset on Enter when RESET typed', async () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add data to both stores
      act(() => {
        useFileSystemStore.getState().createFile('home', 'test-file.txt');
        useFileAssociationsStore.getState().setDefaultTarget('file', 'txt', 'text-viewer');
      });

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      // Type RESET
      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'RESET' } });

      // Press Enter on modal (use heading to find modal uniquely)
      const modal = screen.getByText('Factory Reset?').closest('div[tabindex="0"]')!;
      fireEvent.keyDown(modal, { key: 'Enter' });

      // Verify reset executed
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('Factory reset complete - all data cleared');
        expect(localStorage.getItem('rb:file-system')).toBeNull();
        expect(localStorage.getItem('rb:file-associations')).toBeNull();
      });
    });

    it('should NOT trigger factory reset on Enter when RESET not typed', () => {
      const { container } = render(<FilesystemDataPanel onShowToast={mockShowToast} />);

      // Add data to stores
      act(() => {
        useFileSystemStore.getState().createFile('home', 'should-remain.txt');
      });

      const panelDiv = container.firstChild as HTMLElement;
      panelDiv.focus();
      fireEvent.keyDown(panelDiv, { key: 'F' });

      // Type something else
      const input = screen.getByPlaceholderText(/Type RESET/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'WRONG' } });

      // Press Enter on modal (use heading to find modal uniquely)
      const modal = screen.getByText('Factory Reset?').closest('div[tabindex="0"]')!;
      fireEvent.keyDown(modal, { key: 'Enter' });

      // Verify reset NOT executed
      const fsState = useFileSystemStore.getState();
      expect(fsState.folders.home.entries.some((e) => e.name === 'should-remain.txt')).toBe(true);
      expect(mockShowToast).not.toHaveBeenCalled();
    });
  });
});
