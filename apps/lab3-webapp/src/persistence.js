// IndexedDB persistence layer for Lab 3 app state
// Provides automatic save/restore with localStorage fallback
const DB_NAME = 'Lab3Webapp';
const DB_VERSION = 1;
const STORE_NAME = 'workspace';
let db = null;
export async function initializeDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
            console.warn('IndexedDB initialization failed, falling back to localStorage');
            resolve(); // Don't block on DB failure
        };
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onupgradeneeded = (event) => {
            const targetDB = event.target.result;
            if (!targetDB.objectStoreNames.contains(STORE_NAME)) {
                targetDB.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}
export async function saveWorkspace(jsonData) {
    if (!db) {
        // Fall back to localStorage
        try {
            localStorage.setItem('lab3_workspace', jsonData);
            localStorage.setItem('lab3_workspace_timestamp', new Date().getTime().toString());
        }
        catch {
            console.warn('Failed to save to localStorage');
        }
        return;
    }
    try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const workspace = {
            id: 'current',
            timestamp: new Date().getTime(),
            data: jsonData,
        };
        store.put(workspace);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
    catch (error) {
        console.warn('IndexedDB save failed, trying localStorage:', error);
        try {
            localStorage.setItem('lab3_workspace', jsonData);
            localStorage.setItem('lab3_workspace_timestamp', new Date().getTime().toString());
        }
        catch {
            console.error('Both IndexedDB and localStorage save failed');
        }
    }
}
export async function loadWorkspace() {
    if (!db) {
        // Fall back to localStorage
        return localStorage.getItem('lab3_workspace');
    }
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('current');
        return new Promise((resolve) => {
            request.onsuccess = () => {
                const workspace = request.result;
                resolve(workspace?.data || null);
            };
            request.onerror = () => {
                console.warn('IndexedDB load failed, trying localStorage');
                resolve(localStorage.getItem('lab3_workspace'));
            };
        });
    }
    catch (error) {
        console.warn('IndexedDB load failed:', error);
        return localStorage.getItem('lab3_workspace');
    }
}
export async function clearWorkspace() {
    if (db) {
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.delete('current');
        }
        catch (error) {
            console.warn('Failed to clear IndexedDB');
        }
    }
    // Also clear localStorage
    localStorage.removeItem('lab3_workspace');
    localStorage.removeItem('lab3_workspace_timestamp');
}
export function hasAutoSave() {
    return !!localStorage.getItem('lab3_workspace') || !!db;
}
export function getAutoSaveTimestamp() {
    const timestamp = localStorage.getItem('lab3_workspace_timestamp');
    if (timestamp) {
        return new Date(parseInt(timestamp)).toLocaleString();
    }
    return null;
}
