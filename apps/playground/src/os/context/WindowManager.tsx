import React, { createContext, useContext, useState, ReactNode } from "react";

export interface WindowState {
    id: number;
    appId: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z: number;
}

interface WindowManagerContextType {
    windows: WindowState[];
    activeId: number | null;
    openWindow: (win: Omit<WindowState, "id" | "z">) => number;
    closeWindow: (id: number) => void;
    bringToFront: (id: number) => void;
    updateWindow: (id: number, patch: Partial<WindowState>) => void;
}

const WindowManagerContext = createContext<WindowManagerContextType | null>(null);

export function useWindowManager() {
    const ctx = useContext(WindowManagerContext);
    if (!ctx) throw new Error("WindowManagerContext missing");
    return ctx;
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
    const [windows, setWindows] = useState<WindowState[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [zCounter, setZCounter] = useState(1);

    const openWindow = (win: Omit<WindowState, "id" | "z">) => {
        const id = Date.now() + Math.floor(Math.random() * 999999);
        const newZ = zCounter + 1;
        setZCounter(newZ);

        setWindows(prev => [
            ...prev,
            { ...win, id, z: newZ }
        ]);

        setActiveId(id);
        return id;
    };

    const closeWindow = (id: number) => {
        setWindows(prev => prev.filter(w => w.id !== id));
        setActiveId(prev => (prev === id ? null : prev));
    };

    const bringToFront = (id: number) => {
        const newZ = zCounter + 1;
        setZCounter(newZ);
        setWindows(prev =>
            prev.map(w => (w.id === id ? { ...w, z: newZ } : w))
        );
        setActiveId(id);
    };

    const updateWindow = (id: number, patch: Partial<WindowState>) => {
        setWindows(prev =>
            prev.map(w => (w.id === id ? { ...w, ...patch } : w))
        );
    };

    return (
        <WindowManagerContext.Provider
            value={{
                windows,
                activeId,
                openWindow,
                closeWindow,
                bringToFront,
                updateWindow
            }}
        >
            {children}
        </WindowManagerContext.Provider>
    );
}
