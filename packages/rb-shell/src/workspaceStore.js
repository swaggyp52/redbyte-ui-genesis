// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
const STORAGE_KEY = 'rb:workspaces';
const ACTIVE_WORKSPACE_KEY = 'rb:active-workspace';
function saveWorkspaces(workspaces, activeWorkspaceId) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const data = { workspaces, activeWorkspaceId };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    catch (error) {
        // Silently ignore localStorage errors
    }
}
export function loadWorkspaces() {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        if (!Array.isArray(parsed.workspaces))
            return null;
        return parsed;
    }
    catch (error) {
        // Silently ignore corrupted data
        return null;
    }
}
function loadInitialState() {
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
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createWorkspaceStore() {
    return create((set, get) => ({
        ...loadInitialState(),
        createWorkspace: (name, snapshot) => {
            const id = crypto.randomUUID();
            const workspace = {
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
            if (!workspace)
                return null;
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
                const newWorkspaces = state.workspaces.map((w) => w.id === id ? { ...w, name } : w);
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
}
export const useWorkspaceStore = ((...args) => {
    if (!_store)
        _store = createWorkspaceStore();
    return _store(...args);
});
useWorkspaceStore.getState = () => {
    if (!_store)
        _store = createWorkspaceStore();
    return _store.getState();
};
useWorkspaceStore.setState = (...a) => {
    if (!_store)
        _store = createWorkspaceStore();
    return _store.setState(...a);
};
useWorkspaceStore.subscribe = (...a) => {
    if (!_store)
        _store = createWorkspaceStore();
    return _store.subscribe(...a);
};
