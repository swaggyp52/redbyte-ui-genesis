// Hook to integrate auto-save into the Lab 3 store
import { useEffect } from 'react';
import { useLabStore } from './store';
import { saveWorkspace, initializeDB, loadWorkspace } from './persistence';
export function useAutoSave(enabled = true) {
    const state = useLabStore();
    // Initialize DB on mount
    useEffect(() => {
        initializeDB().catch(console.warn);
    }, []);
    // Auto-save on any state change (debounced)
    useEffect(() => {
        if (!enabled)
            return;
        const timer = setTimeout(() => {
            const json = useLabStore.getState().exportJSON();
            saveWorkspace(json).catch(console.warn);
        }, 1000); // Debounce: save 1 second after last change
        return () => clearTimeout(timer);
    }, [state, enabled]);
}
export async function restoreAutoSave() {
    try {
        const saved = await loadWorkspace();
        if (saved) {
            useLabStore.getState().importJSON(saved);
            return true;
        }
    }
    catch (error) {
        console.warn('Failed to restore auto-save:', error);
    }
    return false;
}
