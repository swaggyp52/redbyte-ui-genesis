// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Creates the initial filesystem state with Home/Desktop/Documents structure.
 * Uses deterministic IDs starting from 1.
 */
export function createInitialFsState() {
    return {
        folders: {
            home: {
                id: 'home',
                name: 'Home',
                entries: [
                    { id: 'desktop-link', name: 'Desktop', type: 'folder', modified: '2025-12-16 10:00' },
                    { id: 'documents-link', name: 'Documents', type: 'folder', modified: '2025-12-16 10:00' },
                    { id: 'downloads-link', name: 'Downloads', type: 'folder', modified: '2025-12-16 10:00' },
                    {
                        id: 'circuit',
                        name: 'circuit.rblogic',
                        type: 'file',
                        modified: '2025-12-18 14:00',
                        content: '{"version":"1","nodes":[],"connections":[]}',
                    },
                ],
            },
            desktop: {
                id: 'desktop',
                name: 'Desktop',
                entries: [
                    { id: 'project1', name: 'Project Files', type: 'folder', modified: '2025-12-15 14:30' },
                    {
                        id: 'notes',
                        name: 'Notes.txt',
                        type: 'file',
                        modified: '2025-12-16 09:15',
                        content: 'RedByte Notes\n\n- Logic Playground is the core workspace.\n- Files manages project artifacts.\n- Determinism is a product feature, not a demo.',
                    },
                ],
            },
            documents: {
                id: 'documents',
                name: 'Documents',
                entries: [
                    { id: 'reports', name: 'Reports', type: 'folder', modified: '2025-12-14 16:20' },
                    { id: 'proofs', name: 'Proofs', type: 'folder', modified: '2026-01-16 04:17' },
                    {
                        id: 'readme',
                        name: 'README.md',
                        type: 'file',
                        modified: '2025-12-13 11:45',
                        content: '# RedByte OS Files\n\nThis folder holds exported projects and reference notes.\n',
                    },
                    {
                        id: 'config',
                        name: 'config.json',
                        type: 'file',
                        modified: '2025-12-12 08:30',
                        content: '{\"workspace\":\"redbyte\",\"tickRate\":20}',
                    },
                ],
            },
            downloads: {
                id: 'downloads',
                name: 'Downloads',
                entries: [
                    {
                        id: 'archive',
                        name: 'archive.zip',
                        type: 'file',
                        modified: '2025-12-11 15:00',
                        content: '',
                    },
                ],
            },
            project1: {
                id: 'project1',
                name: 'Project Files',
                entries: [
                    { id: 'src', name: 'src', type: 'folder', modified: '2025-12-15 14:30' },
                    { id: 'package', name: 'package.json', type: 'file', modified: '2025-12-15 12:00' },
                ],
            },
            reports: {
                id: 'reports',
                name: 'Reports',
                entries: [
                    { id: 'q4', name: 'Q4-2024.pdf', type: 'file', modified: '2025-12-14 16:20' },
                ],
            },
            proofs: {
                id: 'proofs',
                name: 'Proofs',
                entries: [
                    {
                        id: 'proof-capsule',
                        name: 'traffic-light-stateful.capsule.json',
                        type: 'file',
                        modified: '2026-01-16 04:17',
                        content: `{
  "session_id": "vector-run-2026-01-16T04-17-16",
  "timestamp": "2026-01-16T04:17:16.387Z",
  "board_id": "basys3",
  "board_snapshot": {
    "id": "basys3",
    "name": "Basys3",
    "description": "Artix-7 based board with 16-bit switches, 16 LEDs, 5 buttons",
    "widths": {
      "LED": 16,
      "SW": 16,
      "BTN": 5
    },
    "labels": {
      "LED": [
        "LD15",
        "LD14",
        "LD13",
        "LD12",
        "LD11",
        "LD10",
        "LD9",
        "LD8",
        "LD7",
        "LD6",
        "LD5",
        "LD4",
        "LD3",
        "LD2",
        "LD1",
        "LD0"
      ],
      "SW": [
        "SW15",
        "SW14",
        "SW13",
        "SW12",
        "SW11",
        "SW10",
        "SW9",
        "SW8",
        "SW7",
        "SW6",
        "SW5",
        "SW4",
        "SW3",
        "SW2",
        "SW1",
        "SW0"
      ],
      "BTN": [
        "BTNC",
        "BTNU",
        "BTNL",
        "BTNR",
        "BTND"
      ]
    }
  },
  "vector_file_hash": "4f4db7fc104fb4ea73e36ef68590ced94496bb45cf9a70637f6b7a9bf6f14981",
  "git_sha": "a0648fd1",
  "node_version": "v25.3.0",
  "started_at": "2026-01-16T04:17:16.386Z",
  "ended_at": "2026-01-16T04:17:16.424Z",
  "test_summary": {
    "total": 15,
    "passed": 15,
    "failed": 0
  },
  "summary": {
    "passed": 15,
    "failed": 0,
    "total_events": 16
  },
  "results": [
    {
      "name": "t0 GREEN",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t1 GREEN",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t2 GREEN",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t3 GREEN",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t4 GREEN",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t5 YELLOW",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000001",
      "observed": "0000000000000001",
      "mismatch": null
    },
    {
      "name": "t6 YELLOW",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000001",
      "observed": "0000000000000001",
      "mismatch": null
    },
    {
      "name": "t7 RED",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000010",
      "observed": "0000000000000010",
      "mismatch": null
    },
    {
      "name": "t8 RED",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000010",
      "observed": "0000000000000010",
      "mismatch": null
    },
    {
      "name": "t9 RED",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000010",
      "observed": "0000000000000010",
      "mismatch": null
    },
    {
      "name": "t10 RED",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000010",
      "observed": "0000000000000010",
      "mismatch": null
    },
    {
      "name": "t11 RED",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000010",
      "observed": "0000000000000010",
      "mismatch": null
    },
    {
      "name": "t12 RESET -> GREEN",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 2
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t13 GREEN after reset",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    },
    {
      "name": "t14 GREEN after reset",
      "result": "PASS",
      "inputs": {
        "SW": 0,
        "BTN": 0
      },
      "expected": "0000000000000000",
      "observed": "0000000000000000",
      "mismatch": null
    }
  ],
  "events": {
    "format": "ndjson",
    "path": "traffic-light-stateful.events.ndjson",
    "sha256": "807bf580cc9dea1d0733b3bb79db10a787def1d8414e0e6955aebcf7581ccf1c",
    "count": 16
  }
}
`,
                    },
                    {
                        id: 'proof-events',
                        name: 'traffic-light-stateful.events.ndjson',
                        type: 'file',
                        modified: '2026-01-16 04:17',
                        content: `{"type":"status","seq":1,"timestamp":1768537036386,"source":"mock","connected":true,"port":"MOCK","baud":115200,"lastMsgTs":null,"lastMsg":null}
{"type":"io:update","seq":2,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"1","ts_offset_ms":1}
{"type":"io:update","seq":3,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"2","ts_offset_ms":1}
{"type":"io:update","seq":4,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"3","ts_offset_ms":1}
{"type":"io:update","seq":5,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"4","ts_offset_ms":1}
{"type":"io:update","seq":6,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"5","ts_offset_ms":1}
{"type":"io:update","seq":7,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000001","TICK":"6","ts_offset_ms":1}
{"type":"io:update","seq":8,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000001","TICK":"7","ts_offset_ms":1}
{"type":"io:update","seq":9,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000010","TICK":"8","ts_offset_ms":1}
{"type":"io:update","seq":10,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000010","TICK":"9","ts_offset_ms":1}
{"type":"io:update","seq":11,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000010","TICK":"10","ts_offset_ms":1}
{"type":"io:update","seq":12,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000010","TICK":"11","ts_offset_ms":1}
{"type":"io:update","seq":13,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000010","TICK":"12","ts_offset_ms":1}
{"type":"io:update","seq":14,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00010","LED":"0000000000000000","TICK":"13","ts_offset_ms":1}
{"type":"io:update","seq":15,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"14","ts_offset_ms":1}
{"type":"io:update","seq":16,"timestamp":1768537036387,"source":"mock","SW":"0000000000000000","BTN":"00000","LED":"0000000000000000","TICK":"15","ts_offset_ms":1}
`,
                    },
                ],
            },
        },
        nextId: 1,
        roots: ['home', 'desktop', 'documents'],
    };
}
/**
 * Map folder link IDs to actual folders (used for navigation).
 */
const FOLDER_LINKS = {
    'desktop-link': 'desktop',
    'documents-link': 'documents',
    'downloads-link': 'downloads',
};
/**
 * Parent folder map for breadcrumb and navigation.
 */
const FOLDER_PARENTS = {
    home: null,
    desktop: 'home',
    documents: 'home',
    downloads: 'home',
    project1: 'desktop',
    reports: 'documents',
    proofs: 'documents',
};
/**
 * Validates a name for file/folder operations.
 * Returns trimmed name or null if invalid.
 */
function validateName(name) {
    const trimmed = name.trim();
    if (trimmed === '')
        return null;
    if (trimmed.includes('/') || trimmed.includes('\\'))
        return null;
    return trimmed;
}
/**
 * Generates a unique name by auto-suffixing with " (2)", " (3)", etc.
 * if the base name already exists in the parent folder.
 */
function generateUniqueName(baseName, existingNames) {
    const nameSet = new Set(existingNames);
    if (!nameSet.has(baseName)) {
        return baseName;
    }
    let counter = 2;
    while (nameSet.has(`${baseName} (${counter})`)) {
        counter++;
    }
    return `${baseName} (${counter})`;
}
/**
 * Gets current timestamp string for modified field.
 */
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
/**
 * Creates a new folder in the specified parent folder.
 * Returns new filesystem state with folder added.
 * Auto-suffixes name if duplicate exists.
 */
export function createFolder(parentId, name, fs) {
    const validName = validateName(name);
    if (!validName) {
        throw new Error('Invalid folder name: empty or contains / or \\');
    }
    const parent = fs.folders[parentId];
    if (!parent) {
        throw new Error(`Parent folder not found: ${parentId}`);
    }
    const existingNames = parent.entries.map((e) => e.name);
    const uniqueName = generateUniqueName(validName, existingNames);
    const newId = `folder-${fs.nextId}`;
    const timestamp = getCurrentTimestamp();
    const newEntry = {
        id: newId,
        name: uniqueName,
        type: 'folder',
        modified: timestamp,
    };
    const newFolder = {
        id: newId,
        name: uniqueName,
        entries: [],
    };
    return {
        ...fs,
        folders: {
            ...fs.folders,
            [parentId]: {
                ...parent,
                entries: [...parent.entries, newEntry],
            },
            [newId]: newFolder,
        },
        nextId: fs.nextId + 1,
    };
}
/**
 * Creates a new file in the specified parent folder.
 * Returns new filesystem state with file added.
 * Auto-suffixes name if duplicate exists.
 */
export function createFile(parentId, name, fs, content) {
    const validName = validateName(name);
    if (!validName) {
        throw new Error('Invalid file name: empty or contains / or \\');
    }
    const parent = fs.folders[parentId];
    if (!parent) {
        throw new Error(`Parent folder not found: ${parentId}`);
    }
    const existingNames = parent.entries.map((e) => e.name);
    const uniqueName = generateUniqueName(validName, existingNames);
    const newId = `file-${fs.nextId}`;
    const timestamp = getCurrentTimestamp();
    const newEntry = {
        id: newId,
        name: uniqueName,
        type: 'file',
        modified: timestamp,
        content,
    };
    return {
        ...fs,
        folders: {
            ...fs.folders,
            [parentId]: {
                ...parent,
                entries: [...parent.entries, newEntry],
            },
        },
        nextId: fs.nextId + 1,
    };
}
/**
 * Renames an entry (file or folder).
 * Returns new filesystem state with entry renamed.
 * Auto-suffixes name if duplicate exists.
 * Throws if attempting to rename a root folder.
 */
export function renameEntry(id, newName, fs) {
    const validName = validateName(newName);
    if (!validName) {
        throw new Error('Invalid name: empty or contains / or \\');
    }
    // Prevent renaming root folders
    if (fs.roots.includes(id)) {
        throw new Error(`Cannot rename root folder: ${id}`);
    }
    // Find parent folder containing this entry
    let parentId = null;
    let entryIndex = -1;
    let targetEntry = null;
    for (const [folderId, folder] of Object.entries(fs.folders)) {
        const index = folder.entries.findIndex((e) => e.id === id);
        if (index !== -1) {
            parentId = folderId;
            entryIndex = index;
            targetEntry = folder.entries[index];
            break;
        }
    }
    if (!parentId || !targetEntry || entryIndex === -1) {
        throw new Error(`Entry not found: ${id}`);
    }
    const parent = fs.folders[parentId];
    const existingNames = parent.entries
        .filter((e, i) => i !== entryIndex)
        .map((e) => e.name);
    const uniqueName = generateUniqueName(validName, existingNames);
    const timestamp = getCurrentTimestamp();
    const updatedEntry = {
        ...targetEntry,
        name: uniqueName,
        modified: timestamp,
    };
    const updatedParent = {
        ...parent,
        entries: parent.entries.map((e, i) => (i === entryIndex ? updatedEntry : e)),
    };
    const newFolders = {
        ...fs.folders,
        [parentId]: updatedParent,
    };
    // If renaming a folder, also update the folder's own name
    if (targetEntry.type === 'folder' && fs.folders[id]) {
        newFolders[id] = {
            ...fs.folders[id],
            name: uniqueName,
        };
    }
    return {
        ...fs,
        folders: newFolders,
    };
}
/**
 * Recursively collects all descendant folder IDs of a given folder.
 */
function collectDescendantFolders(folderId, fs) {
    const folder = fs.folders[folderId];
    if (!folder)
        return [];
    const descendants = [];
    for (const entry of folder.entries) {
        if (entry.type === 'folder') {
            descendants.push(entry.id);
            descendants.push(...collectDescendantFolders(entry.id, fs));
        }
    }
    return descendants;
}
/**
 * Deletes an entry (file or folder).
 * For folders, cascades delete to entire subtree.
 * Returns new filesystem state with entry removed.
 * Throws if attempting to delete a root folder.
 */
export function deleteEntry(id, fs) {
    // Prevent deleting root folders
    if (fs.roots.includes(id)) {
        throw new Error(`Cannot delete root folder: ${id}`);
    }
    // Find parent folder containing this entry
    let parentId = null;
    let targetEntry = null;
    for (const [folderId, folder] of Object.entries(fs.folders)) {
        const entry = folder.entries.find((e) => e.id === id);
        if (entry) {
            parentId = folderId;
            targetEntry = entry;
            break;
        }
    }
    if (!parentId || !targetEntry) {
        throw new Error(`Entry not found: ${id}`);
    }
    const parent = fs.folders[parentId];
    const updatedParent = {
        ...parent,
        entries: parent.entries.filter((e) => e.id !== id),
    };
    const newFolders = {
        ...fs.folders,
        [parentId]: updatedParent,
    };
    // If deleting a folder, cascade delete all descendants
    if (targetEntry.type === 'folder') {
        const descendantIds = collectDescendantFolders(id, fs);
        delete newFolders[id];
        for (const descendantId of descendantIds) {
            delete newFolders[descendantId];
        }
    }
    return {
        ...fs,
        folders: newFolders,
    };
}
/**
 * Gets all entries in a folder.
 */
export function getChildren(parentId, fs) {
    const folder = fs.folders[parentId];
    if (!folder)
        return [];
    return folder.entries;
}
/**
 * Computes breadcrumb path from root to current folder.
 * Returns array of {id, name} segments.
 */
export function getPath(folderId, fs) {
    const path = [];
    let current = folderId;
    while (current !== null) {
        const folder = fs.folders[current];
        if (folder) {
            path.unshift({ id: folder.id, name: folder.name });
        }
        current = FOLDER_PARENTS[current] ?? null;
    }
    return path;
}
/**
 * Gets fallback folder ID when a folder is deleted.
 * Returns parent folder ID, or 'home' if no parent.
 */
export function getFallbackFolderId(deletedId, fs) {
    const parentId = FOLDER_PARENTS[deletedId];
    if (parentId && fs.folders[parentId]) {
        return parentId;
    }
    return 'home';
}
/**
 * Resolves folder links (e.g., 'desktop-link' -> 'desktop').
 */
export function resolveFolderLink(id) {
    return FOLDER_LINKS[id] || id;
}
