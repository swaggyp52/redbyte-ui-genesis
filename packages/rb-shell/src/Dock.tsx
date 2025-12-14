// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import { useWindowStore } from '@redbyte/rb-windowing';
import { BrowserIcon, TerminalIcon, FilesIcon, SettingsIcon, LogicIcon, NeonWaveIcon } from '@redbyte/rb-icons';

interface DockProps {
  onOpenApp: (id: string) => void;
}

const dockIcons = [
  { id: 'launcher', label: 'Launcher', component: BrowserIcon },
  { id: 'terminal', label: 'Terminal', component: TerminalIcon },
  { id: 'files', label: 'Files', component: FilesIcon },
  { id: 'settings', label: 'Settings', component: SettingsIcon },
  { id: 'logic-playground', label: 'Logic Playground', component: LogicIcon },
  { id: 'app-store', label: 'App Store', component: NeonWaveIcon },
];

export const Dock: React.FC<DockProps> = ({ onOpenApp }) => {
  const windows = useWindowStore((s) => s.windows);
  const runningIds = useMemo(
    () => windows.filter((w) => w.mode !== 'minimized').map((w) => w.contentId),
    [windows]
  );

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-black/50 px-4 py-2 backdrop-blur-md border border-white/10 shadow-2xl">
      {dockIcons.map((dock) => {
        const Icon = dock.component;
        const isRunning = runningIds.includes(dock.id);
        return (
          <button
            key={dock.id}
            onClick={() => onOpenApp(dock.id)}
            aria-label={`Open ${dock.label}`}
            title={`Open ${dock.label} (Shortcut: Ctrl+K / Cmd+K)`}
            className="relative h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <Icon width={26} height={26} />
            {isRunning && <span className="absolute -bottom-1 left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-full bg-cyan-400" />}
          </button>
        );
      })}
    </div>
  );
};
