/**
 * Project Persistence Service
 *
 * Single contract for saving/loading RBProjectDoc across all platforms.
 * - Autosave: localStorage, single key, throttled
 * - File: downloadable JSON or load from file
 * - All apps must call these, never JSON.stringify their own data
 */
import { normalizeProjectDoc, serializeProjectDoc, deserializeProjectDoc, createBlankProjectDoc, } from '@redbyte/rb-logic-core';
/**
 * Autosave storage key (single source for all apps)
 */
const AUTOSAVE_KEY = 'rb-project-autosave';
/**
 * Autosave throttle time (ms)
 */
const AUTOSAVE_THROTTLE_MS = 1000;
/**
 * Throttle state for autosave
 */
let autosaveScheduled = null;
let lastAutosaveTime = 0;
/**
 * Load project from autosave storage
 * Returns null if no autosave exists
 */
export async function loadProjectFromAutosave() {
    try {
        if (typeof localStorage === 'undefined') {
            return null;
        }
        const json = localStorage.getItem(AUTOSAVE_KEY);
        if (!json) {
            return null;
        }
        return deserializeProjectDoc(json);
    }
    catch (e) {
        console.error('[projectPersistence] Failed to load autosave:', e);
        return null;
    }
}
/**
 * Save project to autosave storage (throttled)
 * Subsequent calls within throttle window are batched
 */
export async function saveProjectToAutosave(doc) {
    if (typeof localStorage === 'undefined') {
        return;
    }
    const now = Date.now();
    const timeSinceLastSave = now - lastAutosaveTime;
    // If we're within throttle window, schedule for later
    if (timeSinceLastSave < AUTOSAVE_THROTTLE_MS) {
        if (autosaveScheduled) {
            clearTimeout(autosaveScheduled);
        }
        autosaveScheduled = setTimeout(() => {
            saveProjectToAutosave(doc);
            autosaveScheduled = null;
        }, AUTOSAVE_THROTTLE_MS - timeSinceLastSave);
        return;
    }
    // Execute save
    try {
        const normalized = normalizeProjectDoc(doc);
        const json = serializeProjectDoc(normalized);
        localStorage.setItem(AUTOSAVE_KEY, json);
        lastAutosaveTime = now;
        if (import.meta.env.DEV) {
            console.debug('[projectPersistence] Autosaved project', {
                projectId: normalized.meta.projectId,
                size: json.length,
            });
        }
    }
    catch (e) {
        console.error('[projectPersistence] Failed to save autosave:', e);
    }
}
/**
 * Clear autosave (e.g., on project delete or reset)
 */
export function clearAutosave() {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.removeItem(AUTOSAVE_KEY);
        if (autosaveScheduled) {
            clearTimeout(autosaveScheduled);
            autosaveScheduled = null;
        }
    }
    catch (e) {
        console.error('[projectPersistence] Failed to clear autosave:', e);
    }
}
/**
 * Wait for any throttled autosave to complete (test helper)
 * Waits longer than throttle window (1000ms) to guarantee save completes
 */
export async function flushAutosave() {
    return new Promise((resolve) => {
        setTimeout(resolve, 1100);
    });
}
/**
 * Load project from file (string content)
 * Used when user selects a .rbproject file
 */
export async function loadProjectFromFile(fileContent) {
    try {
        return deserializeProjectDoc(fileContent);
    }
    catch (e) {
        throw new Error(`Failed to load project file: ${e}`);
    }
}
/**
 * Save project as downloadable file
 * Triggers browser download dialog
 */
export async function saveProjectToFile(doc, filename) {
    try {
        const normalized = normalizeProjectDoc(doc);
        const json = serializeProjectDoc(normalized);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const name = filename || `${normalized.meta.name || 'project'}-${normalized.meta.projectId}.rbproject`;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (import.meta.env.DEV) {
            console.debug('[projectPersistence] Exported project file', { filename: name, size: json.length });
        }
    }
    catch (e) {
        console.error('[projectPersistence] Failed to save file:', e);
        throw new Error(`Failed to save project file: ${e}`);
    }
}
/**
 * Unified load interface (loads from autosave by default)
 * Can be extended to load from IndexedDB, cloud, etc.
 */
export async function loadProject(source = 'autosave') {
    if (source === 'autosave') {
        const autosaved = await loadProjectFromAutosave();
        return autosaved || createBlankProjectDoc();
    }
    // Caller must handle file selection UI and pass content
    throw new Error('File source requires caller to pass content via loadProjectFromFile');
}
/**
 * Unified save interface (defaults to autosave with optional file export)
 */
export async function saveProject(doc, target = 'autosave', filename) {
    if (target === 'autosave') {
        return saveProjectToAutosave(doc);
    }
    else if (target === 'file') {
        return saveProjectToFile(doc, filename);
    }
    throw new Error(`Unknown save target: ${target}`);
}
