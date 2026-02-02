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
        className="group relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 hover:bg-white/10 hover:-translate-y-1 active:scale-90"
        title={label}
    >
        <Icon
            name={iconId}
            size={20}
            className="text-slate-400 group-hover:text-white transition-colors drop-shadow-lg"
        />
        <span className="absolute -bottom-1 w-1 h-1 bg-indigo-500 rounded-full scale-0 group-hover:scale-100 transition-transform" />

        {/* Tooltip */}
        <div className="absolute -top-10 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap border border-slate-700 shadow-xl">
            {label}
        </div>
    </button>
);

const PINNED_APPS: Array<{ id: string; label: string; iconId: IconName }> = [
    { id: 'start-here', label: 'Start Here', iconId: 'browser' },
    { id: 'logic-playground', label: 'Playground', iconId: 'logic' },
    { id: 'ece-lab', label: 'ECE Lab', iconId: 'chip' },
    { id: 'logic-lab-app', label: 'Labs', iconId: 'book' }, // User called it "Labs"
    { id: 'terminal', label: 'Terminal', iconId: 'terminal' },
];

export const Taskbar: React.FC<{ onOpenApp: (id: string) => void }> = ({ onOpenApp }) => {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[1000] select-none">
            <div className="flex items-center gap-1 px-2 border-r border-white/5 mr-1">
                <button
                    onClick={() => onOpenApp('launcher')}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
                >
                    <Icon name="browser" size={18} className="text-white" />
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

            <div className="w-px h-6 bg-white/5 mx-2" />

            <div className="flex items-center gap-3 px-4 py-1">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-white/50 tracking-widest uppercase">RedByte</span>
                    <span className="text-[9px] font-mono text-indigo-400">GENESIS</span>
                </div>
            </div>
        </div>
    );
};
