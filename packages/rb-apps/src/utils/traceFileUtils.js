// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { validateTrace, serializeTrace, deserializeTrace } from '../hardware/traceFormat';
import { validateCapsule } from '../hardware/capsuleFormat';
import { useFileSystemStore } from '../stores/fileSystemStore';
export async function saveTraceToFS(trace, filename) {
    try {
        const fs = useFileSystemStore.getState();
        const content = serializeTrace(trace);
        // Check if valid
        const validation = validateTrace(trace);
        if (!validation.ok) {
            console.error('Invalid trace:', validation.errors);
            alert(`Cannot save invalid trace:\n${validation.errors.slice(0, 3).join('\n')}`);
            return false;
        }
        // Normalize filename: remove leading slashes and ensure .json
        let safeName = filename.replace(/^\/+/, '');
        if (!safeName.toLowerCase().endsWith('.json')) {
            safeName += '.json';
        }
        // Check if file exists, if so, append timestamp to be safe?
        // Actually, user prompt usually implies intent. 
        // But let's verify if we can overwrite. The 'createFile' in fileSystemStore might throw or duplicate.
        // Let's assume we want to overwrite if user specified name, OR update if it exists.
        // But for MVP, let's just create.
        await fs.createFile('/' + safeName, content);
        console.log('[TraceUtils] Saved trace to:', safeName);
        return true;
    }
    catch (error) {
        console.error('Failed to save trace', error);
        return false;
    }
}
export async function loadTraceFromFS(fileIdOrName) {
    try {
        const fs = useFileSystemStore.getState();
        const allFiles = fs.getAllFiles();
        // Robust finder: match exact ID, or name, or name.json
        const file = allFiles.find(f => f.id === fileIdOrName ||
            f.name === fileIdOrName ||
            f.name.toLowerCase() === fileIdOrName.toLowerCase() ||
            f.name.toLowerCase() === (fileIdOrName + '.json').toLowerCase());
        if (!file) {
            console.error(`File not found: ${fileIdOrName}`);
            alert(`File not found: ${fileIdOrName}`);
            return null;
        }
        // file.content is optional
        if (!file.content) {
            console.error('File has no content');
            alert('File is empty.');
            return null;
        }
        let trace;
        try {
            trace = deserializeTrace(file.content);
        }
        catch (e) {
            console.error('JSON Parse Error', e);
            alert('Failed to parse trace file. Is it valid JSON?');
            return null;
        }
        const validation = validateTrace(trace);
        if (!validation.ok) {
            console.warn('Trace validation failed:', validation.errors);
            alert(`Trace validation failed:\n${validation.errors.slice(0, 3).join('\n')}`);
            return null;
        }
        return trace;
    }
    catch (error) {
        console.error('Failed to load trace', error);
        alert('An unexpected error occurred while loading the trace.');
        return null;
    }
}
export async function saveCapsuleToFS(capsule, filename) {
    try {
        const fs = useFileSystemStore.getState();
        const content = JSON.stringify(capsule, null, 2);
        const validation = validateCapsule(capsule);
        if (!validation.ok) {
            console.error('Invalid capsule:', validation.error);
            alert(`Cannot save invalid capsule: ${validation.error}`);
            return false;
        }
        let safeName = filename.replace(/^\/+/, '');
        if (!safeName.toLowerCase().endsWith('.json') && !safeName.toLowerCase().endsWith('.capsule')) {
            // Prefer .capsule.json or just .json? Plan said .json mostly?
            // Let's stick to .json for compatibility with file system viewer usually, or .capsule.json
            safeName += '.json';
        }
        await fs.createFile('/' + safeName, content);
        console.log('[TraceUtils] Saved capsule to:', safeName);
        return true;
    }
    catch (error) {
        console.error('Failed to save capsule', error);
        return false;
    }
}
export async function loadCapsuleFromFS(fileIdOrName) {
    try {
        const fs = useFileSystemStore.getState();
        const allFiles = fs.getAllFiles();
        const file = allFiles.find(f => f.id === fileIdOrName ||
            f.name === fileIdOrName ||
            f.name.toLowerCase() === fileIdOrName.toLowerCase() ||
            f.name.toLowerCase() === (fileIdOrName + '.json').toLowerCase());
        if (!file || !file.content)
            return null;
        let data;
        try {
            data = JSON.parse(file.content);
        }
        catch {
            return null;
        }
        // Validate
        const validation = validateCapsule(data);
        if (!validation.ok || !validation.capsule) {
            console.warn('Capsule validation failed:', validation.error);
            return null;
        }
        return validation.capsule;
    }
    catch (error) {
        console.error('Failed to load capsule', error);
        return null;
    }
}
