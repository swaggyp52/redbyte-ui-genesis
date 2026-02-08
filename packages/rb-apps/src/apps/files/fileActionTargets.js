// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Registry of apps that can receive file actions via open-with intents.
 * Single source of truth for "Open With" targets.
 * PHASE_Z: Now uses eligibility predicates based on resourceType + file extension.
 */
export const FILE_ACTION_TARGETS = [
    {
        id: 'logic-playground',
        name: 'Logic Playground',
        appId: 'logic-playground',
        isEligible: (type, name) => type === 'file' && (name.endsWith('.rblogic') || name.endsWith('.rbev')),
    },
    {
        id: 'text-viewer',
        name: 'Text Viewer',
        appId: 'text-viewer',
        isEligible: (type, name) => type === 'file' && (name.endsWith('.txt') || name.endsWith('.md')),
    },
    {
        id: 'submission-inspector',
        name: 'Submission Inspector',
        appId: 'submission-inspector',
        isEligible: (type, name) => type === 'file' && (name.endsWith('.capsule.json') ||
            (name.startsWith('vector-run-') && name.endsWith('.json')) ||
            name.endsWith('.events.ndjson')),
    },
    {
        id: 'ece-lab',
        name: 'Lab Workspace',
        appId: 'ece-lab',
        isEligible: (type, name) => type === 'file' && name.endsWith('.labcapsule.json'),
    },
];
/**
 * Get all file action targets that are eligible for the given entry.
 * Uses deterministic eligibility predicates (resourceType + file extension).
 */
export function getFileActionTargets(entry) {
    return FILE_ACTION_TARGETS.filter((target) => target.isEligible(entry.type, entry.name));
}
/**
 * Check if a file action is eligible for the given entry.
 * Returns false for folders (no file actions), true for files with available targets.
 */
export function isFileActionEligible(entry) {
    if (!entry)
        return false;
    if (entry.type === 'folder')
        return false;
    return getFileActionTargets(entry).length > 0;
}
/**
 * Get the default file action target (Logic Playground).
 */
export function getDefaultFileActionTarget() {
    return FILE_ACTION_TARGETS.find((t) => t.id === 'logic-playground') || null;
}
