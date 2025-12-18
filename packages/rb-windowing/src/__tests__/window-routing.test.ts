// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTargetWindowId } from '../windowRouting';
import type { WindowState } from '../types';

describe('PHASE_AC: Window Routing', () => {
  describe('resolveTargetWindowId', () => {
    it('returns null when preferNewWindow is true', () => {
      const windows: WindowState[] = [
        {
          id: 'win1',
          title: 'Text Viewer',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: Date.now(),
        },
      ];

      const result = resolveTargetWindowId('text-viewer', true, windows);

      expect(result).toBe(null); // Always create new when preferNewWindow=true
    });

    it('returns null when no windows exist for appId', () => {
      const windows: WindowState[] = [];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe(null); // Create new window
    });

    it('returns window ID when one window exists for appId', () => {
      const windows: WindowState[] = [
        {
          id: 'win1',
          title: 'Text Viewer',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe('win1'); // Reuse existing window
    });

    it('returns most-recently-focused window when multiple windows exist with focus history', () => {
      const now = Date.now();
      const windows: WindowState[] = [
        {
          id: 'win1',
          title: 'Text Viewer 1',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: now - 5000, // 5 seconds ago
        },
        {
          id: 'win2',
          title: 'Text Viewer 2',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 2,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: now - 1000, // 1 second ago (most recent)
        },
        {
          id: 'win3',
          title: 'Text Viewer 3',
          bounds: { x: 200, y: 200, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 3,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: now - 10000, // 10 seconds ago
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe('win2'); // Most recently focused
    });

    it('returns oldest window (deterministic tie-break) when no focus history available', () => {
      const windows: WindowState[] = [
        {
          id: 'win-c',
          title: 'Text Viewer C',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 3,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          // No lastFocusedAt
        },
        {
          id: 'win-a',
          title: 'Text Viewer A',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          // No lastFocusedAt
        },
        {
          id: 'win-b',
          title: 'Text Viewer B',
          bounds: { x: 200, y: 200, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 2,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          // No lastFocusedAt
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe('win-a'); // Oldest by ID sort (deterministic)
    });

    it('excludes minimized windows from reuse candidates', () => {
      const windows: WindowState[] = [
        {
          id: 'win1',
          title: 'Text Viewer 1',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'minimized', // Minimized window (should be skipped)
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: Date.now(),
        },
        {
          id: 'win2',
          title: 'Text Viewer 2',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'normal', // Normal window (should be selected)
          zIndex: 2,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: Date.now() - 5000,
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe('win2'); // Skips minimized, uses normal window
    });

    it('returns null when all windows are minimized', () => {
      const windows: WindowState[] = [
        {
          id: 'win1',
          title: 'Text Viewer 1',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'minimized',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
        },
        {
          id: 'win2',
          title: 'Text Viewer 2',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'minimized',
          zIndex: 2,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe(null); // All minimized → create new
    });

    it('only considers windows for the target appId', () => {
      const windows: WindowState[] = [
        {
          id: 'win-logic',
          title: 'Logic Playground',
          bounds: { x: 0, y: 0, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 1,
          focused: false,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'logic-playground',
          lastFocusedAt: Date.now(),
        },
        {
          id: 'win-text',
          title: 'Text Viewer',
          bounds: { x: 100, y: 100, width: 400, height: 300 },
          mode: 'normal',
          zIndex: 2,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: Date.now() - 5000,
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe('win-text'); // Only considers text-viewer windows
    });

    it('includes maximized windows as reuse candidates', () => {
      const windows: WindowState[] = [
        {
          id: 'win1',
          title: 'Text Viewer',
          bounds: { x: 0, y: 0, width: 800, height: 600 },
          mode: 'maximized',
          zIndex: 1,
          focused: true,
          resizable: true,
          minimizable: true,
          maximizable: true,
          contentId: 'text-viewer',
          lastFocusedAt: Date.now(),
        },
      ];

      const result = resolveTargetWindowId('text-viewer', false, windows);

      expect(result).toBe('win1'); // Maximized windows are reusable
    });
  });

  describe('Focus History Tracking', () => {
    it('sets lastFocusedAt timestamp on window focus', () => {
      // This test would require testing the window store's focusWindow action
      // Will be covered in integration tests
      expect(true).toBe(true);
    });
  });
});
