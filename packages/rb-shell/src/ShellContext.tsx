// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { createContext, useContext } from 'react';
import type { RedByteApp } from '@redbyte/rb-apps';

interface ShellContextValue {
  openApp: (id: string, props?: any) => void;
  apps: RedByteApp[];
}

const ShellContext = createContext<ShellContextValue | null>(null);

export const ShellProvider: React.FC<{ value: ShellContextValue; children: React.ReactNode }> = ({
  value,
  children,
}) => {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
};

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error('useShell must be used within ShellProvider');
  }
  return ctx;
}
