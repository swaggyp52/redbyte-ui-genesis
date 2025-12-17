// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, loadWorkspaces } from '../workspaceStore';
import type { WindowState } from '@redbyte/rb-windowing';

describe('Workspace Store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ workspaces: [], activeWorkspaceId: null });
    localStorage.clear();
  });

  describe('createWorkspace', () => {
    it('creates workspace with name and snapshot', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      const id = createWorkspace('My Workspace', snapshot);

      const workspaces = listWorkspaces();
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].id).toBe(id);
      expect(workspaces[0].name).toBe('My Workspace');
      expect(workspaces[0].snapshot).toEqual(snapshot);
    });

    it('persists workspace to localStorage', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace } = useWorkspaceStore.getState();
      createWorkspace('Test Workspace', snapshot);

      const raw = localStorage.getItem('rb:workspaces');
      expect(raw).toBeTruthy();

      const data = JSON.parse(raw!);
      expect(data.workspaces).toHaveLength(1);
      expect(data.workspaces[0].name).toBe('Test Workspace');
    });

    it('generates unique IDs for workspaces', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      const id1 = createWorkspace('Workspace 1', snapshot);
      const id2 = createWorkspace('Workspace 2', snapshot);

      expect(id1).not.toBe(id2);

      const workspaces = listWorkspaces();
      expect(workspaces).toHaveLength(2);
    });

    it('preserves existing workspaces when creating new ones', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      createWorkspace('Workspace 1', snapshot);
      createWorkspace('Workspace 2', snapshot);

      const workspaces = listWorkspaces();
      expect(workspaces).toHaveLength(2);
      expect(workspaces[0].name).toBe('Workspace 1');
      expect(workspaces[1].name).toBe('Workspace 2');
    });
  });

  describe('switchWorkspace', () => {
    it('returns workspace snapshot and sets active workspace ID', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 5,
      };

      const { createWorkspace, switchWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Test Workspace', snapshot);

      const returnedSnapshot = switchWorkspace(id);

      expect(returnedSnapshot).toEqual(snapshot);
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(id);
    });

    it('persists active workspace ID to localStorage', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, switchWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Test Workspace', snapshot);

      switchWorkspace(id);

      const raw = localStorage.getItem('rb:workspaces');
      const data = JSON.parse(raw!);
      expect(data.activeWorkspaceId).toBe(id);
    });

    it('returns null for nonexistent workspace', () => {
      const { switchWorkspace } = useWorkspaceStore.getState();
      const result = switchWorkspace('nonexistent-id');

      expect(result).toBeNull();
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull();
    });

    it('updates active workspace when switching between workspaces', () => {
      const snapshot1 = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const snapshot2 = {
        windows: [] as WindowState[],
        nextZIndex: 10,
      };

      const { createWorkspace, switchWorkspace } = useWorkspaceStore.getState();
      const id1 = createWorkspace('Workspace 1', snapshot1);
      const id2 = createWorkspace('Workspace 2', snapshot2);

      switchWorkspace(id1);
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(id1);

      switchWorkspace(id2);
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(id2);
    });
  });

  describe('deleteWorkspace', () => {
    it('removes workspace from store', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, deleteWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      const id = createWorkspace('Test Workspace', snapshot);

      deleteWorkspace(id);

      const workspaces = listWorkspaces();
      expect(workspaces).toHaveLength(0);
    });

    it('clears active workspace ID when deleting active workspace', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, switchWorkspace, deleteWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Test Workspace', snapshot);

      switchWorkspace(id);
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(id);

      deleteWorkspace(id);
      expect(useWorkspaceStore.getState().activeWorkspaceId).toBeNull();
    });

    it('preserves active workspace ID when deleting non-active workspace', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, switchWorkspace, deleteWorkspace } = useWorkspaceStore.getState();
      const id1 = createWorkspace('Workspace 1', snapshot);
      const id2 = createWorkspace('Workspace 2', snapshot);

      switchWorkspace(id1);
      deleteWorkspace(id2);

      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(id1);
    });

    it('persists deletion to localStorage', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, deleteWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Test Workspace', snapshot);

      deleteWorkspace(id);

      const raw = localStorage.getItem('rb:workspaces');
      const data = JSON.parse(raw!);
      expect(data.workspaces).toHaveLength(0);
    });

    it('no-ops when deleting nonexistent workspace', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, deleteWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      createWorkspace('Test Workspace', snapshot);

      const beforeCount = listWorkspaces().length;
      deleteWorkspace('nonexistent-id');
      const afterCount = listWorkspaces().length;

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('renameWorkspace', () => {
    it('updates workspace name', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, renameWorkspace, getWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Old Name', snapshot);

      renameWorkspace(id, 'New Name');

      const workspace = getWorkspace(id);
      expect(workspace?.name).toBe('New Name');
    });

    it('preserves workspace snapshot when renaming', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 5,
      };

      const { createWorkspace, renameWorkspace, getWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Old Name', snapshot);

      renameWorkspace(id, 'New Name');

      const workspace = getWorkspace(id);
      expect(workspace?.snapshot).toEqual(snapshot);
    });

    it('persists rename to localStorage', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, renameWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Old Name', snapshot);

      renameWorkspace(id, 'New Name');

      const raw = localStorage.getItem('rb:workspaces');
      const data = JSON.parse(raw!);
      expect(data.workspaces[0].name).toBe('New Name');
    });

    it('no-ops when renaming nonexistent workspace', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, renameWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      createWorkspace('Test Workspace', snapshot);

      const before = listWorkspaces();
      renameWorkspace('nonexistent-id', 'New Name');
      const after = listWorkspaces();

      expect(after).toEqual(before);
    });
  });

  describe('getWorkspace', () => {
    it('returns workspace by ID', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, getWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Test Workspace', snapshot);

      const workspace = getWorkspace(id);

      expect(workspace).toBeTruthy();
      expect(workspace?.id).toBe(id);
      expect(workspace?.name).toBe('Test Workspace');
      expect(workspace?.snapshot).toEqual(snapshot);
    });

    it('returns null for nonexistent workspace', () => {
      const { getWorkspace } = useWorkspaceStore.getState();
      const workspace = getWorkspace('nonexistent-id');

      expect(workspace).toBeNull();
    });
  });

  describe('listWorkspaces', () => {
    it('returns empty array when no workspaces', () => {
      const { listWorkspaces } = useWorkspaceStore.getState();
      const workspaces = listWorkspaces();

      expect(workspaces).toEqual([]);
    });

    it('returns all workspaces', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, listWorkspaces } = useWorkspaceStore.getState();
      createWorkspace('Workspace 1', snapshot);
      createWorkspace('Workspace 2', snapshot);
      createWorkspace('Workspace 3', snapshot);

      const workspaces = listWorkspaces();

      expect(workspaces).toHaveLength(3);
      expect(workspaces.map((w) => w.name)).toEqual(['Workspace 1', 'Workspace 2', 'Workspace 3']);
    });
  });

  describe('loadWorkspaces', () => {
    it('returns null when localStorage is empty', () => {
      const data = loadWorkspaces();
      expect(data).toBeNull();
    });

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('rb:workspaces', 'invalid json{');
      const data = loadWorkspaces();
      expect(data).toBeNull();
    });

    it('returns null for invalid schema (missing workspaces)', () => {
      localStorage.setItem('rb:workspaces', JSON.stringify({ activeWorkspaceId: 'test-id' }));
      const data = loadWorkspaces();
      expect(data).toBeNull();
    });

    it('returns null for invalid schema (workspaces not an array)', () => {
      localStorage.setItem('rb:workspaces', JSON.stringify({ workspaces: {}, activeWorkspaceId: null }));
      const data = loadWorkspaces();
      expect(data).toBeNull();
    });

    it('loads valid workspace data', () => {
      const validData = {
        workspaces: [
          {
            id: 'ws-1',
            name: 'Test Workspace',
            snapshot: {
              windows: [],
              nextZIndex: 1,
            },
          },
        ],
        activeWorkspaceId: 'ws-1',
      };

      localStorage.setItem('rb:workspaces', JSON.stringify(validData));
      const data = loadWorkspaces();

      expect(data).not.toBeNull();
      expect(data!.workspaces).toHaveLength(1);
      expect(data!.workspaces[0].name).toBe('Test Workspace');
      expect(data!.activeWorkspaceId).toBe('ws-1');
    });
  });

  describe('Workspace persistence integration', () => {
    it('restores workspaces from localStorage on initialization', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 3,
      };

      const { createWorkspace } = useWorkspaceStore.getState();
      createWorkspace('Persisted Workspace', snapshot);

      // Simulate reload by resetting state and re-importing
      const data = loadWorkspaces();
      useWorkspaceStore.setState({
        workspaces: data?.workspaces || [],
        activeWorkspaceId: data?.activeWorkspaceId || null,
      });

      const { listWorkspaces } = useWorkspaceStore.getState();
      const workspaces = listWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].name).toBe('Persisted Workspace');
      expect(workspaces[0].snapshot.nextZIndex).toBe(3);
    });

    it('active workspace ID persists across reload', () => {
      const snapshot = {
        windows: [] as WindowState[],
        nextZIndex: 1,
      };

      const { createWorkspace, switchWorkspace } = useWorkspaceStore.getState();
      const id = createWorkspace('Active Workspace', snapshot);
      switchWorkspace(id);

      // Simulate reload
      const data = loadWorkspaces();
      useWorkspaceStore.setState({
        workspaces: data?.workspaces || [],
        activeWorkspaceId: data?.activeWorkspaceId || null,
      });

      expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(id);
    });
  });
});
