// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { HardwareTraceV1 } from '../hardware/traceFormat';
import { validateTrace, serializeTrace, deserializeTrace } from '../hardware/traceFormat';
import { useFileSystemStore } from '../stores/fileSystemStore';

// In a real app we would use window.showSaveFilePicker or RedByte FS dialogs
// For MVP we just use the fileSystemStore actions or direct blobs
// But since this is a "RedByte App", we should use the file system store if possible.
// However, sticking to "smallest MVP", we can mimic what other apps do.

export async function saveTraceToFS(trace: HardwareTraceV1, filename: string): Promise<boolean> {
    try {
        const fs = useFileSystemStore.getState();
        const content = serializeTrace(trace);

        // Check if valid
        const validation = validateTrace(trace);
        if (!validation.ok) {
            console.error('Invalid trace:', validation.errors);
            return false;
        }

        // Normalize filename: remove leading slashes and ensure .json
        let safeName = filename.replace(/^\/+/, '');
        if (!safeName.endsWith('.json')) {
            safeName += '.json';
        }

        // Use createFile which accepts path
        // We assume creating in root '/' for MVP
        await fs.createFile('/' + safeName, content);
        return true;
    } catch (error) {
        console.error('Failed to save trace', error);
        return false;
    }
}

export async function loadTraceFromFS(fileId: string): Promise<HardwareTraceV1 | null> {
    try {
        const fs = useFileSystemStore.getState();
        // Normalize fileId (ensure strictly a path or handle ID)
        // fs.getFile expects an ID or we need to find it?
        // Looking at store, getFile implementation iterates folders to find entry by ID.
        // BUT the 'createFile' returned an ID like `file-${nextId}`.
        // AND it created it in the store structure.

        // IF the user provides a filename (e.g. "trace.json") we might need to SEARCH for it by name if getFile expects ID.
        // The previous implementation used getFile(fileId). 
        // If fileId is the *Name* it won't work if getFile expects *ID*.

        // To handle "Load by Name", we should use getAllFiles() and find by name.

        const allFiles = fs.getAllFiles();
        // Find file that matches the provided name (or ID)
        const file = allFiles.find(f => f.id === fileId || f.name === fileId || f.name === fileId + '.json');

        if (!file) return null;

        // file.content is optional
        if (!file.content) {
            console.error('File has no content');
            return null;
        }

        const trace = deserializeTrace(file.content);
        const validation = validateTrace(trace);

        if (!validation.ok) {
            console.warn('Trace validation failed:', validation.errors);
            return null;
        }

        return trace;
    } catch (error) {
        console.error('Failed to load trace', error);
        return null;
    }
}
