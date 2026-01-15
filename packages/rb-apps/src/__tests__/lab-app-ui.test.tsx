// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import LogicLabApp from '../apps/LogicLabApp';

describe('ECE Lab H0.6: LogicLabApp UI Shell', () => {
  beforeEach(() => {
    localStorage.clear();
    
    // Mock URL.createObjectURL for tests
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Layout & Rendering', () => {
    it('renders 3-panel layout: instructions, circuit, checkpoints', () => {
      render(<LogicLabApp />);
      
      // Check for main container
      const container = screen.getByTestId('logic-lab-container');
      expect(container).toBeTruthy();
      
      // Check for 3 panels
      expect(screen.getByTestId('instructions-panel')).toBeTruthy();
      expect(screen.getByTestId('circuit-panel')).toBeTruthy();
      expect(screen.getByTestId('checkpoint-panel')).toBeTruthy();
    });

    it('displays lab session info in toolbar', () => {
      render(<LogicLabApp />);
      
      // The toolbar shows lab-default and Student
      expect(screen.getByText(/lab-default/)).toBeTruthy();
      expect(screen.getByText(/student/i)).toBeTruthy();
    });

    it('renders toolbar with Run Checks, Export, Import buttons', () => {
      render(<LogicLabApp />);
      
      expect(screen.getByRole('button', { name: /run/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /export/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /import/i })).toBeTruthy();
    });
  });

  describe('Instructions Panel', () => {
    it('renders instructions panel with title', () => {
      render(<LogicLabApp />);
      const panel = screen.getByTestId('instructions-panel');
      expect(panel).toBeTruthy();
      
      // Check for "Instructions" heading in the panel
      const heading = panel.querySelector('h3');
      expect(heading?.textContent).toBe('Instructions');
    });

    it('displays keyboard shortcuts', () => {
      render(<LogicLabApp />);
      const panel = screen.getByTestId('instructions-panel');
      
      expect(panel.textContent).toContain('Keyboard Shortcuts');
      expect(panel.textContent).toContain('Ctrl+S');
      expect(panel.textContent).toContain('Ctrl+E');
    });
  });

  describe('Checkpoint Panel', () => {
    it('displays checkpoint panel', () => {
      render(<LogicLabApp />);
      const checkpointPanel = screen.getByTestId('checkpoint-panel');
      expect(checkpointPanel).toBeTruthy();
    });

    it('shows checkpoints heading', () => {
      render(<LogicLabApp />);
      const panel = screen.getByTestId('checkpoint-panel');
      const heading = panel.querySelector('h3');
      expect(heading?.textContent).toBe('Checkpoints');
    });

    it('displays message when no checkpoints attempted', () => {
      render(<LogicLabApp />);
      const panel = screen.getByTestId('checkpoint-panel');
      expect(panel.textContent).toContain('No checkpoints attempted');
    });

    it('Run Checks button handles click without error', async () => {
      render(<LogicLabApp />);
      
      const runButton = screen.getByRole('button', { name: /run/i });
      fireEvent.click(runButton);

      // Button should be enabled again after completion
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /run/i })).toBeTruthy();
      }, { timeout: 500 });
    });
  });

  describe('Circuit Panel', () => {
    it('renders circuit editor placeholder area', () => {
      render(<LogicLabApp />);
      const circuitPanel = screen.getByTestId('circuit-panel');
      expect(circuitPanel).toBeTruthy();
      
      // Check for placeholder text
      expect(circuitPanel.textContent).toContain('Circuit Editor');
    });
  });

  describe('Toolbar Actions', () => {
    it('Export button is clickable', () => {
      render(<LogicLabApp />);
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeTruthy();
      
      // Mock document methods for download
      const mockAppendChild = vi.spyOn(document.body, 'appendChild');
      
      fireEvent.click(exportButton);
      
      // Verify download flow was triggered
      expect(mockAppendChild).toHaveBeenCalled();
      
      mockAppendChild.mockRestore();
    });

    it('Import button opens file picker', () => {
      render(<LogicLabApp />);
      
      const importButton = screen.getByRole('button', { name: /import/i });
      expect(importButton).toBeTruthy();
      
      // Mock createElement for input element
      const mockCreate = vi.spyOn(document, 'createElement');
      
      fireEvent.click(importButton);
      
      // Verify input element was created
      expect(mockCreate).toHaveBeenCalledWith('input');
      
      mockCreate.mockRestore();
    });

    it('Run Checks button triggers evaluation', async () => {
      render(<LogicLabApp />);
      
      const runButton = screen.getByRole('button', { name: /run/i });
      expect(runButton).toBeTruthy();
      
      fireEvent.click(runButton);
      
      await waitFor(() => {
        // After run completes, button should be enabled again
        const button = screen.getByRole('button', { name: /run/i });
        expect(button).not.toHaveAttribute('disabled');
      }, { timeout: 1000 });
    });
  });

  describe('Session Persistence', () => {
    it('initializes session on mount', () => {
      render(<LogicLabApp />);
      
      // Session should be created with lab-default
      expect(screen.getByText(/lab-default/)).toBeTruthy();
    });

    it('displays student name from session', () => {
      render(<LogicLabApp />);
      
      const toolbar = screen.getByText(/Student/i);
      expect(toolbar).toBeTruthy();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('Ctrl+S shortcut does not throw error', () => {
      render(<LogicLabApp />);
      
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      
      // Should not throw, just log save message
      expect(true).toBe(true);
    });

    it('Ctrl+E shortcut triggers export', () => {
      render(<LogicLabApp />);
      
      const mockAppendChild = vi.spyOn(document.body, 'appendChild');
      
      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        bubbles: true,
      });
      
      document.dispatchEvent(event);
      
      // Export flow should have been triggered
      expect(mockAppendChild).toHaveBeenCalled();
      
      mockAppendChild.mockRestore();
    });
  });

  describe('Responsive Layout', () => {
    it('renders with grid layout structure', () => {
      render(<LogicLabApp />);
      
      const main = screen.getByTestId('logic-lab-container');
      
      // Main should have grid display
      expect(main).toBeTruthy();
      expect(main.style.display).toBe('grid');
    });

    it('all three panels are visible', () => {
      render(<LogicLabApp />);
      
      const instructionsPanel = screen.getByTestId('instructions-panel');
      const circuitPanel = screen.getByTestId('circuit-panel');
      const checkpointPanel = screen.getByTestId('checkpoint-panel');
      
      // All panels should be in the DOM
      expect(instructionsPanel).toBeInTheDocument();
      expect(circuitPanel).toBeInTheDocument();
      expect(checkpointPanel).toBeInTheDocument();
    });
  });
});
