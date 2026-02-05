import React from 'react';
import { shallow } from 'zustand/shallow';
import { useWindowStore } from '@redbyte/rb-windowing';
export function useWindowActivity(windowId) {
    const selector = React.useMemo(() => {
        return (state) => {
            if (!windowId)
                return [true, false];
            const w = state.windows.find((entry) => entry.id === windowId);
            const focused = !!(w === null || w === void 0 ? void 0 : w.focused);
            const minimized = (w === null || w === void 0 ? void 0 : w.mode) === 'minimized';
            return [focused, minimized];
        };
    }, [windowId]);
    const [focused, minimized] = useWindowStore(selector, shallow);
    return {
        isVisible: !minimized,
        isFocused: focused,
    };
}

