import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { useRunRecorderStore } from '../stores/runRecorderStore';
import { decodeRunRecord } from '../recording/runRecord';
import { isProofPack } from '../recording/proofPack';
import { buildCircuitSummary, compareCircuitSummary, buildMismatchEntries, positionFromTick, tickFromPosition, } from '../recording/runRecordUtils';
export const RunRecorderPanel = ({ circuit, isRunning, currentTick, tickRate, onArm, onStartRecording, onStopRecording, onStartReplay, onStopReplay, onPauseReplay, onResumeReplay, onStepReplay, onJumpReplay, onVerify, onExport, onExportProof, onRecordProof, onFocusTarget, onMismatchSelect, onImportProofPack, }) => {
    const mode = useRunRecorderStore((state) => state.mode);
    const stimulus = useRunRecorderStore((state) => state.stimulus);
    const trace = useRunRecorderStore((state) => state.trace);
    const record = useRunRecorderStore((state) => state.record);
    const verificationStatus = useRunRecorderStore((state) => state.verificationStatus);
    const playheadTick = useRunRecorderStore((state) => state.playheadTick);
    const replayPaused = useRunRecorderStore((state) => state.replayPaused);
    const setPlayheadTick = useRunRecorderStore((state) => state.setPlayheadTick);
    const setRecord = useRunRecorderStore((state) => state.setRecord);
    const applyEditedEvents = useRunRecorderStore((state) => state.applyEditedEvents);
    const normalizeEvents = useRunRecorderStore((state) => state.normalizeEvents);
    const [importError, setImportError] = React.useState(null);
    const [draggedIndex, setDraggedIndex] = React.useState(null);
    const [dragOverIndex, setDragOverIndex] = React.useState(null);
    const [selectedEventIndex, setSelectedEventIndex] = React.useState(null);
    const [isScrubbing, setIsScrubbing] = React.useState(false);
    const [showProofGuide, setShowProofGuide] = React.useState(false);
    const timelineRef = React.useRef(null);
    const events = record ? record.stimulus : stimulus;
    const traceSampleCount = record ? record.trace.length : trace.length;
    const TRACE_WARN_THRESHOLD = 20000;
    const showTraceWarning = traceSampleCount > TRACE_WARN_THRESHOLD;
    const durationTicks = record?.summary.durationTicks ?? record?.summary.tickCount ?? 0;
    const startTick = record?.summary.startTick ?? 0;
    const maxTick = Math.max(durationTicks, 1);
    const compatibility = React.useMemo(() => {
        if (!record || !record.circuitSummary)
            return null;
        return compareCircuitSummary(buildCircuitSummary(circuit), record.circuitSummary);
    }, [circuit, record]);
    const handleImport = (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const text = String(reader.result ?? '');
                const raw = JSON.parse(text);
                if (isProofPack(raw)) {
                    setRecord(raw.runRecord);
                    onImportProofPack(raw);
                    setImportError(null);
                    return;
                }
                const parsed = decodeRunRecord(text);
                setRecord(parsed);
                setImportError(null);
            }
            catch (error) {
                setImportError(error instanceof Error ? error.message : 'Import failed');
            }
        };
        reader.readAsText(file);
    };
    const scrubToClientX = React.useCallback((clientX) => {
        if (!record || !replayPaused || !timelineRef.current)
            return;
        const rect = timelineRef.current.getBoundingClientRect();
        if (rect.width <= 0)
            return;
        const tick = tickFromPosition(clientX - rect.left, rect.width, durationTicks);
        setPlayheadTick(tick);
    }, [record, replayPaused, durationTicks, setPlayheadTick]);
    React.useEffect(() => {
        if (!isScrubbing)
            return;
        const handleMove = (event) => scrubToClientX(event.clientX);
        const handleUp = () => setIsScrubbing(false);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [isScrubbing, scrubToClientX]);
    const handleEventUpdate = (index, updates) => {
        if (!record)
            return;
        const next = [...events];
        next[index] = { ...next[index], ...updates };
        applyEditedEvents(next);
    };
    const handleEventDelete = (index) => {
        if (!record)
            return;
        const next = [...events];
        next.splice(index, 1);
        applyEditedEvents(next);
    };
    const handleEventDrop = (fromIndex, toIndex) => {
        if (!record)
            return;
        if (fromIndex === toIndex)
            return;
        const next = [...events];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        applyEditedEvents(next);
    };
    const statusLabel = mode === 'recording'
        ? 'Recording'
        : mode === 'replaying'
            ? 'Replaying'
            : mode === 'armed'
                ? 'Armed'
                : 'Idle';
    const handleRecordProof = () => {
        onRecordProof();
        setShowProofGuide(true);
        window.setTimeout(() => setShowProofGuide(false), 2500);
    };
    return (_jsxs("div", { className: "p-4 text-sm space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-gray-400", children: "Trace Explorer" }), _jsx("div", { className: "text-xs text-cyan-300 font-mono", children: statusLabel })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs text-gray-300", children: [_jsxs("div", { className: "flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1", children: [_jsx("span", { children: "Tick" }), _jsx("span", { className: "font-mono", children: currentTick })] }), _jsxs("div", { className: "flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1", children: [_jsx("span", { children: "Rate" }), _jsxs("span", { className: "font-mono", children: [tickRate, "Hz"] })] }), _jsxs("div", { className: "flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1", children: [_jsx("span", { children: "Sim" }), _jsx("span", { className: `font-mono ${isRunning ? 'text-green-400' : 'text-gray-400'}`, children: isRunning ? 'Running' : 'Paused' })] }), _jsxs("div", { className: "flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1", children: [_jsx("span", { children: "Events" }), _jsx("span", { className: "font-mono", children: events.length })] }), _jsxs("div", { className: "flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded px-2 py-1", children: [_jsx("span", { children: "t = tick / rate" }), _jsx("span", { className: "font-mono", children: tickRate > 0 ? `1/${tickRate}s` : '-' })] })] }), showTraceWarning && (_jsxs("div", { className: "rounded border border-amber-500/40 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-200", children: ["Large trace buffer: ", traceSampleCount, " samples. Stop recording to cap memory usage."] })), _jsxs("div", { className: "grid grid-cols-4 gap-2 text-[11px]", children: [_jsx("button", { onClick: onArm, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", children: "Arm" }), _jsx("button", { onClick: mode === 'recording' ? onStopRecording : onStartRecording, className: `px-2 py-1 rounded border ${mode === 'recording'
                            ? 'bg-red-700/30 border-red-500 text-red-200'
                            : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'}`, type: "button", children: mode === 'recording' ? 'Stop' : 'Record' }), _jsx("button", { onClick: handleRecordProof, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", children: "Record Proof" }), _jsx("button", { onClick: mode === 'replaying' ? onStopReplay : onStartReplay, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record, children: mode === 'replaying' ? 'Stop' : 'Replay' }), _jsx("button", { onClick: replayPaused ? onResumeReplay : onPauseReplay, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: mode !== 'replaying', children: replayPaused ? 'Resume' : 'Pause' }), _jsx("button", { onClick: () => onStepReplay(1), className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: mode !== 'replaying' || !replayPaused, children: "Step" }), _jsx("button", { onClick: () => onStepReplay(10), className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: mode !== 'replaying' || !replayPaused, children: "Step 10" }), _jsx("button", { onClick: () => onJumpReplay(0), className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record, children: "Jump Start" }), _jsx("button", { onClick: () => onJumpReplay(durationTicks), className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record, children: "Jump End" })] }), showProofGuide && (_jsx("div", { className: "text-[10px] text-cyan-300", children: "Toggle inputs, then stop to capture a proof." })), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsx("button", { onClick: onVerify, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record, children: "Verify" }), _jsx("button", { onClick: onExport, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record, children: "Export" }), _jsx("button", { onClick: onExportProof, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record, children: "Export Proof" }), _jsxs("label", { className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200 text-center cursor-pointer", children: ["Import", _jsx("input", { type: "file", accept: ".json", onChange: handleImport, className: "hidden" })] }), _jsx("button", { onClick: normalizeEvents, className: "px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-200", type: "button", disabled: !record || events.length === 0, children: "Normalize" })] }), importError && (_jsx("div", { className: "text-[10px] text-red-400 bg-red-900/20 border border-red-700/40 rounded px-2 py-1", children: importError })), record && (_jsxs("div", { className: "text-[10px] text-gray-400 bg-gray-800/40 border border-gray-700 rounded px-2 py-1", children: ["Recorded ", record.trace.length, " samples over ", record.summary.durationTicks ?? record.summary.tickCount, " ticks.", compatibility && (_jsxs("span", { className: "ml-2 text-gray-500", children: ["Compat: ", compatibility] }))] })), _jsxs("div", { children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-gray-400 mb-2", children: "Run Timeline" }), _jsxs("div", { ref: timelineRef, className: `relative h-12 bg-gray-900/70 border border-gray-700 rounded ${replayPaused ? 'cursor-pointer' : 'cursor-not-allowed'}`, onMouseDown: (event) => {
                            if (!record || !replayPaused)
                                return;
                            setIsScrubbing(true);
                            scrubToClientX(event.clientX);
                        }, onClick: (event) => {
                            if (!record || !replayPaused)
                                return;
                            scrubToClientX(event.clientX);
                        }, children: [events.map((event, index) => {
                                const left = (positionFromTick(event.tick, 100, maxTick) / 100) * 100;
                                return (_jsx("div", { className: "absolute top-2 h-6 w-1 bg-cyan-400/70", style: { left: `${left}%` } }, `${event.nodeId}-${event.portName}-${event.tick}-${index}`));
                            }), _jsx("div", { className: "absolute top-0 bottom-0 w-px bg-cyan-300", style: { left: `${(positionFromTick(playheadTick, 100, maxTick) / 100) * 100}%` } }), _jsxs("div", { className: "absolute bottom-1 left-2 text-[10px] text-gray-400", children: ["start t", startTick, " \u2022 duration ", durationTicks, " ticks"] }), _jsxs("div", { className: "absolute bottom-1 right-2 text-[10px] text-cyan-300 font-mono", children: ["playhead t", playheadTick] })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-gray-400", children: "Stimulus Events" }), _jsx("div", { className: "text-[10px] text-gray-500", children: "click to focus" })] }), events.length === 0 ? (_jsx("div", { className: "text-[10px] text-gray-500", children: "No events recorded yet." })) : (_jsx("div", { className: "space-y-1", children: events.map((event, index) => (_jsxs("div", { draggable: !!record, onDragStart: () => setDraggedIndex(index), onDragEnd: () => {
                                setDraggedIndex(null);
                                setDragOverIndex(null);
                            }, onDragOver: (e) => {
                                if (!record)
                                    return;
                                e.preventDefault();
                                setDragOverIndex(index);
                            }, onDragLeave: () => setDragOverIndex(null), onDrop: (e) => {
                                e.preventDefault();
                                if (!record || draggedIndex === null)
                                    return;
                                handleEventDrop(draggedIndex, index);
                                setDraggedIndex(null);
                                setDragOverIndex(null);
                            }, onClick: () => {
                                setSelectedEventIndex(index);
                                onFocusTarget(event.nodeId, event.portName);
                            }, className: `flex items-center gap-2 bg-gray-800/40 border rounded px-2 py-1 text-[10px] cursor-pointer ${dragOverIndex === index
                                ? 'border-cyan-500 bg-cyan-900/20'
                                : selectedEventIndex === index
                                    ? 'border-cyan-500/60 bg-cyan-900/10'
                                    : 'border-gray-700'}`, children: [_jsx("div", { className: "flex flex-col items-center text-gray-500 cursor-grab", children: _jsx("span", { children: "\u2022\u2022" }) }), _jsx("input", { type: "number", value: event.tick, disabled: !record, onChange: (e) => handleEventUpdate(index, { tick: Math.max(0, Number(e.target.value)) }), className: "w-14 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px] font-mono", "aria-label": "Event tick number" }), _jsx("input", { type: "text", value: event.label ?? '', disabled: !record, onChange: (e) => handleEventUpdate(index, { label: e.target.value }), className: "flex-1 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px]", placeholder: `${event.nodeId}.${event.portName}`, "aria-label": "Event label" }), _jsxs("div", { className: "font-mono text-gray-300", children: [event.nodeId, ".", event.portName] }), _jsx("div", { className: "px-2 py-0.5 rounded bg-gray-700 text-gray-200 font-mono", children: event.value }), _jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        handleEventDelete(index);
                                    }, className: "text-gray-400 hover:text-red-300", title: "Delete event", type: "button", disabled: !record, children: "A-" })] }, `${event.nodeId}-${event.portName}-${event.tick}-${index}`))) }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("div", { className: "text-xs uppercase tracking-wide text-gray-400", children: "Verification" }), verificationStatus.status !== 'unknown' && (_jsx("div", { className: `text-[10px] px-2 py-0.5 rounded border ${verificationStatus.status === 'pass'
                                    ? 'bg-green-900/20 border-green-700 text-green-300'
                                    : 'bg-red-900/20 border-red-700 text-red-300'}`, children: verificationStatus.status === 'pass'
                                    ? '✅ VERIFIED'
                                    : `❌ MISMATCH t${verificationStatus.mismatch?.tick ?? '-'}` }))] }), verificationStatus.status === 'fail' && verificationStatus.mismatch && (_jsxs("div", { className: "space-y-2 text-[10px] bg-gray-900/40 border border-gray-700 rounded px-2 py-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-gray-300", children: ["Divergence at tick ", verificationStatus.mismatch.tick] }), _jsx("button", { onClick: () => {
                                            onPauseReplay();
                                            onJumpReplay(verificationStatus.mismatch?.tick ?? 0);
                                            const firstProbe = record?.probes.find((probe) => verificationStatus.mismatch?.probeIds.includes(probe.id));
                                            if (firstProbe) {
                                                onFocusTarget(firstProbe.nodeId, firstProbe.portName);
                                            }
                                        }, className: "px-2 py-0.5 rounded border border-gray-600 text-gray-200 hover:bg-gray-800", type: "button", children: "Jump to divergence" })] }), _jsx("div", { className: "space-y-1", children: buildMismatchEntries(verificationStatus.mismatch, record?.probes ?? []).map((entry) => (_jsxs("button", { onClick: () => onMismatchSelect(entry.probeId), className: "flex items-center justify-between text-left w-full hover:text-orange-200", type: "button", children: [_jsxs("span", { className: "text-gray-400", children: [entry.label, " (", entry.nodeId, ".", entry.portName, ")"] }), _jsxs("span", { className: "font-mono text-gray-200", children: [entry.expected, " \u2192 ", entry.actual] })] }, entry.probeId))) }), _jsx("div", { className: "text-[10px] text-gray-500", children: "Fan-in radius: 4 hops" }), _jsxs("div", { className: "pt-2 border-t border-gray-700", children: [_jsx("div", { className: "text-gray-400 mb-1", children: "Recent stimulus" }), verificationStatus.mismatch.recentStimulus.length === 0 ? (_jsx("div", { className: "text-gray-500", children: "No stimulus before divergence." })) : (verificationStatus.mismatch.recentStimulus.map((event, index) => (_jsxs("div", { className: "text-gray-300", children: ["t", event.tick, " ", event.nodeId, ".", event.portName, " = ", event.value] }, `${event.nodeId}-${event.tick}-${index}`))))] })] }))] })] }));
};
