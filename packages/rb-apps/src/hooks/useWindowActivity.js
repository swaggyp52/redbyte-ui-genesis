// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { useWindowStore } from '@redbyte/rb-windowing';
export function useWindowActivity(windowId) {
    // Cache the last result to prevent returning new object references when values haven't changed
    const lastResultRef = React.useRef({ isVisible: true, isFocused: false });
    const selector = React.useCallback((state) => {
        if (!windowId) {
            const result = { isVisible: true, isFocused: false };
            // Always use the same object reference for the no-windowId case
            if (lastResultRef.current.isVisible === result.isVisible && lastResultRef.current.isFocused === result.isFocused) {
                return lastResultRef.current;
            }
            lastResultRef.current = result;
            return result;
        }
        const w = state.windows.find((entry) => entry.id === windowId);
        const focused = !!w?.focused;
        const minimized = w?.mode === 'minimized';
        const isVisible = !minimized;
        const isFocused = focused;
        // Return cached reference if values haven't changed
        if (lastResultRef.current.isVisible === isVisible && lastResultRef.current.isFocused === isFocused) {
            return lastResultRef.current;
        }
        const result = { isVisible, isFocused };
        lastResultRef.current = result;
        return result;
    }, [windowId]);
    // Use custom equality function to only re-render when values actually change
    return useWindowStore(selector, (a, b) => a.isVisible === b.isVisible && a.isFocused === b.isFocused);
}
