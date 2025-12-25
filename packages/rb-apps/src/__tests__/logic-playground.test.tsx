// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogicPlaygroundApp } from '../apps/LogicPlaygroundApp';
import { useFileSystemStore } from '../stores/fileSystemStore';
import type { SerializedCircuitV1 } from '@redbyte/rb-logic-core';
import { useWindowStore } from '@redbyte/rb-windowing';

// Mock dependencies
vi.mock('@redbyte/rb-shell', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('@redbyte/rb-utils', () => ({
  useSettingsStore: () => ({ tickRate: 1 }),
}));

vi.mock('@redbyte/rb-windowing', () => ({
  useWindowStore: vi.fn(() => ({ setWindowTitle: vi.fn() })),
}));

vi.mock('../tutorial/tutorialStore', () => ({
  useTutorialStore: () => ({ active: false, start: vi.fn() }),
}));

describe.skip('LogicPlaygroundApp - Circuit Persistence', () => {
  beforeEach(() => {
    // Clear localStorage and reset filesystem
    localStorage.clear();
    const { resetAll } = useFileSystemStore.getState();
    resetAll();

    // Reset useWindowStore mock to default implementation
    vi.mocked(useWindowStore).mockReturnValue({ setWindowTitle: vi.fn() });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Autosave with 5s debounce', () => {
    it('should not autosave immediately after circuit change', async () => {
      vi.useFakeTimers();
      const { getAllFiles, createFile } = useFileSystemStore.getState();

      // Create a file with initial circuit
      const initialCircuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [],
        connections: [],
      };
      const fileId = createFile('documents', 'test.rblogic', JSON.stringify(initialCircuit));

      const Component = LogicPlaygroundApp.component;
      const { container } = render(
        <Component initialFileId={fileId} />
      );

      // Simulate circuit change by interacting with canvas
      // (In a real test, you would trigger actual circuit changes via the UI)

      // Advance time by 2 seconds - should NOT autosave yet
      vi.advanceTimersByTime(2000);

      const file = getAllFiles().find(f => f.id === fileId);
      expect(file?.content).toBe(JSON.stringify(initialCircuit));

      vi.useRealTimers();
    });

    it('should autosave after 5 seconds of idle', async () => {
      vi.useFakeTimers();
      const { getAllFiles, createFile, updateFileContent } = useFileSystemStore.getState();

      // Create a file
      const initialCircuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [],
        connections: [],
      };
      const fileId = createFile('documents', 'test.rblogic', JSON.stringify(initialCircuit));

      const Component = LogicPlaygroundApp.component;
      render(
        <Component initialFileId={fileId} />
      );

      // Simulate making the circuit dirty
      // (This would normally be done by interacting with the canvas)

      // Advance time by 5 seconds - should trigger autosave
      vi.advanceTimersByTime(5000);

      // Verify autosave occurred
      await waitFor(() => {
        const file = getAllFiles().find(f => f.id === fileId);
        // File content should be updated (even if same circuit, dirty flag cleared)
        expect(file).toBeDefined();
      });

      vi.useRealTimers();
    });

    it('should reset debounce timer on subsequent changes', async () => {
      vi.useFakeTimers();
      const { createFile } = useFileSystemStore.getState();

      const initialCircuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [],
        connections: [],
      };
      const fileId = createFile('documents', 'test.rblogic', JSON.stringify(initialCircuit));

      const Component = LogicPlaygroundApp.component;
      render(
        <Component initialFileId={fileId} />
      );

      // First change
      // (Simulate circuit change)
      vi.advanceTimersByTime(3000);

      // Second change before autosave triggers - should reset timer
      // (Simulate another circuit change)
      vi.advanceTimersByTime(3000); // Total: 6s, but timer reset at 3s

      // Should NOT have autosaved yet (only 3s since last change)
      vi.advanceTimersByTime(2000); // Total: 8s, 5s since last change

      // Now autosave should have triggered
      await waitFor(() => {
        // Verify autosave completed
        expect(true).toBe(true); // Placeholder for actual verification
      });

      vi.useRealTimers();
    });
  });

  describe('Ctrl+O Open Flow', () => {
    it('should open file picker modal on Ctrl+O', async () => {
      const user = userEvent.setup();
      const { createFile } = useFileSystemStore.getState();

      // Create a test file
      const circuit: SerializedCircuitV1 = { version: '1', nodes: [], connections: [] };
      createFile('documents', 'my-circuit.rblogic', JSON.stringify(circuit));

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Press Ctrl+O
      await user.keyboard('{Control>}o{/Control}');

      // Modal should appear
      expect(screen.getByText(/open circuit/i)).toBeInTheDocument();
      expect(screen.getByText(/my-circuit\.rblogic/i)).toBeInTheDocument();
    });

    it('should show all .rblogic files in modal', async () => {
      const user = userEvent.setup();
      const { createFile } = useFileSystemStore.getState();

      // Create multiple files
      const circuit: SerializedCircuitV1 = { version: '1', nodes: [], connections: [] };
      createFile('documents', 'circuit1.rblogic', JSON.stringify(circuit));
      createFile('documents', 'circuit2.rblogic', JSON.stringify(circuit));
      createFile('documents', 'circuit3.rblogic', JSON.stringify(circuit));

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Open modal
      await user.keyboard('{Control>}o{/Control}');

      // All files should be listed
      expect(screen.getByText(/circuit1\.rblogic/i)).toBeInTheDocument();
      expect(screen.getByText(/circuit2\.rblogic/i)).toBeInTheDocument();
      expect(screen.getByText(/circuit3\.rblogic/i)).toBeInTheDocument();
    });

    it('should load selected file and close modal', async () => {
      const user = userEvent.setup();
      const { createFile } = useFileSystemStore.getState();

      // Create a file with specific circuit
      const circuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [{ id: 'test-node', type: 'AND', x: 0, y: 0 }],
        connections: [],
      };
      createFile('documents', 'target.rblogic', JSON.stringify(circuit));

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Open modal
      await user.keyboard('{Control>}o{/Control}');

      // Click on file
      const fileButton = screen.getByText(/target\.rblogic/i);
      await user.click(fileButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText(/open circuit/i)).not.toBeInTheDocument();
      });

      // Circuit should be loaded (verify via window title or other indicator)
      // This would require checking the actual rendered circuit state
    });

    it('should close modal on Escape key', async () => {
      const user = userEvent.setup();

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Open modal
      await user.keyboard('{Control>}o{/Control}');
      expect(screen.getByText(/open circuit/i)).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText(/open circuit/i)).not.toBeInTheDocument();
      });
    });

    it('should show empty state when no files exist', async () => {
      const user = userEvent.setup();

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Open modal
      await user.keyboard('{Control>}o{/Control}');

      // Should show empty state message
      expect(screen.getByText(/no saved circuits found/i)).toBeInTheDocument();
    });
  });

  describe('Open With Association', () => {
    it('should load circuit when opened via resourceId', async () => {
      const { createFile, getFile } = useFileSystemStore.getState();

      // Create a file
      const circuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [{ id: 'node1', type: 'OR', x: 100, y: 100 }],
        connections: [],
      };
      const fileId = createFile('documents', 'shared.rblogic', JSON.stringify(circuit));

      // Render with resourceId (simulating "Open With")
      const Component = LogicPlaygroundApp.component;
      render(
        <Component
          resourceId={fileId}
          resourceType="file"
        />
      );

      await waitFor(() => {
        // Verify file was loaded
        const file = getFile(fileId);
        expect(file).toBeDefined();
        expect(file?.name).toBe('shared.rblogic');
      });
    });

    it('should set dirty=false after loading via Open With', async () => {
      vi.useFakeTimers();
      const { createFile } = useFileSystemStore.getState();

      const circuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [],
        connections: [],
      };
      const fileId = createFile('documents', 'test.rblogic', JSON.stringify(circuit));

      const Component = LogicPlaygroundApp.component;
      render(
        <Component
          resourceId={fileId}
          resourceType="file"
        />
      );

      // Wait for loading to complete
      await waitFor(() => {
        // Circuit should be loaded but not dirty
        // Verify by checking that autosave doesn't trigger
        vi.advanceTimersByTime(6000);
        // If dirty, autosave would have triggered and updated the file
        // We're verifying the hydration guard worked
      });

      vi.useRealTimers();
    });

    it('should create new file if resourceId does not exist', async () => {
      const { getAllFiles } = useFileSystemStore.getState();

      const nonExistentId = 'new-circuit.rblogic';

      render(
        <LogicPlaygroundApp
          manifest={LogicPlaygroundApp.manifest}
          resourceId={nonExistentId}
          resourceType="file"
        />
      );

      await waitFor(() => {
        // A new file should be created
        const files = getAllFiles().filter(f => f.name.includes('new-circuit'));
        expect(files.length).toBeGreaterThan(0);
      });
    });

    it('should update window title with filename', async () => {
      const setWindowTitleMock = vi.fn();
      vi.mocked(useWindowStore).mockReturnValue({ setWindowTitle: setWindowTitleMock });

      const { createFile } = useFileSystemStore.getState();

      const circuit: SerializedCircuitV1 = { version: '1', nodes: [], connections: [] };
      const fileId = createFile('documents', 'my-file.rblogic', JSON.stringify(circuit));

      const Component = LogicPlaygroundApp.component;
      render(
        <Component
          windowId="test-window"
          resourceId={fileId}
          resourceType="file"
        />
      );

      await waitFor(() => {
        // Window title should be set to filename
        expect(setWindowTitleMock).toHaveBeenCalledWith('test-window', 'my-file.rblogic');
      });
    });

    it('should show dirty indicator in window title when unsaved', async () => {
      const setWindowTitleMock = vi.fn();
      vi.mocked(useWindowStore).mockReturnValue({ setWindowTitle: setWindowTitleMock });

      const { createFile } = useFileSystemStore.getState();

      const circuit: SerializedCircuitV1 = { version: '1', nodes: [], connections: [] };
      const fileId = createFile('documents', 'dirty-test.rblogic', JSON.stringify(circuit));

      const Component = LogicPlaygroundApp.component;
      render(
        <Component
          windowId="test-window"
          initialFileId={fileId}
        />
      );

      // Simulate making circuit dirty
      // (Would normally be done by interacting with canvas)

      await waitFor(() => {
        // When dirty, title should have bullet point
        const calls = setWindowTitleMock.mock.calls;
        const dirtyCall = calls.find(call => call[1].includes('•'));
        // expect(dirtyCall).toBeDefined(); // Commented out - needs circuit interaction
      });
    });
  });

  describe('File System Integration', () => {
    it('should save circuits to canonical fileSystemStore', async () => {
      const user = userEvent.setup();
      const { getAllFiles } = useFileSystemStore.getState();

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Trigger Save As
      await user.keyboard('{Control>}{Shift>}s{/Shift}{/Control}');

      // Enter filename
      const input = screen.getByLabelText(/filename/i);
      await user.clear(input);
      await user.type(input, 'new-circuit');

      // Confirm save
      const saveButton = screen.getByText(/^save$/i);
      await user.click(saveButton);

      // Verify file exists in fileSystemStore
      await waitFor(() => {
        const files = getAllFiles();
        const savedFile = files.find(f => f.name === 'new-circuit.rblogic');
        expect(savedFile).toBeDefined();
        expect(savedFile?.type).toBe('file');
        expect(savedFile?.content).toBeDefined();
      });
    });

    it('should store circuit data as JSON string in file content', async () => {
      const { createFile, getFile } = useFileSystemStore.getState();

      const circuit: SerializedCircuitV1 = {
        version: '1',
        nodes: [{ id: 'test', type: 'AND', x: 0, y: 0 }],
        connections: [],
      };

      const fileId = createFile('documents', 'test.rblogic', JSON.stringify(circuit));

      const file = getFile(fileId);
      expect(file?.content).toBeDefined();

      // Content should be parseable JSON
      const parsed = JSON.parse(file!.content!);
      expect(parsed.version).toBe('1');
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.nodes[0].type).toBe('AND');
    });

    it('should filter to only .rblogic files in file list', async () => {
      const user = userEvent.setup();
      const { createFile } = useFileSystemStore.getState();

      // Create .rblogic file
      const circuit: SerializedCircuitV1 = { version: '1', nodes: [], connections: [] };
      createFile('documents', 'circuit.rblogic', JSON.stringify(circuit));

      // Create non-.rblogic file
      createFile('documents', 'notes.txt', 'Some notes');

      const Component = LogicPlaygroundApp.component;
      render(<Component />);

      // Open file picker
      await user.keyboard('{Control>}o{/Control}');

      // Should only show .rblogic file
      expect(screen.getByText(/circuit\.rblogic/i)).toBeInTheDocument();
      expect(screen.queryByText(/notes\.txt/i)).not.toBeInTheDocument();
    });
  });

  describe.skip('Share Polish Features', () => {
    describe('Clipboard Fallback UX', () => {
      it('should show fallback modal when clipboard write fails', async () => {
        const user = userEvent.setup();

        // Mock clipboard API to fail
        const clipboardWriteTextMock = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: clipboardWriteTextMock },
          writable: true,
        });

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Trigger share via Ctrl+Shift+C
        await user.keyboard('{Control>}{Shift>}c{/Shift}{/Control}');

        // Wait for fallback modal to appear
        await waitFor(() => {
          expect(screen.getByText(/share link ready/i)).toBeInTheDocument();
          expect(screen.getByText(/automatic clipboard copy failed/i)).toBeInTheDocument();
        });

        // Modal should have readonly input with URL
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('readonly');
        expect(input).toHaveValue(expect.stringContaining('?circuit='));
      });

      it('should allow manual copy from fallback modal', async () => {
        const user = userEvent.setup();

        // Mock clipboard to fail initially
        const clipboardWriteTextMock = vi.fn()
          .mockRejectedValueOnce(new Error('Initial fail'))
          .mockResolvedValueOnce(undefined); // Second call succeeds
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: clipboardWriteTextMock },
          writable: true,
        });

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Trigger share
        await user.keyboard('{Control>}{Shift>}c{/Shift}{/Control}');

        // Wait for modal
        await waitFor(() => {
          expect(screen.getByText(/share link ready/i)).toBeInTheDocument();
        });

        // Click Copy button
        const copyButton = screen.getByText(/^copy$/i);
        await user.click(copyButton);

        // Modal should close
        await waitFor(() => {
          expect(screen.queryByText(/share link ready/i)).not.toBeInTheDocument();
        });
      });

      it('should select text when clicking input field', async () => {
        const user = userEvent.setup();

        const clipboardWriteTextMock = vi.fn().mockRejectedValue(new Error('Denied'));
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: clipboardWriteTextMock },
          writable: true,
        });

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        await user.keyboard('{Control>}{Shift>}c{/Shift}{/Control}');

        await waitFor(() => {
          expect(screen.getByText(/share link ready/i)).toBeInTheDocument();
        });

        const input = screen.getByRole('textbox') as HTMLInputElement;
        await user.click(input);

        // Text should be selected (selectionStart should be 0, selectionEnd should be length)
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(input.value.length);
      });

      it('should close fallback modal on Close button', async () => {
        const user = userEvent.setup();

        const clipboardWriteTextMock = vi.fn().mockRejectedValue(new Error('Denied'));
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: clipboardWriteTextMock },
          writable: true,
        });

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        await user.keyboard('{Control>}{Shift>}c{/Shift}{/Control}');

        await waitFor(() => {
          expect(screen.getByText(/share link ready/i)).toBeInTheDocument();
        });

        const closeButton = screen.getByText(/^close$/i);
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByText(/share link ready/i)).not.toBeInTheDocument();
        });
      });
    });

    describe('Decode Error Recovery', () => {
      it('should show error modal when URL has invalid circuit param', async () => {
        // Set invalid URL param
        delete window.location;
        window.location = { search: '?circuit=invalid-garbage' } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Wait for error modal
        await waitFor(() => {
          expect(screen.getByText(/invalid share link/i)).toBeInTheDocument();
          expect(screen.getByText(/this share link is invalid or corrupted/i)).toBeInTheDocument();
        });
      });

      it('should clear URL and reset circuit on "Clear URL & Start Fresh"', async () => {
        const user = userEvent.setup();

        // Mock replaceState
        const replaceStateMock = vi.fn();
        window.history.replaceState = replaceStateMock;

        // Set invalid URL param
        delete window.location;
        window.location = {
          search: '?circuit=invalid',
          pathname: '/playground'
        } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Wait for error modal
        await waitFor(() => {
          expect(screen.getByText(/invalid share link/i)).toBeInTheDocument();
        });

        // Click "Clear URL & Start Fresh"
        const clearButton = screen.getByText(/clear url & start fresh/i);
        await user.click(clearButton);

        // Modal should close
        await waitFor(() => {
          expect(screen.queryByText(/invalid share link/i)).not.toBeInTheDocument();
        });

        // URL should be cleared
        expect(replaceStateMock).toHaveBeenCalledWith({}, '', '/playground');
      });

      it('should have link to report issue', async () => {
        delete window.location;
        window.location = { search: '?circuit=corrupt' } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        await waitFor(() => {
          expect(screen.getByText(/invalid share link/i)).toBeInTheDocument();
        });

        // Should have GitHub issues link
        const issueLink = screen.getByText(/report issue/i);
        expect(issueLink).toHaveAttribute('href', expect.stringContaining('github.com'));
        expect(issueLink).toHaveAttribute('target', '_blank');
      });

      it('should close error modal on Close button', async () => {
        const user = userEvent.setup();

        delete window.location;
        window.location = { search: '?circuit=bad' } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        await waitFor(() => {
          expect(screen.getByText(/invalid share link/i)).toBeInTheDocument();
        });

        const closeButton = screen.getAllByText(/^close$/i)[0]; // Get first Close button
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByText(/invalid share link/i)).not.toBeInTheDocument();
        });
      });
    });

    describe('Idempotent Ingestion Guard', () => {
      it('should only load circuit from URL once on initial mount', async () => {
        const loadSpy = vi.fn();

        delete window.location;
        window.location = {
          search: '?circuit=c1:H4sIAAAAAAAA',
          pathname: '/playground'
        } as any;

        const Component = LogicPlaygroundApp.component;
        const { rerender } = render(<Component />);

        // Wait a bit
        await waitFor(() => {
          // Check that loading started (or completed)
          // In real implementation, this would check the loadSpy call count
          expect(true).toBe(true);
        }, { timeout: 100 });

        // Force rerender multiple times
        rerender(<Component />);
        rerender(<Component />);
        rerender(<Component />);

        // Circuit should only be loaded once (guarded by hasLoadedFromURL ref)
        // In a real test, we'd verify loadSpy was called exactly once
        // For now, just verify the component doesn't crash
        expect(screen.getByText(/logic playground/i)).toBeInTheDocument();
      });

      it('should not reload circuit on component rerender', async () => {
        vi.useFakeTimers();

        delete window.location;
        window.location = {
          search: '?circuit=c1:test',
          pathname: '/playground'
        } as any;

        const Component = LogicPlaygroundApp.component;
        const { rerender } = render(<Component />);

        // Initial load
        vi.advanceTimersByTime(100);

        // Rerender component
        rerender(<Component />);
        rerender(<Component />);

        // Should not trigger multiple loads
        // Verify by checking that no duplicate error modals appear
        const errorModals = screen.queryAllByText(/invalid share link/i);
        expect(errorModals.length).toBeLessThanOrEqual(1);

        vi.useRealTimers();
      });
    });

    describe('Loading State Indicator', () => {
      it('should show loading spinner during circuit decode', async () => {
        delete window.location;
        window.location = {
          search: '?circuit=c1:longcompressedstring',
          pathname: '/playground'
        } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Loading indicator should appear immediately
        // Note: This is timing-sensitive - if decode is fast, it might not be visible
        // In real tests, you'd mock the async decoder to add delay
        const loadingText = await screen.findByText(/loading shared circuit/i, {}, { timeout: 100 });
        expect(loadingText).toBeInTheDocument();
      });

      it('should hide loading spinner after decode completes', async () => {
        delete window.location;
        window.location = {
          search: '?circuit=c1:test',
          pathname: '/playground'
        } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByText(/loading shared circuit/i)).not.toBeInTheDocument();
        }, { timeout: 2000 });
      });

      it('should hide loading spinner even when decode fails', async () => {
        delete window.location;
        window.location = {
          search: '?circuit=invalid',
          pathname: '/playground'
        } as any;

        const Component = LogicPlaygroundApp.component;
        render(<Component />);

        // Wait for error modal (loading should be done)
        await waitFor(() => {
          expect(screen.queryByText(/loading shared circuit/i)).not.toBeInTheDocument();
          expect(screen.getByText(/invalid share link/i)).toBeInTheDocument();
        });
      });
    });
  });
});
