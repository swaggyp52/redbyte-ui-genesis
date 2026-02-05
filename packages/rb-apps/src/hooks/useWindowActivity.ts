// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { shallow } from 'zustand/shallow';
import { useWindowStore } from '@redbyte/rb-windowing';

export function useWindowActivity(windowId?: string): {
  isVisible: boolean;
  isFocused: boolean;
} {
  const selector = React.useMemo(() => {
    return (state: { windows: { id: string; focused: boolean; mode: string }[] }) => {
      if (!windowId) return [true, false] as const;
      const w = state.windows.find((entry) => entry.id === windowId);
      const focused = !!w?.focused;
      const minimized = w?.mode === 'minimized';
      return [focused, minimized] as const;
    };
  }, [windowId]);

  const [focused, minimized] = useWindowStore(selector, shallow as any);
  return {
    isVisible: !minimized,
    isFocused: focused,
  };
}

