import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Modal } from '@redbyte/rb-primitives';
/**
 * Determinism Tools Panel (Dev Only)
 *
 * Minimal UI for demonstrating deterministic record/replay and time travel capabilities.
 * This panel is purely presentational - all logic lives in:
 * - useDeterminismRecorder (adapter layer)
 * - rb-logic-core/determinism (core primitives)
 *
 * Milestone B (PR7): Record/Replay
 * - Opens via Cmd/Ctrl+Shift+D
 * - Start/Stop creates EventLog via recorder
 * - Verify calls verifyReplay() and displays results
 *
 * Milestone C (PR10): Time Travel
 * - Initialize time travel navigation
 * - Step forward/backward through event log
 * - Display current snapshot state
 */
export const DeterminismPanel = ({ isOpen, onClose, getCurrentCircuit, onRecordAction, onExportLog, isRecording, verificationResult, currentSnapshot, canNavigateForward, canNavigateBackward, }) => {
    const handleStartRecording = () => {
        const circuit = getCurrentCircuit();
        if (!circuit) {
            alert('No active circuit found. Open Logic Playground first.');
            return;
        }
        onRecordAction({ type: 'start-recording' });
    };
    const handleStopRecording = () => {
        onRecordAction({ type: 'stop-recording' });
    };
    const handleVerify = () => {
        onRecordAction({ type: 'verify-replay' });
    };
    const handleReset = () => {
        onRecordAction({ type: 'reset' });
    };
    const handleInitializeTimeTravel = () => {
        onRecordAction({ type: 'initialize-timetravel' });
    };
    const handleStepForward = () => {
        onRecordAction({ type: 'step-forward' });
    };
    const handleStepBackward = () => {
        onRecordAction({ type: 'step-backward' });
    };
    return (_jsx(Modal, { isOpen: isOpen, onClose: onClose, title: "Determinism Tools (Dev)", width: 550, height: 550, children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 uppercase tracking-wide", children: "Recording" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleStartRecording, disabled: isRecording, className: `px-4 py-2 rounded font-medium transition-colors ${isRecording
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 text-white'}`, children: "Start Recording" }), _jsx("button", { onClick: handleStopRecording, disabled: !isRecording, className: `px-4 py-2 rounded font-medium transition-colors ${!isRecording
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-600 hover:bg-red-700 text-white'}`, children: "Stop Recording" })] }), isRecording && (_jsxs("div", { className: "flex items-center gap-2 text-sm text-yellow-400", children: [_jsx("div", { className: "w-2 h-2 bg-red-500 rounded-full animate-pulse" }), _jsx("span", { children: "Recording..." })] }))] }), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 uppercase tracking-wide", children: "Verification" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleVerify, disabled: isRecording, className: `px-4 py-2 rounded font-medium transition-colors ${isRecording
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'}`, children: "Verify Replay" }), _jsx("button", { onClick: handleReset, className: "px-4 py-2 rounded font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors", children: "Reset" }), _jsx("button", { onClick: onExportLog, disabled: isRecording, className: `px-4 py-2 rounded font-medium transition-colors ${isRecording
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`, title: "Export event log + initial circuit for bug reports", children: "Export Log" })] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 uppercase tracking-wide", children: "Time Travel (Milestone C)" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleInitializeTimeTravel, disabled: isRecording || !verificationResult, className: `px-4 py-2 rounded font-medium transition-colors ${isRecording || !verificationResult
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 text-white'}`, children: "Initialize" }), _jsx("button", { onClick: handleStepBackward, disabled: !canNavigateBackward, className: `px-4 py-2 rounded font-medium transition-colors ${!canNavigateBackward
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`, children: "\u2190 Step Back" }), _jsx("button", { onClick: handleStepForward, disabled: !canNavigateForward, className: `px-4 py-2 rounded font-medium transition-colors ${!canNavigateForward
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`, children: "Step Forward \u2192" })] }), currentSnapshot && (_jsxs("div", { className: "text-sm text-gray-300 font-mono", children: ["Event ", currentSnapshot.eventIndex + 1, " of ", currentSnapshot.totalEvents] }))] }), verificationResult && (_jsxs("div", { className: "space-y-3 p-4 bg-gray-800 rounded border border-gray-700", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-300 uppercase tracking-wide", children: "Verification Result" }), _jsxs("div", { className: "space-y-2 text-sm font-mono", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-400", children: "Live Hash:" }), _jsxs("span", { className: "text-gray-200", children: [verificationResult.liveHash.slice(0, 12), "..."] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-gray-400", children: "Replay Hash:" }), _jsxs("span", { className: "text-gray-200", children: [verificationResult.replayHash.slice(0, 12), "..."] })] }), _jsxs("div", { className: "flex justify-between items-center mt-3 pt-3 border-t border-gray-700", children: [_jsx("span", { className: "text-gray-400", children: "Status:" }), _jsx("span", { className: `font-bold ${verificationResult.equal ? 'text-green-400' : 'text-red-400'}`, children: verificationResult.equal ? '✓ Deterministic' : '✗ Diverged' })] })] })] }))] }) }));
};
