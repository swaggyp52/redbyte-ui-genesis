import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * @deprecated RB_UNIFY_02: This app has been replaced by Lab Assignment (ECELabApp).
 * Kept for reference only; not registered in AppRegistry.
 */
import { useState, useEffect, useCallback } from 'react';
import styles from './StudentLabApp.module.css';
import { loadPresets, runSelfCheckWithPreset, } from '../utils/selfCheck';
import { OverlayRoot, OverlayPanel } from '@redbyte/rb-primitives';
import { exportBundle, downloadBlob } from '../utils/bundleExport';
import { assertAppOutput, registerAppInvariants } from '../utils/appInvariants';
import { useCircuitStore } from '../stores/circuitStore';
const STUDENT_LAB_INVARIANTS = {
    reads: ['lab_templates', 'bridge_telemetry', 'trace_events'],
    writes: ['connection_state', 'trace_recording'],
    outputs: ['rb-lab.zip'],
};
registerAppInvariants('student-lab', STUDENT_LAB_INVARIANTS);
// ============================================================================
// Hardcoded Lab List (expand as specs are added)
// ============================================================================
const AVAILABLE_LABS = [
    {
        lab_id: 'traffic-light',
        title: 'Traffic Light Controller',
        description: 'Build a state machine that cycles through R→G→Y→R.',
    },
    {
        lab_id: 'half-adder',
        title: 'Half Adder',
        description: 'Implement a half adder with sum and carry outputs.',
    },
    {
        lab_id: 'sr-latch',
        title: 'SR Latch',
        description: 'Build a set-reset latch using cross-coupled NOR gates.',
    },
    {
        lab_id: '2bit-counter',
        title: '2-Bit Counter',
        description: 'Design a sequential counter that counts 0→1→2→3→0.',
    },
];
// ============================================================================
// Local Storage Helpers
// ============================================================================
const STORAGE_KEY_STUDENT = 'redbyte_student_identity';
function loadStudentIdentity() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_STUDENT);
        if (stored) {
            return JSON.parse(stored);
        }
    }
    catch {
        // Ignore parse errors
    }
    return null;
}
function saveStudentIdentity(name, id) {
    localStorage.setItem(STORAGE_KEY_STUDENT, JSON.stringify({ name, id }));
}
function generateStudentId() {
    return `student-${Date.now().toString(36)}`;
}
// ============================================================================
// Main Component
// ============================================================================
const StudentLabAppContent = ({ initialTab, simGuide, onOpenApp }) => {
    const initialTabValue = initialTab ?? (simGuide ? 'hardware' : 'spec');
    // Access circuit from global store (shared with LogicPlayground)
    const globalCircuit = useCircuitStore((state) => state.circuit);
    // App phase: 'select' | 'attempt' | 'exported'
    const [phase, setPhase] = useState('select');
    // Student identity
    const [studentName, setStudentName] = useState('');
    const [studentId, setStudentId] = useState('');
    // Lab selection
    const [selectedLabId, setSelectedLabId] = useState(null);
    // Attempt state
    const [attempt, setAttempt] = useState(null);
    // Lab spec (loaded after attempt starts)
    const [spec, setSpec] = useState(null);
    const [specLoading, setSpecLoading] = useState(false);
    const [specError, setSpecError] = useState(null);
    // Self-check state
    const [selfCheckSummary, setSelfCheckSummary] = useState(null);
    // Presets state (Option B: controlled inputs)
    const [presets, setPresets] = useState(null);
    const [selectedPreset, setSelectedPreset] = useState(null);
    const [presetsLoading, setPresetsLoading] = useState(false);
    // Event log (append-only)
    const [eventLog, setEventLog] = useState([]);
    // Active tab during attempt
    const [activeTab, setActiveTab] = useState(initialTabValue);
    // Hardware state
    const [bridgeStatus, setBridgeStatus] = useState({ online: false, lastChecked: new Date().toISOString() });
    const [boardStatus, setBoardStatus] = useState({ connected: false });
    const [snapshots, setSnapshots] = useState([]);
    const [showManualSnapshotModal, setShowManualSnapshotModal] = useState(false);
    const [manualInputs, setManualInputs] = useState('');
    const [manualOutputs, setManualOutputs] = useState('');
    const [manualNotes, setManualNotes] = useState('');
    // Export state
    const [showExportConfirm, setShowExportConfirm] = useState(false);
    const [exportResult, setExportResult] = useState(null);
    const [exportError, setExportError] = useState(null);
    // ============================================================================
    // Event Emitter (append-only)
    // ============================================================================
    const emitEvent = useCallback((type, data) => {
        const entry = {
            type,
            timestamp: new Date().toISOString(),
            data,
        };
        setEventLog((prev) => [...prev, entry]);
    }, []);
    // ============================================================================
    // Initialize from localStorage
    // ============================================================================
    useEffect(() => {
        const stored = loadStudentIdentity();
        if (stored) {
            setStudentName(stored.name);
            setStudentId(stored.id);
        }
    }, []);
    // ============================================================================
    // Bridge Polling (Desktop Bridge for FPGA detection)
    // ============================================================================
    useEffect(() => {
        if (phase !== 'attempt')
            return;
        const BRIDGE_PORT = 3002;
        const POLL_INTERVAL = 2000; // 2 seconds
        const pollBridge = async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1000);
                const response = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/board/status`, {
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const data = await response.json();
                    const now = new Date().toISOString();
                    setBridgeStatus({ online: true, lastChecked: now });
                    const wasDisconnected = !boardStatus.connected;
                    setBoardStatus({
                        connected: data.connected || false,
                        model: data.model,
                        lastSeen: data.connected ? now : boardStatus.lastSeen,
                    });
                    // Emit board_connected event if transitioned from disconnected to connected
                    if (wasDisconnected && data.connected) {
                        emitEvent('board_connected', {
                            model: data.model,
                            timestamp: now,
                        });
                    }
                }
                else {
                    setBridgeStatus({ online: false, lastChecked: new Date().toISOString() });
                }
            }
            catch (err) {
                // Bridge not running or timeout
                setBridgeStatus({ online: false, lastChecked: new Date().toISOString() });
            }
        };
        // Poll immediately on mount
        pollBridge();
        // Set up polling interval
        const intervalId = setInterval(pollBridge, POLL_INTERVAL);
        return () => clearInterval(intervalId);
    }, [phase, boardStatus.connected, emitEvent]);
    // ============================================================================
    // Start Attempt
    // ============================================================================
    const handleStartAttempt = async () => {
        if (!studentName.trim()) {
            return; // Name is required
        }
        if (!selectedLabId) {
            return; // Lab selection is required
        }
        // Generate or use existing student ID
        const finalStudentId = studentId.trim() || generateStudentId();
        setStudentId(finalStudentId);
        saveStudentIdentity(studentName.trim(), finalStudentId);
        // Create attempt
        const attemptId = `attempt-${Date.now()}`;
        const startedAt = new Date().toISOString();
        setAttempt({
            attemptId,
            startedAt,
            labId: selectedLabId,
        });
        // Emit attempt_started event
        emitEvent('attempt_started', {
            lab_id: selectedLabId,
            attempt_id: attemptId,
            student_id: finalStudentId,
        });
        // Load lab spec and presets in parallel
        setSpecLoading(true);
        setPresetsLoading(true);
        setSpecError(null);
        try {
            const res = await fetch(`/labs/${selectedLabId}.spec.json`);
            if (!res.ok) {
                throw new Error(`Failed to load lab spec: ${res.statusText}`);
            }
            const data = await res.json();
            setSpec(data);
            // Load presets (non-blocking - OK if missing)
            const presetsData = await loadPresets(selectedLabId);
            setPresets(presetsData);
            if (presetsData && presetsData.presets.length > 0) {
                // Auto-select first preset (typically "correct")
                setSelectedPreset(presetsData.presets[0]);
            }
            setPhase('attempt');
            setActiveTab('spec');
        }
        catch (err) {
            setSpecError(err instanceof Error ? err.message : 'Unknown error');
        }
        finally {
            setSpecLoading(false);
            setPresetsLoading(false);
        }
    };
    // ============================================================================
    // Hardware Snapshot Handlers
    // ============================================================================
    const handleCaptureSnapshot = async () => {
        if (bridgeStatus.online && boardStatus.connected) {
            // Bridge mode: fetch snapshot from bridge
            try {
                const response = await fetch('http://127.0.0.1:3002/board/snapshot', {
                    signal: AbortSignal.timeout(1000),
                });
                if (response.ok) {
                    const data = await response.json();
                    const snapshot = {
                        timestamp: new Date().toISOString(),
                        inputs: data.inputs || {},
                        outputs: data.outputs || {},
                        notes: data.notes,
                        source: 'bridge',
                    };
                    setSnapshots((prev) => [...prev, snapshot]);
                    emitEvent('snapshot_captured', {
                        source: 'bridge',
                        inputs: snapshot.inputs,
                        outputs: snapshot.outputs,
                    });
                    return;
                }
            }
            catch (err) {
                console.error('Failed to fetch snapshot from bridge:', err);
            }
        }
        // Fallback to manual mode
        setShowManualSnapshotModal(true);
    };
    const handleSaveManualSnapshot = () => {
        try {
            const inputs = manualInputs.trim() ? JSON.parse(manualInputs) : {};
            const outputs = manualOutputs.trim() ? JSON.parse(manualOutputs) : {};
            const snapshot = {
                timestamp: new Date().toISOString(),
                inputs,
                outputs,
                notes: manualNotes.trim() || undefined,
                source: 'manual',
            };
            setSnapshots((prev) => [...prev, snapshot]);
            emitEvent('snapshot_captured', {
                source: 'manual',
                inputs: snapshot.inputs,
                outputs: snapshot.outputs,
                notes: snapshot.notes,
            });
            // Reset form
            setManualInputs('');
            setManualOutputs('');
            setManualNotes('');
            setShowManualSnapshotModal(false);
        }
        catch (err) {
            alert('Invalid JSON format. Use {"SW":1,"BTN":0} format.');
        }
    };
    // ============================================================================
    // Self-Check Handler (uses real proof-core grading)
    // ============================================================================
    const handleSelfCheck = () => {
        if (!spec || !selectedPreset)
            return;
        // Run self-check using the selected preset (real proof-core grading)
        const output = runSelfCheckWithPreset(selectedPreset, spec.lab_id);
        const lastRunAt = new Date().toISOString();
        const summary = {
            passCount: output.summary.pass,
            totalCount: output.summary.total,
            lastRunAt,
            results: output.results,
        };
        setSelfCheckSummary(summary);
        // Emit self_check_ran event with preset info
        emitEvent('self_check_ran', {
            passCount: output.summary.pass,
            totalCount: output.summary.total,
            lab_id: spec.lab_id,
            preset_id: selectedPreset.id,
            preset_name: selectedPreset.name,
        });
    };
    // ============================================================================
    // Export Handlers
    // ============================================================================
    const canExport = () => {
        return !!(studentName.trim() &&
            attempt &&
            selectedPreset &&
            selfCheckSummary);
    };
    const handleExportClick = () => {
        if (!canExport())
            return;
        setShowExportConfirm(true);
    };
    const handleExportConfirm = async () => {
        if (!spec || !attempt || !selfCheckSummary || !selectedPreset)
            return;
        setExportError(null);
        try {
            // Emit attempt_submitted event before export with hardware evidence
            emitEvent('attempt_submitted', {
                lab_id: spec.lab_id,
                attempt_id: attempt.attemptId,
                hardware_snapshots_count: snapshots.length,
                self_check_summary: {
                    passCount: selfCheckSummary.passCount,
                    totalCount: selfCheckSummary.totalCount,
                },
            });
            // Get updated event log (including the attempt_submitted we just added)
            const finalEventLog = [
                ...eventLog,
                {
                    type: 'attempt_submitted',
                    timestamp: new Date().toISOString(),
                    data: {
                        lab_id: spec.lab_id,
                        attempt_id: attempt.attemptId,
                        self_check_summary: {
                            passCount: selfCheckSummary.passCount,
                            totalCount: selfCheckSummary.totalCount,
                        },
                    },
                },
            ];
            // Build capsule vectors in proof-core format (pass: boolean)
            const capsuleVectors = selfCheckSummary.results.map((r) => {
                const vector = {
                    id: r.vectorId,
                    name: r.vectorName,
                    pass: r.status === 'PASS',
                };
                // Add error string if there's a mismatch
                if (r.firstMismatch) {
                    vector.error = `First mismatch at tick ${r.firstMismatch.tick}, signal ${r.firstMismatch.signal}`;
                }
                return vector;
            });
            assertAppOutput('student-lab', 'rb-lab.zip');
            const result = await exportBundle({
                labId: spec.lab_id,
                studentId: studentId,
                studentName: studentName.trim(),
                eventLog: finalEventLog,
                capsuleVectors,
                selfCheckSummary: {
                    pass: selfCheckSummary.passCount,
                    fail: selfCheckSummary.totalCount - selfCheckSummary.passCount,
                    total: selfCheckSummary.totalCount,
                },
                presetId: selectedPreset.id,
                presetName: selectedPreset.name,
                hardwareEvidence: {
                    bridgeStatus: bridgeStatus.online ? 'online' : 'offline',
                    boardStatus: boardStatus.connected ? 'connected' : 'disconnected',
                    boardModel: boardStatus.model,
                    snapshots,
                },
            });
            setExportResult(result);
            setShowExportConfirm(false);
            setPhase('exported');
        }
        catch (err) {
            setExportError(err instanceof Error ? err.message : 'Export failed');
        }
    };
    const handleExportCancel = () => {
        setShowExportConfirm(false);
    };
    // ============================================================================
    // Render: Lab Selection Phase
    // ============================================================================
    if (phase === 'select') {
        const canStart = studentName.trim() && selectedLabId;
        return (_jsxs("div", { className: `${styles.container} relative`, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: "RedByte Logic Labs" }), _jsx("p", { className: styles.subtitle, children: "Build, test, and submit your digital logic designs" })] }), _jsxs("div", { className: styles.selectContent, children: [_jsxs("section", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "Your Identity" }), _jsxs("div", { className: styles.inputGroup, children: [_jsxs("label", { className: styles.label, children: ["Student Name ", _jsx("span", { className: styles.required, children: "*" })] }), _jsx("input", { type: "text", className: `${styles.input} rbInput`, placeholder: "Enter your name", value: studentName, onChange: (e) => setStudentName(e.target.value) })] }), _jsxs("div", { className: styles.inputGroup, children: [_jsxs("label", { className: styles.label, children: ["Student ID ", _jsx("span", { className: styles.optional, children: "(auto-generated if blank)" })] }), _jsx("input", { type: "text", className: `${styles.input} rbInput`, placeholder: "e.g., student-001", value: studentId, onChange: (e) => setStudentId(e.target.value) })] })] }), _jsxs("section", { className: styles.section, children: [_jsx("h2", { className: styles.sectionTitle, children: "Choose Your Lab" }), _jsx("div", { className: styles.labGrid, children: AVAILABLE_LABS.map((lab) => (_jsxs("button", { type: "button", className: `${styles.labCard} ${selectedLabId === lab.lab_id ? styles.labCardSelected : ''}`, onClick: () => setSelectedLabId(lab.lab_id), children: [_jsx("div", { className: styles.labCardTitle, children: lab.title }), _jsx("div", { className: styles.labCardId, children: lab.lab_id }), _jsx("div", { className: styles.labCardDesc, children: lab.description })] }, lab.lab_id))) })] }), _jsxs("div", { className: styles.startSection, children: [specLoading && _jsx("div", { className: styles.loadingText, children: "Loading lab..." }), specError && _jsxs("div", { className: styles.errorText, children: ["Error: ", specError] }), _jsx("button", { className: `${styles.startButton} ${!canStart ? styles.startButtonDisabled : ''} rbButtonPrimary`, onClick: handleStartAttempt, disabled: !canStart || specLoading, children: "Start Attempt" }), !studentName.trim() && (_jsx("div", { className: styles.hint, children: "Please enter your name to continue" })), studentName.trim() && !selectedLabId && (_jsx("div", { className: styles.hint, children: "Please select a lab to continue" }))] })] })] }));
    }
    // ============================================================================
    // Render: Exported Phase (Receipt)
    // ============================================================================
    if (phase === 'exported' && exportResult && spec && attempt && selectedPreset && selfCheckSummary) {
        const handleDownloadAgain = () => {
            assertAppOutput('student-lab', 'rb-lab.zip');
            downloadBlob(exportResult.blob, exportResult.filename);
        };
        const handleCopyReceipt = async () => {
            const receipt = {
                lab: {
                    id: spec.lab_id,
                    title: spec.title,
                },
                student: {
                    name: studentName,
                    id: studentId,
                },
                attempt: {
                    id: attempt.attemptId,
                    started_at: attempt.startedAt,
                },
                submission: {
                    filename: exportResult.filename,
                    timestamp: exportResult.timestamp,
                    hash: exportResult.hash,
                },
                self_check: {
                    pass: selfCheckSummary.passCount,
                    total: selfCheckSummary.totalCount,
                    last_run: selfCheckSummary.lastRunAt,
                },
                preset: {
                    id: selectedPreset.id,
                    name: selectedPreset.name,
                },
            };
            try {
                await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
            }
            catch (e) {
                console.error('Failed to copy receipt:', e);
            }
        };
        return (_jsxs("div", { className: `${styles.container} relative`, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: "Submission Receipt" }), _jsx("p", { className: styles.subtitle, children: "Your lab submission has been exported successfully" })] }), _jsxs("div", { className: styles.receiptContent, children: [_jsx("div", { className: styles.successIcon, children: "\u2713" }), _jsxs("div", { className: styles.receiptCard, children: [_jsxs("div", { className: styles.receiptSection, children: [_jsx("h3", { className: styles.receiptSectionTitle, children: "Lab" }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Title:" }), _jsx("span", { className: styles.receiptValue, children: spec.title })] }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Lab ID:" }), _jsx("span", { className: styles.receiptValue, children: spec.lab_id })] })] }), _jsxs("div", { className: styles.receiptSection, children: [_jsx("h3", { className: styles.receiptSectionTitle, children: "Student" }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Name:" }), _jsx("span", { className: styles.receiptValue, children: studentName })] }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Student ID:" }), _jsx("span", { className: styles.receiptValue, children: studentId })] })] }), _jsxs("div", { className: styles.receiptSection, children: [_jsx("h3", { className: styles.receiptSectionTitle, children: "Attempt" }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Attempt ID:" }), _jsx("span", { className: styles.receiptValue, children: attempt.attemptId })] }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Started:" }), _jsx("span", { className: styles.receiptValue, children: new Date(attempt.startedAt).toLocaleString() })] })] }), _jsxs("div", { className: styles.receiptSection, children: [_jsx("h3", { className: styles.receiptSectionTitle, children: "Self-Check Results" }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Passed:" }), _jsxs("span", { className: styles.receiptValue, children: [selfCheckSummary.passCount, " / ", selfCheckSummary.totalCount] })] }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Last Run:" }), _jsx("span", { className: styles.receiptValue, children: new Date(selfCheckSummary.lastRunAt).toLocaleString() })] }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Preset:" }), _jsx("span", { className: styles.receiptValue, children: selectedPreset.name })] })] }), _jsxs("div", { className: styles.receiptSection, children: [_jsx("h3", { className: styles.receiptSectionTitle, children: "Submission" }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Filename:" }), _jsx("span", { className: styles.receiptValueMono, children: exportResult.filename })] }), _jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "Timestamp:" }), _jsx("span", { className: styles.receiptValue, children: new Date(exportResult.timestamp).toLocaleString() })] }), exportResult.hash && (_jsxs("div", { className: styles.receiptRow, children: [_jsx("span", { className: styles.receiptLabel, children: "SHA-256:" }), _jsx("span", { className: styles.receiptValueMono, children: exportResult.hash })] }))] })] }), _jsxs("div", { className: styles.receiptActions, children: [_jsx("button", { type: "button", className: `${styles.receiptActionButton} rbButtonSecondary`, onClick: handleDownloadAgain, children: "Download Again" }), _jsx("button", { type: "button", className: `${styles.receiptActionButton} rbButtonSecondary`, onClick: handleCopyReceipt, children: "Copy Receipt" })] }), _jsx("p", { className: styles.receiptInstructions, children: "Submit the .rb-lab.zip file to your instructor. Keep this receipt for your records." }), _jsx("button", { type: "button", className: `${styles.newAttemptButton} rbButtonSecondary`, onClick: () => {
                                setPhase('select');
                                setAttempt(null);
                                setSpec(null);
                                setSelfCheckSummary(null);
                                setEventLog([]);
                                setExportResult(null);
                                setSelectedLabId(null);
                                setSelectedPreset(null);
                                setPresets(null);
                            }, children: "Start New Attempt" })] })] }));
    }
    // ============================================================================
    // Render: Attempt Phase (Main Lab UI)
    // ============================================================================
    if (!spec || !attempt) {
        return (_jsx("div", { className: `${styles.container} relative`, children: _jsx("div", { className: styles.loading, children: "Loading..." }) }));
    }
    const exportDisabledReasons = [];
    if (!studentName.trim())
        exportDisabledReasons.push('Student name is required');
    if (!attempt)
        exportDisabledReasons.push('Attempt not started');
    if (!selectedPreset)
        exportDisabledReasons.push('Preset must be selected (Build tab)');
    if (!selfCheckSummary)
        exportDisabledReasons.push('Self-check must be run at least once');
    // Progress steps
    const steps = [
        { id: 'spec', label: 'Spec', complete: true },
        { id: 'build', label: 'Build', complete: !!selectedPreset }, { id: 'hardware', label: 'Hardware', completed: snapshots.length > 0 }, { id: 'self-check', label: 'Self-Check', complete: !!selfCheckSummary },
        { id: 'export', label: 'Export', complete: false },
    ];
    const currentStepIndex = steps.findIndex(s => s.id === activeTab);
    return (_jsxs("div", { className: `${styles.container} relative`, children: [_jsxs("div", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: spec.title }), _jsxs("div", { className: styles.attemptInfo, children: [_jsx("span", { className: styles.attemptBadge, children: "Attempt in progress" }), _jsxs("span", { className: styles.attemptMeta, children: ["ID: ", attempt.attemptId, " | Started: ", new Date(attempt.startedAt).toLocaleString()] })] })] }), _jsx("div", { className: styles.progressBar, children: steps.map((step, idx) => (_jsxs("div", { className: `${styles.progressStep} ${idx === currentStepIndex ? styles.progressStepActive : ''} ${step.complete ? styles.progressStepComplete : ''}`, children: [_jsx("div", { className: styles.progressStepNumber, children: idx + 1 }), _jsx("div", { className: styles.progressStepLabel, children: step.label })] }, step.id))) }), _jsxs("div", { className: styles.tabs, children: [_jsx("button", { className: `${styles.tab} ${activeTab === 'spec' ? styles.tabActive : ''}`, onClick: () => setActiveTab('spec'), children: "1. Spec" }), _jsx("button", { className: `${styles.tab} ${activeTab === 'build' ? styles.tabActive : ''}`, onClick: () => setActiveTab('build'), children: "2. Build" }), _jsxs("button", { className: `${styles.tab} ${activeTab === 'hardware' ? styles.tabActive : ''}`, onClick: () => setActiveTab('hardware'), children: ["3. Hardware", snapshots.length > 0 && (_jsx("span", { className: styles.tabBadge, children: snapshots.length }))] }), _jsxs("button", { className: `${styles.tab} ${activeTab === 'self-check' ? styles.tabActive : ''}`, onClick: () => setActiveTab('self-check'), children: ["4. Self-Check", selfCheckSummary && (_jsxs("span", { className: styles.tabBadge, children: [selfCheckSummary.passCount, "/", selfCheckSummary.totalCount] }))] }), _jsx("button", { className: `${styles.tab} ${activeTab === 'export' ? styles.tabActive : ''}`, onClick: () => setActiveTab('export'), children: "5. Export" })] }), _jsxs("div", { className: styles.content, children: [activeTab === 'spec' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.panelTitle, children: "Lab Specification" }), _jsx("p", { className: styles.description, children: spec.description }), spec.constraints && (_jsxs("div", { className: styles.constraints, children: [_jsx("h3", { children: "Constraints" }), spec.constraints.allowedGates && (_jsxs("div", { className: styles.constraint, children: [_jsx("span", { className: styles.constraintLabel, children: "Allowed Gates:" }), _jsx("span", { className: styles.constraintValue, children: spec.constraints.allowedGates.join(', ') })] })), spec.constraints.maxGates && (_jsxs("div", { className: styles.constraint, children: [_jsx("span", { className: styles.constraintLabel, children: "Max Gates:" }), _jsx("span", { className: styles.constraintValue, children: spec.constraints.maxGates })] })), spec.constraints.requiredInputs && (_jsxs("div", { className: styles.constraint, children: [_jsx("span", { className: styles.constraintLabel, children: "Required Inputs:" }), _jsx("span", { className: styles.constraintValue, children: spec.constraints.requiredInputs.join(', ') })] })), spec.constraints.requiredOutputs && (_jsxs("div", { className: styles.constraint, children: [_jsx("span", { className: styles.constraintLabel, children: "Required Outputs:" }), _jsx("span", { className: styles.constraintValue, children: spec.constraints.requiredOutputs.join(', ') })] }))] })), _jsxs("div", { className: styles.vectors, children: [_jsxs("h3", { children: ["Student Test Vectors (", spec.studentVectors.length, ")"] }), spec.studentVectors.map((vec) => (_jsxs("div", { className: styles.vector, children: [_jsx("div", { className: styles.vectorName, children: vec.name }), _jsx("div", { className: styles.vectorInputs, children: JSON.stringify(vec.inputs) })] }, vec.id)))] })] })), activeTab === 'build' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.panelTitle, children: "Build Your Circuit" }), _jsxs("div", { className: styles.circuitStatusCard, children: [_jsxs("div", { className: styles.circuitStatusHeader, children: [_jsx("span", { className: styles.circuitStatusLabel, children: "Current Circuit" }), globalCircuit.nodes.length > 0 ? (_jsxs("span", { className: styles.circuitStatusBadge + ' ' + styles.circuitStatusActive, children: [globalCircuit.nodes.length, " nodes, ", globalCircuit.connections.length, " wires"] })) : (_jsx("span", { className: styles.circuitStatusBadge + ' ' + styles.circuitStatusEmpty, children: "Empty" }))] }), globalCircuit.nodes.length > 0 && (_jsx("div", { className: styles.circuitPreview, children: _jsxs("div", { className: styles.circuitNodeList, children: [globalCircuit.nodes.slice(0, 6).map((node) => (_jsx("span", { className: styles.circuitNodeTag, children: node.type }, node.id))), globalCircuit.nodes.length > 6 && (_jsxs("span", { className: styles.circuitNodeMore, children: ["+", globalCircuit.nodes.length - 6, " more"] }))] }) }))] }), _jsxs("div", { className: styles.buildActions, children: [_jsx("button", { type: "button", className: `${styles.openPlaygroundButton} rbButtonPrimary`, onClick: () => {
                                            if (onOpenApp) {
                                                onOpenApp('logic-playground');
                                                emitEvent('opened_playground', {
                                                    lab_id: spec?.lab_id,
                                                    nodes_before: globalCircuit.nodes.length,
                                                });
                                            }
                                        }, children: "Open Logic Playground" }), _jsx("p", { className: styles.buildHint, children: "Build your circuit in Logic Playground. Your design will automatically sync here." })] }), _jsx("div", { className: styles.buildDivider, children: _jsx("span", { children: "or use a preset" }) }), _jsxs("div", { className: styles.presetSection, children: [_jsx("h3", { className: styles.presetSectionTitle, children: "Demo Presets" }), _jsx("p", { className: styles.presetSectionInfo, children: "For demonstration purposes, select a pre-built implementation:" }), presetsLoading && _jsx("div", { className: styles.loadingText, children: "Loading presets..." }), !presetsLoading && presets && presets.presets.length > 0 && (_jsx("div", { className: styles.presetGrid, children: presets.presets.map((preset) => (_jsxs("button", { type: "button", className: `${styles.presetCard} ${selectedPreset?.id === preset.id ? styles.presetCardSelected : ''}`, onClick: () => {
                                                setSelectedPreset(preset);
                                                setSelfCheckSummary(null);
                                                emitEvent('preset_selected', {
                                                    lab_id: spec?.lab_id,
                                                    preset_id: preset.id,
                                                    preset_name: preset.name,
                                                });
                                            }, children: [_jsx("div", { className: styles.presetCardTitle, children: preset.name }), _jsx("div", { className: styles.presetCardDesc, children: preset.description }), _jsxs("div", { className: styles.presetCardVectors, children: [preset.vectors.filter((v) => v.pass).length, "/", preset.vectors.length, " vectors pass"] })] }, preset.id))) })), !presetsLoading && (!presets || presets.presets.length === 0) && (_jsx("div", { className: styles.noPresetsMessage, children: "No presets available for this lab." }))] }), (globalCircuit.nodes.length > 0 || selectedPreset) && (_jsxs("div", { className: styles.buildStatus, children: [_jsx("div", { className: styles.buildStatusIcon, children: globalCircuit.nodes.length > 0 || selectedPreset ? '✓' : '○' }), _jsx("div", { className: styles.buildStatusText, children: globalCircuit.nodes.length > 0
                                            ? `Circuit ready: ${globalCircuit.nodes.length} nodes`
                                            : selectedPreset
                                                ? `Using preset: ${selectedPreset.name}`
                                                : 'Build your circuit or select a preset' })] })), (globalCircuit.nodes.length > 0 || selectedPreset) && (_jsxs("div", { className: styles.nextStepHint, children: ["Proceed to ", _jsx("strong", { children: "Self-Check" }), " to verify your implementation."] }))] })), activeTab === 'hardware' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.panelTitle, children: "Hardware Session" }), _jsx("p", { className: styles.hardwareInfo, children: "Connect your FPGA board and capture hardware evidence for your submission." }), simGuide && (_jsxs("div", { className: `${styles.warningBanner} rbBannerWarn`, children: [_jsx("strong", { children: "SIM mode:" }), " Start the bridge with simulated telemetry, then click Connect.", _jsx("br", {}), _jsx("code", { className: "rbCodeBlock", children: "RB_FPGA_SIM=1 pnpm --filter @redbyte/fpga-bridge dev" })] })), _jsxs("div", { className: styles.hardwareStatus, children: [_jsxs("div", { className: styles.statusCard, children: [_jsx("div", { className: styles.statusLabel, children: "Desktop Bridge" }), _jsx("div", { className: `${styles.statusValue} ${bridgeStatus.online ? styles.statusOnline : styles.statusOffline}`, children: bridgeStatus.online ? '● Online' : '○ Offline' }), _jsxs("div", { className: styles.statusDetail, children: ["Last checked: ", new Date(bridgeStatus.lastChecked).toLocaleTimeString()] }), !bridgeStatus.online && (_jsxs("div", { className: styles.statusHint, children: ["Start the FPGA Bridge to enable automatic board detection.", _jsx("br", {}), _jsx("code", { className: "rbCodeBlock", children: "pnpm --filter @redbyte/fpga-bridge dev" }), _jsx("br", {}), _jsxs("span", { className: styles.statusHintNote, children: ["For simulation/testing, use:", _jsx("br", {}), _jsx("code", { className: "rbCodeBlock", children: "RB_FPGA_SIM=1 pnpm --filter @redbyte/fpga-bridge dev" })] }), _jsx("div", { className: styles.statusHintNote, children: "Then return here and click Connect (ports refresh automatically)." })] }))] }), _jsxs("div", { className: styles.statusCard, children: [_jsx("div", { className: styles.statusLabel, children: "FPGA Board" }), _jsx("div", { className: `${styles.statusValue} ${boardStatus.connected ? styles.statusOnline : styles.statusOffline}`, children: boardStatus.connected ? '● Connected' : '○ Not Connected' }), boardStatus.model && (_jsxs("div", { className: styles.statusDetail, children: ["Model: ", boardStatus.model] })), boardStatus.lastSeen && (_jsxs("div", { className: styles.statusDetail, children: ["Last seen: ", new Date(boardStatus.lastSeen).toLocaleTimeString()] }))] })] }), _jsxs("div", { className: styles.hardwareActions, children: [_jsx("button", { className: `${styles.captureButton} rbButtonPrimary`, onClick: handleCaptureSnapshot, children: "\uD83D\uDCF8 Capture Snapshot" }), _jsx("div", { className: styles.actionHint, children: bridgeStatus.online && boardStatus.connected
                                            ? 'Snapshot will capture current board I/O state'
                                            : 'Manual entry will be used (no bridge/board detected)' })] }), _jsxs("div", { className: styles.snapshotsList, children: [_jsxs("h3", { children: ["Hardware Evidence (", snapshots.length, ")"] }), snapshots.length === 0 && (_jsx("div", { className: `${styles.emptySnapshots} rbEmptyState`, children: "No snapshots captured yet. Capture at least one snapshot to include hardware evidence in your submission." })), snapshots.map((snapshot, idx) => (_jsxs("div", { className: styles.snapshotCard, children: [_jsxs("div", { className: styles.snapshotHeader, children: [_jsx("span", { className: styles.snapshotTime, children: new Date(snapshot.timestamp).toLocaleTimeString() }), _jsx("span", { className: `${styles.snapshotSource} ${snapshot.source === 'bridge' ? styles.sourceBridge : styles.sourceManual}`, children: snapshot.source === 'bridge' ? '🔗 Bridge' : '✏️ Manual' })] }), _jsxs("div", { className: styles.snapshotData, children: [_jsxs("div", { className: styles.snapshotDataRow, children: [_jsx("span", { className: styles.snapshotDataLabel, children: "Inputs:" }), _jsx("code", { className: `${styles.snapshotDataValue} rbCodeBlock`, children: JSON.stringify(snapshot.inputs) })] }), _jsxs("div", { className: styles.snapshotDataRow, children: [_jsx("span", { className: styles.snapshotDataLabel, children: "Outputs:" }), _jsx("code", { className: `${styles.snapshotDataValue} rbCodeBlock`, children: JSON.stringify(snapshot.outputs) })] }), snapshot.notes && (_jsxs("div", { className: styles.snapshotDataRow, children: [_jsx("span", { className: styles.snapshotDataLabel, children: "Notes:" }), _jsx("span", { className: styles.snapshotDataValue, children: snapshot.notes })] }))] })] }, idx)))] }), showManualSnapshotModal && (_jsx(OverlayRoot, { className: "bg-black/60 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: styles.modalContent, children: [_jsx("h3", { className: styles.modalTitle, children: "Manual Snapshot Entry" }), _jsx("p", { className: styles.modalInfo, children: "Enter the observed I/O states from your FPGA board in JSON format." }), _jsxs("div", { className: styles.modalField, children: [_jsx("label", { className: styles.modalLabel, children: "Inputs (JSON)" }), _jsx("input", { type: "text", className: styles.modalInput, placeholder: '{"SW":1,"BTN":0}', value: manualInputs, onChange: (e) => setManualInputs(e.target.value) })] }), _jsxs("div", { className: styles.modalField, children: [_jsx("label", { className: styles.modalLabel, children: "Outputs (JSON)" }), _jsx("input", { type: "text", className: styles.modalInput, placeholder: '{"LED":7}', value: manualOutputs, onChange: (e) => setManualOutputs(e.target.value) })] }), _jsxs("div", { className: styles.modalField, children: [_jsx("label", { className: styles.modalLabel, children: "Notes (Optional)" }), _jsx("input", { type: "text", className: styles.modalInput, placeholder: "Additional observations...", value: manualNotes, onChange: (e) => setManualNotes(e.target.value) })] }), _jsxs("div", { className: styles.modalActions, children: [_jsx("button", { className: styles.modalButtonSecondary, onClick: () => setShowManualSnapshotModal(false), children: "Cancel" }), _jsx("button", { className: styles.modalButtonPrimary, onClick: handleSaveManualSnapshot, children: "Save Snapshot" })] })] }) }))] })), activeTab === 'self-check' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.panelTitle, children: "Self-Check (Browser Only)" }), _jsx("p", { className: styles.selfCheckInfo, children: "Run your implementation against the student test vectors to check your progress. This check runs locally in your browser and does not submit anything." }), !selectedPreset && (_jsxs("div", { className: styles.noPresetWarning, children: ["Please select an implementation preset in the ", _jsx("strong", { children: "Build" }), " tab first."] })), _jsx("button", { className: `${styles.checkButton} ${!selectedPreset ? styles.checkButtonDisabled : ''} rbButtonPrimary`, onClick: handleSelfCheck, disabled: !selectedPreset, children: "Run Self-Check" }), selectedPreset && (_jsxs("div", { className: styles.presetIndicator, children: ["Testing: ", _jsx("strong", { children: selectedPreset.name })] })), selfCheckSummary && (_jsxs("div", { className: styles.selfCheckSummary, children: [_jsxs("div", { className: styles.summaryHeader, children: [_jsxs("span", { className: styles.summaryScore, children: [selfCheckSummary.passCount, " / ", selfCheckSummary.totalCount, " passed"] }), _jsxs("span", { className: styles.summaryTime, children: ["Last run: ", new Date(selfCheckSummary.lastRunAt).toLocaleString()] })] }), _jsx("div", { className: styles.results, children: selfCheckSummary.results.map((result) => (_jsxs("div", { className: `${styles.result} ${result.status === 'PASS' ? styles.resultPass : styles.resultFail}`, children: [_jsxs("div", { className: styles.resultHeader, children: [_jsx("span", { className: styles.resultName, children: result.vectorName }), _jsx("span", { className: `${styles.badge} ${result.status === 'PASS' ? styles.badgePass : styles.badgeFail}`, children: result.status })] }), result.firstMismatch && (_jsxs("div", { className: styles.mismatch, children: ["First mismatch: tick ", result.firstMismatch.tick, ", signal ", result.firstMismatch.signal] }))] }, result.vectorId))) })] }))] })), activeTab === 'export' && (_jsxs("div", { className: styles.panel, children: [_jsx("h2", { className: styles.panelTitle, children: "Export Submission" }), _jsxs("div", { className: styles.exportSummary, children: [_jsx("h3", { children: "Submission Summary" }), _jsxs("div", { className: styles.summaryRow, children: [_jsx("span", { className: styles.summaryLabel, children: "Student:" }), _jsx("span", { className: styles.summaryValue, children: studentName || '(not set)' })] }), _jsxs("div", { className: styles.summaryRow, children: [_jsx("span", { className: styles.summaryLabel, children: "Student ID:" }), _jsx("span", { className: styles.summaryValue, children: studentId })] }), _jsxs("div", { className: styles.summaryRow, children: [_jsx("span", { className: styles.summaryLabel, children: "Lab:" }), _jsx("span", { className: styles.summaryValue, children: spec.lab_id })] }), _jsxs("div", { className: styles.summaryRow, children: [_jsx("span", { className: styles.summaryLabel, children: "Self-Check:" }), _jsx("span", { className: styles.summaryValue, children: selfCheckSummary
                                                    ? `${selfCheckSummary.passCount}/${selfCheckSummary.totalCount} passed`
                                                    : 'Not run yet' })] })] }), selfCheckSummary && selfCheckSummary.passCount < selfCheckSummary.totalCount && (_jsxs("div", { className: `${styles.warningBanner} rbBannerWarn`, children: ["Warning: Not all self-check tests passed (", selfCheckSummary.passCount, "/", selfCheckSummary.totalCount, "). You can still export, but your submission may not receive full credit."] })), exportDisabledReasons.length > 0 && (_jsxs("div", { className: styles.exportRequirements, children: [_jsx("h4", { children: "Requirements to export:" }), _jsx("ul", { children: exportDisabledReasons.map((reason, i) => (_jsx("li", { className: styles.requirementItem, children: reason }, i))) })] })), exportError && (_jsxs("div", { className: styles.errorBanner, children: ["Export failed: ", exportError] })), _jsx("button", { type: "button", className: `${styles.exportButton} ${!canExport() ? styles.exportButtonDisabled : ''} rbButtonPrimary`, onClick: handleExportClick, disabled: !canExport(), children: "Export .rb-lab.zip" }), showExportConfirm && (_jsx(OverlayRoot, { className: "bg-black/60 flex items-center justify-center", children: _jsxs(OverlayPanel, { className: styles.modal, children: [_jsx("h3", { className: styles.modalTitle, children: "Confirm Export" }), _jsxs("p", { className: styles.modalText, children: ["You are about to export your submission for ", _jsx("strong", { children: spec.title }), " as ", _jsx("strong", { children: studentName }), "."] }), _jsx("p", { className: styles.modalText, children: "This will download a .rb-lab.zip file that you can submit to your instructor." }), _jsxs("div", { className: styles.modalButtons, children: [_jsx("button", { type: "button", className: `${styles.modalCancel} rbButtonSecondary`, onClick: handleExportCancel, children: "Cancel" }), _jsx("button", { type: "button", className: `${styles.modalConfirm} rbButtonPrimary`, onClick: handleExportConfirm, children: "Confirm Export" })] })] }) }))] }))] })] }));
};
export const StudentLabApp = {
    manifest: {
        id: 'student-lab',
        name: 'Lab Workbench',
        iconId: 'circuit-board',
        category: 'logic',
        defaultSize: {
            width: 1000,
            height: 800,
        },
    },
    component: StudentLabAppContent,
};
