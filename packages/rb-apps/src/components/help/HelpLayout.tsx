// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { type ReactNode } from 'react';

export interface HelpLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * HelpLayout - Two-column layout for Help app
 * Provides consistent sidebar + content structure
 */
export const HelpLayout: React.FC<HelpLayoutProps> = ({ sidebar, children }) => {
  return (
    <div className="flex h-full bg-slate-900 text-gray-200 font-sans">
      {/* Sidebar */}
      <div className="w-[280px] border-r border-slate-700 p-6 overflow-y-auto">
        {sidebar}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {children}
      </div>
    </div>
  );
};
