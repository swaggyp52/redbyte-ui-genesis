import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '@redbyte/rb-utils';
import { Icon } from '@redbyte/rb-icons';
import { FileAssociationsPanel } from './settings/FileAssociationsPanel';
import { FilesystemDataPanel } from './settings/FilesystemDataPanel';
import { SessionPanel } from './settings/SessionPanel';
const WALLPAPERS = [
    { id: 'default', name: 'Gradient', description: 'Subtle dark gradient' },
    { id: 'redbyte-field', name: 'RedByte Field', description: 'Animated grid drift' },
    { id: 'neon-circuit', name: 'Deep', description: 'Solid dark surface' },
    { id: 'frost-grid', name: 'Grid', description: 'Faint blue gridlines' },
    { id: 'solid', name: 'Solid', description: 'Pure dark background' },
];
const SettingsComponent = ({ onClose }) => {
    const [selectedSection, setSelectedSection] = useState('appearance');
    const containerRef = useRef(null);
    const { themeVariant, wallpaperId, setThemeVariant, setWallpaperId, tickRate, setTickRate, reduceMotion, setReduceMotion, performanceMode, setPerformanceMode, density, setDensity, snapAssist, setSnapAssist, } = useSettingsStore();
    useEffect(() => {
        containerRef.current?.focus();
    }, []);
    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            onClose?.();
        }
    };
    return (_jsxs("div", { ref: containerRef, tabIndex: 0, onKeyDown: handleKeyDown, className: "h-full flex", style: { background: 'var(--rb-surface-0)', color: 'var(--rb-text)', outline: 'none' }, children: [_jsxs("div", { className: "w-52 flex flex-col", style: { background: 'var(--rb-surface-0)', borderRight: '1px solid var(--rb-border)' }, children: [_jsx("div", { className: "p-4", style: { borderBottom: '1px solid var(--rb-border)' }, children: _jsx("h2", { className: "text-base font-semibold tracking-wide", style: { color: 'var(--rb-text)' }, children: "Settings" }) }), _jsx("div", { className: "flex-1 overflow-y-auto p-2", children: [
                            { id: 'appearance', label: 'Appearance', icon: 'image' },
                            { id: 'system', label: 'System', icon: 'settings' },
                            { id: 'windowing', label: 'Windowing', icon: 'grid' },
                            { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' },
                            { id: 'files', label: 'File Associations', icon: 'files' },
                            { id: 'filesystem', label: 'Filesystem Data', icon: 'document' },
                            { id: 'session', label: 'Session', icon: 'power' },
                        ].map((item) => (_jsxs("button", { type: "button", onClick: () => setSelectedSection(item.id), className: "w-full text-left px-3 py-2 mb-0.5 text-sm rounded-md transition-colors", style: {
                                background: selectedSection === item.id ? 'var(--rb-accent-muted)' : 'transparent',
                                color: selectedSection === item.id ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                                border: selectedSection === item.id ? '1px solid var(--rb-accent-border)' : '1px solid transparent',
                            }, children: [_jsx("span", { className: "mr-2 inline-flex items-center", children: _jsx(Icon, { name: item.icon, size: 14 }) }), item.label] }, item.id))) })] }), _jsxs("div", { className: "flex-1 flex flex-col overflow-hidden", children: [_jsx("div", { className: "p-4", style: { borderBottom: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }, children: _jsx("h3", { className: "text-lg font-semibold", style: { color: 'var(--rb-text)' }, children: selectedSection === 'appearance'
                                ? 'Appearance'
                                : selectedSection === 'system'
                                    ? 'System'
                                    : selectedSection === 'windowing'
                                        ? 'Windowing'
                                        : selectedSection === 'shortcuts'
                                            ? 'Keyboard Shortcuts'
                                            : selectedSection === 'files'
                                                ? 'File Associations'
                                                : selectedSection === 'filesystem'
                                                    ? 'Filesystem Data'
                                                    : 'Session' }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6", children: [selectedSection === 'appearance' && (_jsxs("div", { className: "space-y-8 max-w-2xl", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold mb-4", style: { color: 'var(--rb-text)' }, children: "Theme" }), _jsx("div", { className: "grid grid-cols-3 gap-3", children: ([
                                                    { value: 'dark', label: 'Dark', desc: 'Default dark surface' },
                                                    { value: 'light', label: 'Light', desc: 'High-clarity light mode' },
                                                    { value: 'midnight', label: 'Midnight', desc: 'Deep blue-black' },
                                                ]).map((theme) => (_jsxs("button", { type: "button", onClick: () => setThemeVariant(theme.value), className: "p-4 rounded-lg transition-all text-left", style: {
                                                        border: themeVariant === theme.value
                                                            ? '2px solid var(--rb-accent)'
                                                            : '2px solid var(--rb-border)',
                                                        background: themeVariant === theme.value
                                                            ? 'var(--rb-accent-muted)'
                                                            : 'var(--rb-surface-1)',
                                                    }, children: [_jsx("div", { className: "font-semibold text-sm", style: { color: 'var(--rb-text)' }, children: theme.label }), _jsx("div", { className: "text-xs mt-1", style: { color: 'var(--rb-text-3)' }, children: theme.desc })] }, theme.value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold mb-4", style: { color: 'var(--rb-text)' }, children: "Density" }), _jsx("div", { className: "flex gap-3", children: [
                                                    { value: 'compact', label: 'Compact' },
                                                    { value: 'comfortable', label: 'Comfortable' },
                                                ].map((option) => (_jsx("button", { type: "button", onClick: () => setDensity(option.value), className: "px-4 py-2 rounded-md text-sm font-medium transition-colors", style: {
                                                        border: density === option.value
                                                            ? '1px solid var(--rb-accent)'
                                                            : '1px solid var(--rb-border)',
                                                        color: density === option.value ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                                                        background: density === option.value ? 'var(--rb-accent-muted)' : 'transparent',
                                                    }, children: option.label }, option.value))) }), _jsx("div", { className: "text-xs mt-2", style: { color: 'var(--rb-text-3)' }, children: "Adjusts spacing and panel density across the OS." })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold mb-3", style: { color: 'var(--rb-text)' }, children: "Motion" }), _jsxs("div", { className: "flex items-center justify-between rounded-lg px-4 py-3", style: { border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }, children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", style: { color: 'var(--rb-text)' }, children: "Reduce Motion" }), _jsx("div", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: "Disable non-essential animation" })] }), _jsx("button", { type: "button", onClick: () => setReduceMotion(!reduceMotion), className: "relative h-6 w-11 rounded-full transition-colors", style: { background: reduceMotion ? 'var(--rb-accent)' : 'var(--rb-surface-3)' }, "aria-label": "Toggle reduced motion", children: _jsx("span", { className: "absolute top-0.5 h-5 w-5 rounded-full transition-transform", style: {
                                                                background: 'var(--rb-surface-0)',
                                                                transform: reduceMotion ? 'translateX(20px)' : 'translateX(2px)',
                                                            } }) })] })] }), _jsxs("div", { className: "flex items-center justify-between rounded-lg px-4 py-3 mt-2", style: { border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }, children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium", style: { color: 'var(--rb-text)' }, children: "Performance Mode" }), _jsx("div", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: "Reduce rendering load (may disable 3D and throttle instruments)" })] }), _jsx("button", { type: "button", onClick: () => setPerformanceMode(!performanceMode), className: "relative h-6 w-11 rounded-full transition-colors", style: { background: performanceMode ? 'var(--rb-accent)' : 'var(--rb-surface-3)' }, "aria-label": "Toggle performance mode", children: _jsx("span", { className: "absolute top-0.5 h-5 w-5 rounded-full transition-transform", style: { background: 'var(--rb-surface-0)', transform: performanceMode ? 'translateX(20px)' : 'translateX(2px)' } }) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold mb-4", style: { color: 'var(--rb-text)' }, children: "Desktop Wallpaper" }), _jsx("div", { className: "grid grid-cols-2 gap-3", children: WALLPAPERS.map((wallpaper) => (_jsxs("button", { type: "button", onClick: () => setWallpaperId(wallpaper.id), className: "relative p-3 rounded-lg transition-all text-left overflow-hidden", style: {
                                                        border: wallpaperId === wallpaper.id
                                                            ? '2px solid var(--rb-accent)'
                                                            : '2px solid var(--rb-border)',
                                                        background: wallpaperId === wallpaper.id
                                                            ? 'var(--rb-accent-muted)'
                                                            : 'var(--rb-surface-1)',
                                                    }, children: [_jsx("div", { className: "h-20 mb-2 rounded overflow-hidden", style: { border: '1px solid var(--rb-border)' }, children: _jsx("div", { className: "h-full w-full", style: {
                                                                    background: wallpaper.id === 'default'
                                                                        ? 'linear-gradient(145deg, #09090B 0%, #18181B 50%, #09090B 100%)'
                                                                        : wallpaper.id === 'redbyte-field'
                                                                            ? 'linear-gradient(140deg, #09090B 0%, #111318 55%, #09090B 100%)'
                                                                            : wallpaper.id === 'frost-grid'
                                                                                ? `linear-gradient(rgba(59, 130, 246, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.02) 1px, transparent 1px), #09090B`
                                                                                : '#09090B',
                                                                    backgroundSize: wallpaper.id === 'frost-grid' ? '20px 20px' : undefined,
                                                                } }) }), _jsx("div", { className: "font-medium text-sm", style: { color: 'var(--rb-text)' }, children: wallpaper.name }), _jsx("div", { className: "text-xs mt-0.5", style: { color: 'var(--rb-text-3)' }, children: wallpaper.description }), wallpaperId === wallpaper.id && (_jsx("div", { className: "absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]", style: { background: 'var(--rb-accent)' }, children: "\u2713" }))] }, wallpaper.id))) })] })] })), selectedSection === 'system' && (_jsx("div", { className: "space-y-6 text-sm max-w-2xl", style: { color: 'var(--rb-text-2)' }, children: _jsx("div", { className: "p-5 rounded-lg", style: { background: 'var(--rb-surface-1)', border: '1px solid var(--rb-border)' }, children: _jsx("div", { className: "flex items-start gap-4", children: _jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "text-base font-semibold mb-2", style: { color: 'var(--rb-text)' }, children: "Simulation Timing" }), _jsx("p", { className: "mb-4", style: { color: 'var(--rb-text-3)' }, children: "Sets the default tick rate for new and live-running circuits." }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "range", min: 1, max: 60, value: tickRate, onChange: (e) => setTickRate(parseInt(e.target.value, 10)), className: "flex-1 h-1.5 rounded-lg appearance-none cursor-pointer", style: { background: 'var(--rb-surface-3)' }, "aria-label": "Simulation tick rate" }), _jsx("input", { type: "number", min: 1, max: 60, value: tickRate, onChange: (e) => setTickRate(parseInt(e.target.value, 10)), className: "w-16 px-2 py-1 rounded text-sm font-mono", style: {
                                                                background: 'var(--rb-surface-0)',
                                                                border: '1px solid var(--rb-border)',
                                                                color: 'var(--rb-text)',
                                                            }, "aria-label": "Simulation tick rate value" }), _jsx("span", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: "Hz" })] })] }) }) }) })), selectedSection === 'windowing' && (_jsx("div", { className: "space-y-6 text-sm max-w-2xl", style: { color: 'var(--rb-text-2)' }, children: _jsx("div", { className: "p-5 rounded-lg", style: { background: 'var(--rb-surface-1)', border: '1px solid var(--rb-border)' }, children: _jsx("div", { className: "flex items-start gap-4", children: _jsxs("div", { className: "flex-1 space-y-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-base font-semibold mb-2", style: { color: 'var(--rb-text)' }, children: "Snap Assist" }), _jsx("p", { style: { color: 'var(--rb-text-3)' }, children: "Controls edge snapping behavior while dragging windows." })] }), _jsx("div", { className: "flex flex-wrap gap-3", children: [
                                                        { value: 'off', label: 'Off', desc: 'No snap previews' },
                                                        { value: 'manual', label: 'Manual (Shift)', desc: 'Hold Shift to preview' },
                                                        { value: 'auto', label: 'Auto (Hover)', desc: 'Hover 250ms to preview' },
                                                    ].map((option) => (_jsxs("button", { type: "button", onClick: () => setSnapAssist(option.value), className: "px-4 py-2 rounded-md text-sm font-medium transition-colors", style: {
                                                            border: snapAssist === option.value
                                                                ? '1px solid var(--rb-accent)'
                                                                : '1px solid var(--rb-border)',
                                                            color: snapAssist === option.value ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                                                            background: snapAssist === option.value ? 'var(--rb-accent-muted)' : 'transparent',
                                                        }, children: [_jsx("div", { children: option.label }), _jsx("div", { className: "text-[10px] mt-1", style: { color: 'var(--rb-text-3)' }, children: option.desc })] }, option.value))) }), _jsx("div", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: "Snap previews only apply on release. Resizing never triggers snap." })] }) }) }) })), selectedSection === 'shortcuts' && (_jsxs("div", { className: "space-y-4 text-sm max-w-3xl", style: { color: 'var(--rb-text-2)' }, children: [_jsxs("div", { className: "rounded-lg p-4", style: { border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }, children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.2em] mb-3", style: { color: 'var(--rb-text-3)' }, children: "Global" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2", children: [
                                                    { keys: 'Ctrl/Cmd + K', label: 'Open Launcher' },
                                                    { keys: 'Ctrl/Cmd + ,', label: 'Open Settings' },
                                                    { keys: 'Ctrl/Cmd + Shift + P', label: 'Command Palette' },
                                                    { keys: 'Ctrl/Cmd + Space', label: 'System Search' },
                                                    { keys: 'Ctrl/Cmd + Tab', label: 'Window Switcher' },
                                                    { keys: 'Ctrl/Cmd + `', label: 'Cycle Windows' },
                                                    { keys: 'Ctrl/Cmd + W', label: 'Close Focused Window' },
                                                    { keys: 'Ctrl/Cmd + M', label: 'Minimize Focused Window' },
                                                    { keys: 'Ctrl/Cmd + Alt + Arrows', label: 'Snap Window' },
                                                    { keys: 'Shift + Drag (edge)', label: 'Snap Preview (Manual)' },
                                                ].map((shortcut) => (_jsxs("div", { className: "flex items-center justify-between rounded-md px-3 py-1.5", style: { background: 'var(--rb-surface-0)', border: '1px solid var(--rb-border)' }, children: [_jsx("span", { className: "text-xs font-mono", style: { color: 'var(--rb-text)' }, children: shortcut.keys }), _jsx("span", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: shortcut.label })] }, shortcut.label))) })] }), _jsxs("div", { className: "rounded-lg p-4", style: { border: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)' }, children: [_jsx("div", { className: "text-[10px] uppercase tracking-[0.2em] mb-3", style: { color: 'var(--rb-text-3)' }, children: "Files" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2", children: [
                                                    { keys: 'Alt + ← / →', label: 'Back / Forward' },
                                                    { keys: 'Ctrl/Cmd + N', label: 'New File' },
                                                    { keys: 'Ctrl/Cmd + Shift + N', label: 'New Folder' },
                                                    { keys: 'Ctrl/Cmd + Shift + Enter', label: 'Open With...' },
                                                    { keys: 'F2', label: 'Rename' },
                                                    { keys: 'Del', label: 'Delete' },
                                                ].map((shortcut) => (_jsxs("div", { className: "flex items-center justify-between rounded-md px-3 py-1.5", style: { background: 'var(--rb-surface-0)', border: '1px solid var(--rb-border)' }, children: [_jsx("span", { className: "text-xs font-mono", style: { color: 'var(--rb-text)' }, children: shortcut.keys }), _jsx("span", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: shortcut.label })] }, shortcut.label))) })] })] })), selectedSection === 'files' && (_jsx(FileAssociationsPanel, {})), selectedSection === 'filesystem' && (_jsx(FilesystemDataPanel, {})), selectedSection === 'session' && (_jsx(SessionPanel, {}))] }), _jsxs("div", { className: "p-3 text-xs", style: { borderTop: '1px solid var(--rb-border)', background: 'var(--rb-surface-1)', color: 'var(--rb-text-3)' }, children: [_jsx("kbd", { className: "px-2 py-0.5 rounded text-[10px]", style: { background: 'var(--rb-surface-0)', border: '1px solid var(--rb-border)' }, children: "Esc" }), " Close"] })] })] }));
};
export const SettingsApp = {
    manifest: {
        id: 'settings',
        name: 'Settings',
        iconId: 'settings',
        singleton: true,
        category: 'system',
        defaultSize: { width: 800, height: 600 },
        minSize: { width: 600, height: 500 },
    },
    component: SettingsComponent,
};
