// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMacroStore, loadMacros } from '../macros/macroStore';
import { executeMacro, type MacroExecutionContext } from '../macros/executeMacro';
import type { Macro, MacroStep } from '../macros/macroTypes';

describe('Macro Store', () => {
  beforeEach(() => {
    useMacroStore.setState({ macros: [] });
    localStorage.clear();
  });

  describe('createMacro', () => {
    it('creates macro with name and steps', () => {
      const steps: MacroStep[] = [
        { type: 'command', commandId: 'focus-next-window' },
        { type: 'openApp', appId: 'files' },
      ];

      const { createMacro, listMacros } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const macros = listMacros();
      expect(macros).toHaveLength(1);
      expect(macros[0].id).toBe(id);
      expect(macros[0].name).toBe('Test Macro');
      expect(macros[0].steps).toEqual(steps);
    });

    it('persists macro to localStorage', () => {
      const steps: MacroStep[] = [{ type: 'command', commandId: 'snap-left' }];

      const { createMacro } = useMacroStore.getState();
      createMacro('Snap Left Macro', steps);

      const raw = localStorage.getItem('rb:macros');
      expect(raw).toBeTruthy();

      const data = JSON.parse(raw!);
      expect(data.macros).toHaveLength(1);
      expect(data.macros[0].name).toBe('Snap Left Macro');
    });

    it('generates unique IDs for macros', () => {
      const steps: MacroStep[] = [];

      const { createMacro, listMacros } = useMacroStore.getState();
      const id1 = createMacro('Macro 1', steps);
      const id2 = createMacro('Macro 2', steps);

      expect(id1).not.toBe(id2);

      const macros = listMacros();
      expect(macros).toHaveLength(2);
    });
  });

  describe('deleteMacro', () => {
    it('removes macro from store', () => {
      const steps: MacroStep[] = [];

      const { createMacro, deleteMacro, listMacros } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      deleteMacro(id);

      const macros = listMacros();
      expect(macros).toHaveLength(0);
    });

    it('persists deletion to localStorage', () => {
      const steps: MacroStep[] = [];

      const { createMacro, deleteMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      deleteMacro(id);

      const raw = localStorage.getItem('rb:macros');
      const data = JSON.parse(raw!);
      expect(data.macros).toHaveLength(0);
    });

    it('no-ops when deleting nonexistent macro', () => {
      const steps: MacroStep[] = [];

      const { createMacro, deleteMacro, listMacros } = useMacroStore.getState();
      createMacro('Test Macro', steps);

      const beforeCount = listMacros().length;
      deleteMacro('nonexistent-id');
      const afterCount = listMacros().length;

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('renameMacro', () => {
    it('updates macro name', () => {
      const steps: MacroStep[] = [];

      const { createMacro, renameMacro, getMacro } = useMacroStore.getState();
      const id = createMacro('Old Name', steps);

      renameMacro(id, 'New Name');

      const macro = getMacro(id);
      expect(macro?.name).toBe('New Name');
    });

    it('preserves macro steps when renaming', () => {
      const steps: MacroStep[] = [
        { type: 'command', commandId: 'snap-right' },
        { type: 'openApp', appId: 'settings' },
      ];

      const { createMacro, renameMacro, getMacro } = useMacroStore.getState();
      const id = createMacro('Old Name', steps);

      renameMacro(id, 'New Name');

      const macro = getMacro(id);
      expect(macro?.steps).toEqual(steps);
    });

    it('persists rename to localStorage', () => {
      const steps: MacroStep[] = [];

      const { createMacro, renameMacro } = useMacroStore.getState();
      const id = createMacro('Old Name', steps);

      renameMacro(id, 'New Name');

      const raw = localStorage.getItem('rb:macros');
      const data = JSON.parse(raw!);
      expect(data.macros[0].name).toBe('New Name');
    });
  });

  describe('updateMacroSteps', () => {
    it('updates macro steps', () => {
      const initialSteps: MacroStep[] = [{ type: 'command', commandId: 'snap-left' }];
      const newSteps: MacroStep[] = [
        { type: 'command', commandId: 'snap-right' },
        { type: 'openApp', appId: 'files' },
      ];

      const { createMacro, updateMacroSteps, getMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', initialSteps);

      updateMacroSteps(id, newSteps);

      const macro = getMacro(id);
      expect(macro?.steps).toEqual(newSteps);
    });

    it('preserves macro name when updating steps', () => {
      const { createMacro, updateMacroSteps, getMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', []);

      updateMacroSteps(id, [{ type: 'command', commandId: 'center-window' }]);

      const macro = getMacro(id);
      expect(macro?.name).toBe('Test Macro');
    });
  });

  describe('getMacro', () => {
    it('returns macro by ID', () => {
      const steps: MacroStep[] = [{ type: 'command', commandId: 'focus-next-window' }];

      const { createMacro, getMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const macro = getMacro(id);

      expect(macro).toBeTruthy();
      expect(macro?.id).toBe(id);
      expect(macro?.name).toBe('Test Macro');
      expect(macro?.steps).toEqual(steps);
    });

    it('returns null for nonexistent macro', () => {
      const { getMacro } = useMacroStore.getState();
      const macro = getMacro('nonexistent-id');

      expect(macro).toBeNull();
    });
  });

  describe('listMacros', () => {
    it('returns empty array when no macros', () => {
      const { listMacros } = useMacroStore.getState();
      const macros = listMacros();

      expect(macros).toEqual([]);
    });

    it('returns all macros', () => {
      const { createMacro, listMacros } = useMacroStore.getState();
      createMacro('Macro 1', []);
      createMacro('Macro 2', []);
      createMacro('Macro 3', []);

      const macros = listMacros();

      expect(macros).toHaveLength(3);
      expect(macros.map((m) => m.name)).toEqual(['Macro 1', 'Macro 2', 'Macro 3']);
    });
  });

  describe('loadMacros', () => {
    it('returns null when localStorage is empty', () => {
      const data = loadMacros();
      expect(data).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('rb:macros', 'invalid json{');
      const data = loadMacros();
      expect(data).toBeNull();
    });

    it('returns null for invalid schema (missing macros)', () => {
      localStorage.setItem('rb:macros', JSON.stringify({ foo: 'bar' }));
      const data = loadMacros();
      expect(data).toBeNull();
    });

    it('returns null for invalid schema (macros not an array)', () => {
      localStorage.setItem('rb:macros', JSON.stringify({ macros: {} }));
      const data = loadMacros();
      expect(data).toBeNull();
    });

    it('loads valid macro data', () => {
      const validData = {
        macros: [
          {
            id: 'macro-1',
            name: 'Test Macro',
            steps: [{ type: 'command', commandId: 'snap-left' }],
          },
        ],
      };

      localStorage.setItem('rb:macros', JSON.stringify(validData));
      const data = loadMacros();

      expect(data).not.toBeNull();
      expect(data!.macros).toHaveLength(1);
      expect(data!.macros[0].name).toBe('Test Macro');
    });
  });

  describe('Macro persistence integration', () => {
    it('restores macros from localStorage on initialization', () => {
      const steps: MacroStep[] = [{ type: 'command', commandId: 'center-window' }];

      const { createMacro } = useMacroStore.getState();
      createMacro('Persisted Macro', steps);

      // Simulate reload by resetting state and re-importing
      const data = loadMacros();
      useMacroStore.setState({
        macros: data?.macros || [],
      });

      const { listMacros } = useMacroStore.getState();
      const macros = listMacros();

      expect(macros).toHaveLength(1);
      expect(macros[0].name).toBe('Persisted Macro');
      expect(macros[0].steps).toEqual(steps);
    });
  });
});

describe('Macro Execution', () => {
  let mockContext: MacroExecutionContext;

  beforeEach(() => {
    useMacroStore.setState({ macros: [] });
    localStorage.clear();

    mockContext = {
      executeCommand: vi.fn(),
      openWindow: vi.fn(),
      dispatchIntent: vi.fn(),
      switchWorkspace: vi.fn(() => true),
      getApp: vi.fn((appId) => (appId === 'files' || appId === 'settings' ? {} : null)),
    };
  });

  describe('executeMacro', () => {
    it('executes macro with command step', () => {
      const steps: MacroStep[] = [{ type: 'command', commandId: 'focus-next-window' }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.executeCommand).toHaveBeenCalledWith('focus-next-window');
    });

    it('executes macro with openApp step', () => {
      const steps: MacroStep[] = [{ type: 'openApp', appId: 'files' }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.openWindow).toHaveBeenCalledWith('files', undefined);
    });

    it('executes macro with openApp step with props', () => {
      const props = { resourceId: 'test.txt', resourceType: 'text' };
      const steps: MacroStep[] = [{ type: 'openApp', appId: 'files', props }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.openWindow).toHaveBeenCalledWith('files', props);
    });

    it('executes macro with intent step', () => {
      const intent = {
        type: 'open-with' as const,
        payload: { targetAppId: 'logic-playground', resourceId: 'file.js', resourceType: 'javascript' },
      };
      const steps: MacroStep[] = [{ type: 'intent', intent }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.dispatchIntent).toHaveBeenCalledWith(intent);
    });

    it('executes macro with switchWorkspace step', () => {
      const steps: MacroStep[] = [{ type: 'switchWorkspace', workspaceId: 'workspace-123' }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.switchWorkspace).toHaveBeenCalledWith('workspace-123');
    });

    it('executes macro with multiple steps in sequence', () => {
      const steps: MacroStep[] = [
        { type: 'switchWorkspace', workspaceId: 'workspace-123' },
        { type: 'openApp', appId: 'files' },
        { type: 'command', commandId: 'snap-left' },
      ];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.switchWorkspace).toHaveBeenCalledWith('workspace-123');
      expect(mockContext.openWindow).toHaveBeenCalledWith('files', undefined);
      expect(mockContext.executeCommand).toHaveBeenCalledWith('snap-left');
    });

    it('aborts on unknown app', () => {
      const steps: MacroStep[] = [{ type: 'openApp', appId: 'unknown-app' }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown app');
      expect(result.stepIndex).toBe(0);
    });

    it('aborts on unknown workspace', () => {
      mockContext.switchWorkspace = vi.fn(() => false);

      const steps: MacroStep[] = [{ type: 'switchWorkspace', workspaceId: 'nonexistent' }];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown workspace');
      expect(result.stepIndex).toBe(0);
    });

    it('aborts on first error without executing subsequent steps', () => {
      const steps: MacroStep[] = [
        { type: 'openApp', appId: 'unknown-app' },
        { type: 'command', commandId: 'focus-next-window' },
      ];

      const { createMacro } = useMacroStore.getState();
      const id = createMacro('Test Macro', steps);

      const result = executeMacro(id, mockContext);

      expect(result.success).toBe(false);
      expect(result.stepIndex).toBe(0);
      expect(mockContext.executeCommand).not.toHaveBeenCalled();
    });

    it('returns error for nonexistent macro', () => {
      const result = executeMacro('nonexistent-id', mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Macro not found');
      expect(result.stepIndex).toBe(-1);
    });
  });
});
