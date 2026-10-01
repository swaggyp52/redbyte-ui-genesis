import { beforeEach, describe, expect, it } from 'vitest';
import { createFileSystemStore, useFileSystemStore } from '../fileSystemStore';
import { createInitialFsState, createFolder, createFile, deleteEntry, getPath, getFallbackFolderId } from '../fileSystemModel';
import { saveTraceToFS, loadTraceFromFS, saveCapsuleToFS, loadCapsuleFromFS } from '../../utils/traceFileUtils';
import type { HardwareTraceV1 } from '../../hardware/traceFormat';
import type { RedByteCapsule } from '../../hardware/capsuleFormat';

describe('retained arbitrary-content filesystem boundary', () => {
  beforeEach(() => { localStorage.clear(); useFileSystemStore.getState().resetAll(); });

  it('loads real persisted arbitrary folders and content on a fresh store', () => {
    const store = useFileSystemStore.getState();
    store.createFolder('home', 'Owner');
    const owner = useFileSystemStore.getState().getChildren('home').find(entry => entry.name === 'Owner');
    if (!owner) throw new Error('Owner folder not created');
    const fileId = useFileSystemStore.getState().createFile(owner.id, 'signal.json', '{"SW":3}');
    const fresh = createFileSystemStore().getState();
    expect(fresh.getFile(fileId)?.content).toBe('{"SW":3}');
    expect(fresh.getPath(owner.id).map(segment => segment.name)).toEqual(['Home', 'Owner']);
  });

  it('uses dynamic ancestry for newly created nested folders without mutating the input', () => {
    const initial = createInitialFsState();
    const parent = createFolder('home', 'Parent', initial);
    const nested = createFolder('folder-1', 'Child', parent);
    expect(getPath('folder-2', nested).map(segment => segment.name)).toEqual(['Home', 'Parent', 'Child']);
    expect(getFallbackFolderId('folder-2', nested)).toBe('folder-1');
    expect(initial.folders['folder-1']).toBeUndefined();
    expect(createFile('folder-2', 'trace.json', nested, '{}').folders['folder-2'].entries[0].content).toBe('{}');
  });

  it('collects aliased seed folders once and retains downloads content', () => {
    const fs = useFileSystemStore.getState();
    const id = fs.createFile('downloads', 'downloaded.json', '{"trace":true}');
    const files = useFileSystemStore.getState().getAllFiles();
    expect(files.filter(file => file.id === id)).toHaveLength(1);
    expect(new Set(files.map(file => file.id)).size).toBe(files.length);
  });

  it('rejects malformed imported entry data before replacing or persisting the owner', () => {
    const fs = useFileSystemStore.getState();
    fs.createFile('home', 'kept.txt', 'kept');
    const before = useFileSystemStore.getState().exportJson();
    const malformed: unknown = { version: 1, state: { folders: {
      home: { id: 'home', name: 'Home', entries: [{ id: 'bad', name: 'bad', type: 'file', modified: 'now', content: 42 }] },
    }, roots: ['home'], nextId: 5 } };
    expect(() => fs.importJson(JSON.stringify(malformed))).toThrow('Invalid folder data');
    expect(useFileSystemStore.getState().exportJson()).toBe(before);
    expect(localStorage.getItem('rb:file-system')).toBe(before);
  });

  it('does not delete a protected root through an imported subtree reference', () => {
    const initial = createFolder('home', 'Parent', createInitialFsState());
    initial.folders['folder-1'].entries.push({
      id: 'documents', name: 'Documents', type: 'folder', modified: '2026-10-01 00:00',
    });
    const before = JSON.stringify(initial);
    expect(() => deleteEntry('folder-1', initial)).toThrow('Cannot delete a subtree containing a root folder');
    expect(JSON.stringify(initial)).toBe(before);
    expect(initial.folders.documents).toBeDefined();
  });

  it('bounds traversal of a validly shaped imported cyclic folder graph', () => {
    const fs = useFileSystemStore.getState();
    fs.importJson(JSON.stringify({ version: 1, state: { nextId: 3, roots: ['home'], folders: {
      home: { id: 'home', name: 'Home', entries: [
        { id: 'loop', name: 'Loop', type: 'folder', modified: 'now' },
      ] },
      loop: { id: 'loop', name: 'Loop', entries: [
        { id: 'home', name: 'Home', type: 'folder', modified: 'now' },
        { id: 'data', name: 'data.json', type: 'file', modified: 'now', content: '{}' },
      ] },
    } } }));
    const current = useFileSystemStore.getState();
    expect(current.getAllFiles().map(file => file.id)).toEqual(['data']);
    expect(current.getPath('loop').map(segment => segment.id)).toEqual(['home', 'loop']);
  });

  it('roundtrips real trace and capsule content through the parent/name/content save API', async () => {
    const trace: HardwareTraceV1 = {
      version: '1.0', boardId: 'basys3', startedAtIso: '2026-10-01T00:00:00.000Z', startTick: 7,
      samples: [{ timestamp: '2026-10-01T00:00:00.000Z', tick: 7, inputs: { SW: 3 }, outputs: { LED: 3 } }],
    };
    const capsule: RedByteCapsule = {
      schemaVersion: '1.0.0', appId: 'redbyte-ece-lab', labId: 'software-roundtrip',
      timestamp: '2026-10-01T00:00:00.000Z', executionSource: 'sim', mode: 'sim-only', trace,
    };
    expect(await saveTraceToFS(trace, '/trace-owner')).toBe(true);
    expect(await saveCapsuleToFS(capsule, '/capsule-owner')).toBe(true);
    expect(await loadTraceFromFS('TRACE-OWNER')).toEqual(trace);
    expect(await loadCapsuleFromFS('capsule-owner')).toEqual(capsule);
    const saved = useFileSystemStore.getState().getChildren('home').filter(entry => entry.name.endsWith('-owner.json'));
    expect(saved).toHaveLength(2);
    for (const file of saved) expect(file.content).toBeTruthy();
  });
});
