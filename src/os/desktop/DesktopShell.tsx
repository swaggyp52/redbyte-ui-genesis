import React, { useMemo, useState } from "react";
import WindowFrame from "./WindowFrame";
import { OS_APPS, AppId, loadApp } from "../apps/index";
import { useSettings, LayoutMode } from "../context/SettingsContext";

interface DesktopShellProps {
    user: string;
}

interface WindowState {
    id: number;
    appId: AppId;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
}

const DesktopShell: React.FC<DesktopShellProps> = ({ user }) => {
    const { layoutMode, gridSize } = useSettings();

    const [windows, setWindows] = useState<WindowState[]>([]);
    const [zCounter, setZCounter] = useState(1);
    const [activeId, setActiveId] = useState<number | null>(null);

    const openApp = (id: AppId) => {
        const def = OS_APPS.find(a => a.id === id);
        if (!def) return;

        // MULTI-INSTANCE ENFORCEMENT
        if (!def.allowMultiple) {
            const existing = windows.find(w => w.appId === id);
            if (existing) {
                focusWindow(existing.id);
                return;
            }
        }

        setWindows(prev => {
            const nextZ = zCounter + 1;
            setZCounter(nextZ);

            const idx = prev.length;
            const win: WindowState = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                appId: id,
                title: def.label,
                x: 220 + idx * 32,
                y: 80 + idx * 26,
                width: 560,
                height: 360,
                z: nextZ,
            };

            return [...prev, win];
        });
    };

    const closeWindow = (id: number) => {
        setWindows(prev => prev.filter(w => w.id !== id));
        setActiveId(prev => (prev === id ? null : prev));
    };

    const focusWindow = (id: number) => {
        const nextZ = zCounter + 1;
        setZCounter(nextZ);

        setWindows(prev =>
            prev.map(w => (w.id === id ? { ...w, z: nextZ } : w))
        );

        setActiveId(id);
    };

    const updateWindow = (
        id: number,
        patch: Partial<Pick<WindowState, "x" | "y" | "width" | "height">>
    ) => {
        setWindows(prev =>
            prev.map(w => (w.id === id ? { ...w, ...patch } : w))
        );
    };

    const ordered = useMemo(
        () => [...windows].sort((a, b) => a.z - b.z),
        [windows]
    );

    return (
        <div className="w-screen h-screen bg-black text-slate-100 flex flex-col relative overflow-hidden">

            <header className="relative z-10 h-10 px-4 flex items-center justify-between border-b border-red-900/70 bg-black/80 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="tracking-[0.28em] uppercase text-red-200/90">
                        redbyte os
                    </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center gap-4">
                    <span>session: dev-local</span>
                    <span>user: {user || "operator"}</span>
                    <span className="text-[10px] text-red-300/80 uppercase tracking-[0.18em]">
                        {layoutMode === "smart" ? "smartsnap" : "freeform"}
                    </span>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex">

                <aside className="w-64 border-r border-red-900/70 bg-black/80 backdrop-blur-sm p-4 flex flex-col gap-4">

                    <div>
                        <div className="text-[10px] uppercase tracking-[0.25em] text-red-300/80 mb-1">
                            workspace
                        </div>
                        <div className="text-xs text-slate-300">
                            pick a module to open its window.
                        </div>
                    </div>

                    <div className="space-y-2">
                        {OS_APPS.map(app => (
                            <button
                                key={app.id}
                                onClick={() => openApp(app.id)}
                                className="w-full rounded-xl border border-red-900/70 bg-black/70 hover:border-red-400/80 hover:bg-red-950/70 transition-colors px-3 py-2 text-left"
                            >
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-100">{app.label}</span>
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-red-300/80">
                                        open
                                    </span>
                                </div>
                                <div className="mt-1 text-[10px] text-slate-400">
                                    {app.hint}
                                </div>
                            </button>
                        ))}
                    </div>

                </aside>

                <section className="flex-1 relative overflow-hidden">
                    {windows.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="px-4 py-2 rounded-full border border-red-900/70 bg-black/80 text-[11px] text-slate-300">
                                open a module on the left to start a session
                            </div>
                        </div>
                    )}

                    <div className="absolute inset-0">
                        {ordered.map(w => {
                            const Component = loadApp(w.appId);
                            return (
                                <WindowFrame
                                    key={w.id}
                                    title={w.title}
                                    x={w.x}
                                    y={w.y}
                                    width={w.width}
                                    height={w.height}
                                    z={w.z}
                                    isActive={w.id === activeId}
                                    layoutMode={layoutMode as LayoutMode}
                                    gridSize={gridSize}
                                    onFocus={() => focusWindow(w.id)}
                                    onClose={() => closeWindow(w.id)}
                                    onChange={patch => updateWindow(w.id, patch)}
                                >
                                    <Component />
                                </WindowFrame>
                            );
                        })}
                    </div>
                </section>

            </main>

            <footer className="relative z-10 h-8 border-t border-red-900/70 bg-black/80 px-4 flex items-center justify-between text-[10px] text-slate-400">
                <span>© {new Date().getFullYear()} redbyte os • web prototype</span>
                <span>goal: full redstone-native desktop, shipped as .exe</span>
            </footer>

        </div>
    );
};

export default DesktopShell;
