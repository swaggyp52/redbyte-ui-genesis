import React from 'react';
import { TerminalIcon, FilesIcon, SettingsIcon, LogicIcon } from '@rb/rb-icons';

interface DockProps {
  onOpenApp: (id: string) => void;
}

const dockIcons = [
  { id: 'terminal', component: TerminalIcon },
  { id: 'files', component: FilesIcon },
  { id: 'settings', component: SettingsIcon },
  { id: 'logic-playground', component: LogicIcon },
];

export const Dock: React.FC<DockProps> = ({ onOpenApp }) => {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-2xl bg-black/50 px-4 py-2 backdrop-blur-md border border-white/10 shadow-2xl">
      {dockIcons.map((dock) => {
        const Icon = dock.component;
        return (
          <button
            key={dock.id}
            onClick={() => onOpenApp(dock.id)}
            className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
          >
            <Icon width={26} height={26} />
          </button>
        );
      })}
    </div>
  );
};
