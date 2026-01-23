// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { HardwareTraceV1 } from '../hardware/traceFormat';
import { validateTrace, serializeTrace, deserializeTrace } from '../hardware/traceFormat';
import { useFileSystemStore } from '../stores/fileSystemStore';

export async function saveTraceToFS(trace: HardwareTraceV1, filename: string): Promise<boolean> {
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
    } catch (error) {
        console.error('Failed to save trace', error);
        return false;
    }
}

export async function loadTraceFromFS(fileIdOrName: string): Promise<HardwareTraceV1 | null> {
    try {
        const fs = useFileSystemStore.getState();
        const allFiles = fs.getAllFiles();

        // Robust finder: match exact ID, or name, or name.json
        const file = allFiles.find(f =>
            f.id === fileIdOrName ||
            f.name === fileIdOrName ||
            f.name.toLowerCase() === fileIdOrName.toLowerCase() ||
            f.name.toLowerCase() === (fileIdOrName + '.json').toLowerCase()
        );

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

        let trace: HardwareTraceV1;
        try {
            trace = deserializeTrace(file.content);
        } catch (e) {
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
    } catch (error) {
        console.error('Failed to load trace', error);
        alert('An unexpected error occurred while loading the trace.');
        return null;
    }
}
