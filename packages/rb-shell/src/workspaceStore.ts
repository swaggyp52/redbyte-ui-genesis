// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { WindowState } from '@redbyte/rb-windowing';

export interface WorkspaceSnapshot {
  windows: WindowState[];
  nextZIndex: number;
}

export interface Workspace {
  id: string;
  name: string;
  snapshot: WorkspaceSnapshot;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}

interface WorkspaceActions {
  createWorkspace: (name: string, snapshot: WorkspaceSnapshot) => string;
  switchWorkspace: (id: string) => WorkspaceSnapshot | null;
  deleteWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  getWorkspace: (id: string) => Workspace | null;
  listWorkspaces: () => Workspace[];
}

type WorkspaceStore = WorkspaceState & WorkspaceActions;

const STORAGE_KEY = 'rb:workspaces';
const ACTIVE_WORKSPACE_KEY = 'rb:active-workspace';

interface PersistedWorkspaceData {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}

function saveWorkspaces(workspaces: Workspace[], activeWorkspaceId: string | null): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const data: PersistedWorkspaceData = { workspaces, activeWorkspaceId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Silently ignore localStorage errors
  }
}

export function loadWorkspaces(): PersistedWorkspaceData | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.workspaces)) return null;

    return parsed as PersistedWorkspaceData;
  } catch (error) {
    // Silently ignore corrupted data
    return null;
  }
}

function loadInitialState(): WorkspaceState {
  const data = loadWorkspaces();
  if (!data) {
    return {
      workspaces: [],
      activeWorkspaceId: null,
    };
  }

  return {
    workspaces: data.workspaces,
    activeWorkspaceId: data.activeWorkspaceId,
  };
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  ...loadInitialState(),

  createWorkspace: (name, snapshot) => {
    const id = crypto.randomUUID();
    const workspace: Workspace = {
      id,
      name,
      snapshot,
    };

    set((state) => {
      const newWorkspaces = [...state.workspaces, workspace];
      saveWorkspaces(newWorkspaces, state.activeWorkspaceId);
      return {
        workspaces: newWorkspaces,
      };
    });

    return id;
  },

  switchWorkspace: (id) => {
    const workspace = get().workspaces.find((w) => w.id === id);
    if (!workspace) return null;

    set((state) => {
      saveWorkspaces(state.workspaces, id);
      return {
        activeWorkspaceId: id,
      };
    });

    return workspace.snapshot;
  },

  deleteWorkspace: (id) => {
    set((state) => {
      const newWorkspaces = state.workspaces.filter((w) => w.id !== id);
      const newActiveId = state.activeWorkspaceId === id ? null : state.activeWorkspaceId;

      saveWorkspaces(newWorkspaces, newActiveId);

      return {
        workspaces: newWorkspaces,
        activeWorkspaceId: newActiveId,
      };
    });
  },

  renameWorkspace: (id, name) => {
    set((state) => {
      const newWorkspaces = state.workspaces.map((w) =>
        w.id === id ? { ...w, name } : w
      );

      saveWorkspaces(newWorkspaces, state.activeWorkspaceId);

      return {
        workspaces: newWorkspaces,
      };
    });
  },

  getWorkspace: (id) => {
    return get().workspaces.find((w) => w.id === id) || null;
  },

  listWorkspaces: () => {
    return get().workspaces;
  },
}));
