// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWindowActivity } from '../useWindowActivity';
// Mock the windowing store
vi.mock('@redbyte/rb-windowing', () => ({
    useWindowStore: (selector) => {
        const mockState = {
            windows: [
                { id: 'window-1', focused: true, mode: 'normal' },
                { id: 'window-2', focused: false, mode: 'minimized' },
            ],
        };
        return selector(mockState);
    },
}));
describe('useWindowActivity', () => {
    it('should return stable object reference when values do not change', () => {
        const { result, rerender } = renderHook(() => useWindowActivity('window-1'));
        const firstResult = result.current;
        expect(firstResult.isVisible).toBe(true);
        expect(firstResult.isFocused).toBe(true);
        // Force re-render
        rerender();
        const secondResult = result.current;
        // CRITICAL: Same object reference to prevent infinite loops
        expect(firstResult).toBe(secondResult);
    });
    it('should detect minimized windows', () => {
        const { result } = renderHook(() => useWindowActivity('window-2'));
        expect(result.current.isVisible).toBe(false);
        expect(result.current.isFocused).toBe(false);
    });
    it('should return default values for no windowId', () => {
        const { result } = renderHook(() => useWindowActivity());
        expect(result.current.isVisible).toBe(true);
        expect(result.current.isFocused).toBe(false);
    });
});
