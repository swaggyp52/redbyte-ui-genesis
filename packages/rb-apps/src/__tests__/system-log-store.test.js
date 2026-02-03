// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect, beforeEach } from 'vitest';
import { useSystemLogStore } from '../stores/systemLogStore';
describe('System log store', () => {
    beforeEach(() => {
        localStorage.clear();
        useSystemLogStore.setState({ entries: [], lastReadSeq: 0 });
    });
    it('appends entries and tracks last read', () => {
        const store = useSystemLogStore.getState();
        const entry = store.addEntry({
            level: 'info',
            source: 'test',
            message: 'hello',
        });
        const afterAdd = useSystemLogStore.getState();
        expect(afterAdd.entries[0].id).toBe(entry.id);
        expect(afterAdd.entries[0].message).toBe('hello');
        expect(afterAdd.lastReadSeq).toBe(0);
        store.markRead();
        expect(useSystemLogStore.getState().lastReadSeq).toBe(entry.seq);
    });
});
