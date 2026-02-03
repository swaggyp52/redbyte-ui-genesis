import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useMemo, memo } from 'react';
/**
 * Truth Bar / Evidence Bar — Always-visible determinism + evidence status
 *
 * This is the soul of RedByte: determinism isn't a debug feature,
 * it's the physics of the world. Every circuit, every tick, every state
 * is hashable, reproducible, and provable.
 *
 * Two-row layout:
 * Row 1: Mode indicator, tick counter, event count, save state
 * Row 2: Recording status, proof status, action buttons
 */
const TruthBarComponent = memo(({ mode, tickCount, totalEvents, hashPrefix, canRecord, onToggleRecording, onVerify, verificationStatus, onOpenPanel, saveState = 'never', lastSaveLabel, hasProofPack = false, onExportProof, recordingEventCount = 0, }) => {
    // Draggable state
    const [position, setPosition] = React.useState({ x: 16, y: window.innerHeight - 64 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStartRef = React.useRef(null);
    const initialPosRef = React.useRef(null);
    const handlePointerDown = (e) => {
        // Only drag from the container background or drag handle
        const target = e.target;
        if (target.closest('button'))
            return; // Check if click is on a button
        e.preventDefault();
        target.setPointerCapture(e.pointerId);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialPosRef.current = { ...position };
        setIsDragging(true);
    };
    const handlePointerMove = (e) => {
        if (!isDragging || !dragStartRef.current || !initialPosRef.current)
            return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPosition({
            x: initialPosRef.current.x + dx,
            y: initialPosRef.current.y + dy,
        });
    };
    const handlePointerUp = (e) => {
        setIsDragging(false);
        dragStartRef.current = null;
        initialPosRef.current = null;
        const target = e.target;
        target.releasePointerCapture(e.pointerId);
    };
    // Ensure initial position is at bottom left on mount/resize
    React.useEffect(() => {
        const handleResize = () => {
            setPosition(prev => ({
                x: Math.min(prev.x, window.innerWidth - 100),
                y: Math.min(prev.y, window.innerHeight - 50)
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const modeConfig = useMemo(() => {
        switch (mode) {
            case 'recording':
                return {
                    label: 'REC',
                    color: 'text-red-400',
                    bg: 'bg-red-500/20',
                    border: 'border-red-500/50',
                    pulse: true,
                };
            case 'replay':
                return {
                    label: 'REPLAY',
                    color: 'text-purple-400',
                    bg: 'bg-purple-500/20',
                    border: 'border-purple-500/50',
                    pulse: false,
                };
            default:
                return {
                    label: 'LIVE',
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-500/20',
                    border: 'border-emerald-500/50',
                    pulse: false,
                };
        }
    }, [mode]);
    const verifyConfig = useMemo(() => {
        switch (verificationStatus) {
            case 'pass':
                return { icon: '\u2713', color: 'text-green-400', title: 'Deterministic - hashes match' };
            case 'fail':
                return { icon: '\u2717', color: 'text-red-400', title: 'Diverged - hashes differ' };
            default:
                return null;
        }
    }, [verificationStatus]);
    const saveLabelText = lastSaveLabel ?? (saveState === 'never' ? 'Never saved' : saveState === 'saved' ? 'Saved' : 'Unsaved');
    const recordingText = mode === 'recording' ? `Recording (${recordingEventCount})` : null;
    return (_jsx("div", { className: "fixed z-50 select-none", style: {
            left: position.x,
            top: position.y,
            touchAction: 'none',
        }, onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, children: _jsxs("div", { className: `flex items-center gap-3 px-3 py-2 rounded-full border shadow-lg backdrop-blur-md transition-shadow cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-xl scale-[1.02]' : 'shadow-md'}`, style: {
                background: 'var(--rb-surface-0)',
                borderColor: 'var(--rb-border-strong)',
                opacity: 0.98
            }, children: [_jsxs("div", { className: "flex flex-col gap-0.5 px-0.5 opacity-30", children: [_jsx("div", { className: "w-0.5 h-0.5 bg-slate-400 rounded-full" }), _jsx("div", { className: "w-0.5 h-0.5 bg-slate-400 rounded-full" }), _jsx("div", { className: "w-0.5 h-0.5 bg-slate-400 rounded-full" })] }), _jsxs("div", { className: `flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${modeConfig.bg} ${modeConfig.border} border ${modeConfig.color}`, children: [modeConfig.pulse && (_jsx("span", { className: "w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" })), _jsx("span", { children: modeConfig.label })] }), _jsxs("div", { className: "flex items-center gap-1.5 text-xs text-slate-400 font-mono border-r border-slate-700/50 pr-3", children: [_jsx("span", { className: "text-slate-500", children: "T:" }), _jsx("span", { className: "text-cyan-400 font-semibold tabular-nums", children: tickCount.toString().padStart(5, '0') }), mode === 'replay' && totalEvents !== undefined && (_jsxs("span", { className: "text-[10px] text-slate-500", children: ["/", totalEvents] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [recordingText && (_jsx("span", { className: "text-[10px] text-red-400 font-mono animate-pulse", children: recordingText })), saveState !== 'never' && !recordingText && (_jsx("span", { className: "text-[10px] text-slate-500 font-mono hidden sm:inline", children: saveLabelText })), verifyConfig && (_jsxs("div", { className: `flex items-center gap-1 text-[10px] font-bold ${verifyConfig.color} bg-slate-800/50 px-1.5 py-0.5 rounded`, title: verifyConfig.title, children: [_jsx("span", { children: verifyConfig.icon }), _jsx("span", { className: "hidden xs:inline", children: verificationStatus === 'pass' ? 'PROVEN' : 'DIVERGED' })] })), _jsxs("div", { className: "flex items-center gap-1.5 pl-1 border-l border-slate-700/50 ml-1", children: [_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); onToggleRecording(); }, disabled: !canRecord && mode !== 'recording', className: `w-7 h-7 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-slate-900 ${mode === 'recording'
                                        ? 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500'
                                        : canRecord
                                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white focus:ring-cyan-500'
                                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`, title: mode === 'recording' ? 'Stop Recording' : canRecord ? 'Start Recording' : 'Open a circuit first', children: _jsx("div", { className: `w-2.5 h-2.5 rounded-full ${mode === 'recording' ? 'bg-white rounded-sm' : 'bg-red-500'}` }) }), mode !== 'recording' && onVerify && (_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); onVerify(); }, className: "h-7 px-2.5 flex items-center justify-center rounded-full text-[10px] font-bold bg-blue-600/80 hover:bg-blue-500 text-white transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-blue-500", title: "Verify determinism via replay", children: "VERIFY" })), onExportProof && canRecord && mode === 'live' && (_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); onExportProof(); }, className: "h-7 px-2.5 flex items-center justify-center rounded-full text-[10px] font-bold bg-emerald-600/80 hover:bg-emerald-500 text-white transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-emerald-500", title: hasProofPack ? 'Export proof pack' : 'Export project', children: hasProofPack ? 'EXPORT PROOF' : 'EXPORT' })), onOpenPanel && (_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); onOpenPanel(); }, className: "w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-cyan-500", title: "Open Determinism Panel", children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: _jsx("path", { d: "M2 5L7 10L12 5", strokeLinecap: "round", strokeLinejoin: "round" }) }) }))] })] })] }) }));
});
export const TruthBar = TruthBarComponent;
