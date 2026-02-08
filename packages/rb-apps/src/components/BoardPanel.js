import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * BoardPanel - Photorealistic hardware board visualization
 *
 * Renders stunning, interactive FPGA board visualizations with
 * authentic PCB aesthetics. Supports Basys3, Spartan-3E, and
 * falls back to GenericIOGrid for unknown boards.
 */
import React from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { hardwareClient } from '../services/hardwareClient';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { GenericIOGrid } from './GenericIOGrid';
import { Basys3Board } from './boards/Basys3Board';
import { Spartan3EBoard } from './boards/Spartan3EBoard';
import { useRenderStormDetector } from '../hooks/useRenderStormDetector';
// Helper: robust device ID extraction
const getDeviceKey = (d) => d.deviceId ?? d.id ?? '';
export const BoardPanel = ({ className = '', snapshot: propSnapshot, capabilities: propCapabilities, onInteraction, readOnly = false, compact = false, executionSource = 'sim', }) => {
    useRenderStormDetector('BoardPanel');
    const connectionState = useHardwareStore((s) => s.connectionState);
    const storeCapabilities = useHardwareStore((s) => s.capabilities);
    const capabilities = propCapabilities ?? storeCapabilities;
    const storeSnapshot = useHardwareStore((s) => s.ioSnapshot);
    const ioSnapshot = propSnapshot ?? storeSnapshot;
    const availableDevices = useHardwareStore((s) => s.availableDevices);
    const activeDevice = useHardwareStore((s) => s.activeDevice);
    const runState = useHardwareStore((s) => s.runState);
    const lastError = useHardwareStore((s) => s.lastError);
    const connect = useHardwareStore((s) => s.connect);
    const selectDevice = useHardwareStore((s) => s.selectDevice);
    const isRecording = useHardwareStore((s) => s.isRecording);
    const traceBuffer = useHardwareStore((s) => s.traceBuffer);
    const startRecording = useHardwareStore((s) => s.startRecording);
    const stopRecording = useHardwareStore((s) => s.stopRecording);
    const exportV2Bundle = useHardwareStore((s) => s.exportV2Bundle);
    const clearTrace = useHardwareStore((s) => s.clearTrace);
    const handleSetOutput = async (signal, value) => {
        await hardwareClient.setOutputs({ [signal]: value });
    };
    const handleSelectDevice = async (deviceId) => {
        await selectDevice(deviceId);
    };
    const handleExport = async () => {
        try {
            const blob = await exportV2Bundle({ studentName: 'Student' }); // TODO: Get actual name
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `redbyte_trace_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
        catch (e) {
            console.error('Export failed:', e);
            alert('Failed to export trace. See console for details.');
        }
    };
    // Render board visualization based on capabilities
    const renderBoardLayout = () => {
        if (!capabilities) {
            return (_jsx("div", { className: "flex-1 flex items-center justify-center", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "w-20 h-20 mx-auto mb-4 rounded-lg opacity-20", style: {
                                background: 'linear-gradient(135deg, #1a3a2a 0%, #0a1a10 100%)',
                                border: '2px dashed #2a4a3a',
                            } }), _jsx("div", { className: "text-sm text-gray-500 font-medium", children: "No Board Connected" }), _jsx("div", { className: "text-xs text-gray-600 mt-1", children: "Connect hardware or select a simulation" })] }) }));
        }
        const boardId = capabilities.boardId.toLowerCase();
        const scale = compact ? 0.8 : 1;
        // Basys3 - Photorealistic green PCB
        if (boardId === 'basys3' || boardId.includes('basys')) {
            return (_jsx("div", { className: "flex-1 flex items-center justify-center p-4 overflow-auto", children: _jsx(Basys3Board, { ioSnapshot: ioSnapshot, onInteraction: onInteraction, readOnly: readOnly, scale: scale }) }));
        }
        // Spartan-3E - Red PCB with LCD
        if (boardId === 'spartan3e-starter' || boardId.includes('spartan')) {
            return (_jsx("div", { className: "flex-1 flex items-center justify-center p-4 overflow-auto", children: _jsx(Spartan3EBoard, { ioSnapshot: ioSnapshot, onInteraction: onInteraction, readOnly: readOnly, scale: scale }) }));
        }
        // Generic fallback
        return (_jsx("div", { className: "flex-1 overflow-auto p-4", children: _jsx(GenericIOGrid, { inputs: capabilities.inputs, outputs: capabilities.outputs, ioSnapshot: ioSnapshot, onSetOutput: handleSetOutput, readOnly: readOnly }) }));
    };
    // --- PAN/ZOOM STATE ---
    const [transform, setTransform] = React.useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragStart = React.useRef({ x: 0, y: 0 });
    const handleWheel = (e) => {
        // Zoom
        e.stopPropagation();
        const delta = -e.deltaY * 0.001;
        setTransform(prev => ({
            ...prev,
            scale: Math.min(2, Math.max(0.5, prev.scale + delta))
        }));
    };
    const handleMouseDown = (e) => {
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement)
            return;
        // Only drag on background
        setIsDragging(true);
        dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    };
    const handleMouseMove = (e) => {
        if (!isDragging)
            return;
        setTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        }));
    };
    const handleMouseUp = () => setIsDragging(false);
    const handleReset = () => setTransform({ x: 0, y: 0, scale: 1 });
    return (_jsxs("div", { className: `flex flex-col h-full ${className}`, style: {
            background: 'linear-gradient(180deg, #0a0f14 0%, #050810 100%)',
        }, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-2", style: {
                    background: 'linear-gradient(180deg, #1a1f24 0%, #10151a 100%)',
                    borderBottom: '1px solid #2a3540',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }, children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider", style: {
                                    background: 'linear-gradient(180deg, #2a3a2a 0%, #1a2a1a 100%)',
                                    border: '1px solid #3a4a3a',
                                    color: '#8a9a8a',
                                }, children: "FPGA DEV" }), _jsx(ConnectionStatusBadge, { state: connectionState })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { type: "button", onClick: () => isRecording ? stopRecording() : startRecording(), disabled: connectionState !== 'ready', className: `px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all flex items-center gap-1 ${isRecording
                                    ? 'bg-red-900/50 text-red-400 border border-red-800 hover:bg-red-900'
                                    : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-red-500'}` }), isRecording ? 'STOP' : 'REC'] }), _jsx("button", { type: "button", onClick: handleExport, disabled: isRecording || traceBuffer.length === 0, className: "px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all bg-gray-800 text-cyan-400 border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed", title: traceBuffer.length === 0 ? "Record trace to export" : "Export V2 Bundle", children: "EXPORT" }), traceBuffer.length > 0 && !isRecording && (_jsx("button", { type: "button", onClick: () => clearTrace(), className: "px-2 py-1 text-[10px] font-bold tracking-wider rounded transition-all text-gray-500 hover:text-gray-300", children: "CLEAR" }))] }), executionSource === 'hardware' && connectionState === 'disconnected' && (_jsx("button", { type: "button", onClick: () => connect(), className: "px-3 py-1 text-[10px] font-bold tracking-wider rounded transition-all", style: {
                            background: 'linear-gradient(180deg, #1a4a3a 0%, #0a3a2a 100%)',
                            border: '1px solid #2a5a4a',
                            color: '#4ade80',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                        }, children: "CONNECT" })), executionSource === 'sim' && (_jsx("span", { className: "text-[9px] font-medium text-emerald-500/80 tracking-wide", children: "SIM \u2014 click board to interact" })), executionSource === 'replay' && (_jsx("span", { className: "text-[9px] font-medium text-amber-500/80 tracking-wide", children: "REPLAY \u2014 use scrubber" }))] }), lastError && (_jsxs("div", { className: "px-4 py-2 text-xs flex items-center gap-2", style: {
                    background: 'linear-gradient(90deg, #3a1a1a 0%, #2a1010 100%)',
                    borderBottom: '1px solid #4a2a2a',
                }, children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-red-500" }), _jsx("span", { className: "text-red-400", children: lastError })] })), executionSource === 'hardware' && connectionState === 'ready' && availableDevices.length === 0 && (_jsxs("div", { className: "p-4", style: {
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: '1px solid #2a3540',
                }, children: [_jsx("div", { className: "text-[10px] font-bold tracking-wider text-amber-500/80 mb-1", children: "NO DEVICES FOUND" }), _jsxs("div", { className: "text-[9px] text-gray-500", children: ["Start bridge with ", _jsx("code", { className: "text-cyan-400/80 bg-black/30 px-1 rounded", children: "RB_FPGA_MOCK=1" }), " for mock Basys3"] })] })), runState.status === 'running_no_data' && (_jsxs("div", { className: "px-4 py-2 bg-amber-900/40 border-b border-amber-800/50 flex items-center gap-2", children: [_jsx("span", { className: "text-amber-400 text-xs font-bold", children: "NO DATA" }), _jsx("span", { className: "text-amber-200/80 text-[10px]", children: runState.hint || "FPGA is running but not sending data. Check wrapper instantiation." })] })), connectionState === 'ready' && !activeDevice && availableDevices.length > 0 && (_jsxs("div", { className: "p-4", style: {
                    background: 'rgba(0,0,0,0.3)',
                    borderBottom: '1px solid #2a3540',
                }, children: [_jsx("div", { className: "text-[10px] font-bold tracking-wider text-gray-500 mb-2", children: "SELECT DEVICE" }), _jsx("div", { className: "flex flex-col gap-2", children: availableDevices.map((device) => {
                            const id = getDeviceKey(device);
                            return (_jsxs("button", { type: "button", onClick: () => handleSelectDevice(id), className: "px-3 py-2 text-left rounded transition-all hover:brightness-110", style: {
                                    background: 'linear-gradient(180deg, #1a2a1a 0%, #0a1a0a 100%)',
                                    border: '1px solid #2a3a2a',
                                }, children: [_jsx("div", { className: "text-sm text-gray-200", children: device.boardModel || 'Unknown' }), _jsx("div", { className: "text-[10px] text-gray-500 font-mono", children: device.serial || id })] }, id));
                        }) })] })), capabilities && (_jsxs("div", { className: "px-4 py-1.5 flex items-center justify-between text-[10px]", style: {
                    background: 'rgba(0,0,0,0.2)',
                    borderBottom: '1px solid #1a2530',
                }, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-bold text-gray-300", children: capabilities.boardName }), capabilities.manufacturer && (_jsxs("span", { className: "text-gray-600", children: ["by ", capabilities.manufacturer] }))] }), capabilities.clock && (_jsxs("span", { className: "font-mono text-gray-600", children: [(capabilities.clock.frequencyHz / 1e6).toFixed(0), "MHz"] }))] })), _jsxs("div", { className: "flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing", onWheel: handleWheel, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, children: [_jsx("div", { className: "absolute inset-0 pointer-events-none", style: {
                            background: capabilities
                                ? 'radial-gradient(circle at 50% 50%, rgba(0,100,50,0.05) 0%, transparent 70%)'
                                : 'none',
                        } }), _jsx("div", { style: {
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transformOrigin: 'center',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }, children: renderBoardLayout() }), _jsx("div", { className: "absolute bottom-4 right-4 flex flex-col gap-1", children: _jsx("button", { onClick: handleReset, className: "bg-gray-800 text-gray-300 w-6 h-6 rounded flex items-center justify-center border border-gray-700 hover:bg-gray-700 text-xs", title: "Reset View", children: "\u27F2" }) })] }), isRecording && (_jsxs("div", { className: "px-4 py-2 flex items-center gap-2", style: {
                    background: 'linear-gradient(90deg, #3a1a1a 0%, #2a1010 100%)',
                    borderTop: '1px solid #4a2a2a',
                }, children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-red-500 animate-pulse" }), _jsx("span", { className: "text-xs text-red-400 font-medium", children: "REC" }), _jsx("span", { className: "text-[10px] text-red-400/60 font-mono", children: "Recording trace..." })] })), _jsxs("div", { className: "px-4 py-1 flex items-center justify-between text-[9px] font-mono", style: {
                    background: '#050810',
                    borderTop: '1px solid #1a2530',
                }, children: [_jsx("span", { className: "text-gray-600", children: connectionState === 'ready' ? 'ONLINE' : connectionState.toUpperCase() }), ioSnapshot?.tick !== undefined && (_jsxs("span", { className: "text-cyan-600", children: ["T:", ioSnapshot.tick] }))] })] }));
};
export default BoardPanel;
