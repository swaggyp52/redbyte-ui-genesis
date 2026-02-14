// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Taskbar.tsx: Fixed navigation bar for launching key applications.

import React from 'react';
import { Icon, type IconName } from '@redbyte/rb-icons';

interface TaskbarIconProps {
    id: string;
    iconId: IconName;
    label: string;
    onClick: (id: string) => void;
}

const TaskbarIcon: React.FC<TaskbarIconProps> = ({ id, iconId, label, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className="rb-taskbar-icon group relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 hover:-translate-y-1 active:scale-90"
        title={label}
    >
        <Icon
            name={iconId}
            size={20}
            className="rb-taskbar-icon__icon transition-colors drop-shadow-lg"
        />
        <span className="rb-taskbar-icon__dot absolute -bottom-1 w-1 h-1 rounded-full scale-0 group-hover:scale-100 transition-transform" />

        {/* Tooltip */}
        <div className="rb-taskbar-tooltip absolute -top-10 px-2 py-1 text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
            {label}
        </div>
    </button>
);

const PINNED_APPS: Array<{ id: string; label: string; iconId: IconName }> = [
    { id: 'home', label: 'Studio Dashboard', iconId: 'neon-wave' },
    { id: 'lab-workspace', label: 'Studio', iconId: 'cpu' },
    { id: 'files', label: 'Files', iconId: 'files' },
    { id: 'settings', label: 'Settings', iconId: 'settings' },
];

export const Taskbar: React.FC<{ onOpenApp: (id: string) => void }> = ({ onOpenApp }) => {
    return (
        <div className="rb-taskbar fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 backdrop-blur-2xl rounded-2xl z-[1000] select-none">
            <div className="rb-taskbar-divider flex items-center gap-1 px-2 mr-1">
                <button
                    onClick={() => onOpenApp('launcher')}
                    className="rb-taskbar-launcher w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
                    title="Launcher"
                    aria-label="Launcher"
                >
                    <Icon name="search" size={18} className="rb-taskbar-launcher__icon" />
                </button>
            </div>

            <div className="flex items-center gap-1">
                {PINNED_APPS.map(app => (
                    <TaskbarIcon
                        key={app.id}
                        id={app.id}
                        iconId={app.iconId}
                        label={app.label}
                        onClick={onOpenApp}
                    />
                ))}
            </div>

            <div className="rb-taskbar-separator w-px h-6 mx-2" />

            <div className="flex items-center gap-3 px-4 py-1">
                <div className="flex flex-col items-end">
                    <span className="rb-taskbar-brand text-[10px] font-black tracking-widest uppercase">RedByte</span>
                    <span className="rb-taskbar-brand-accent text-[9px] font-mono">GENESIS</span>
                </div>
            </div>
        </div>
    );
};
