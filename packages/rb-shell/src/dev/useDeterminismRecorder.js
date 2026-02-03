// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useCallback, useRef } from 'react';
import { LogicEngine } from '../../../rb-logic-core/src/engine';
import { createRecorder, verifyReplay, getStateAtIndex, stepForward, stepBackward, canStepForward, canStepBackward, } from '../../../rb-logic-core/src/determinism';
/**
 * Adapter hook for determinism recording, verification, and time travel
 *
 * This hook provides a thin wrapper over the core determinism APIs,
 * managing recorder lifecycle, verification state, and time travel navigation.
 *
 * All computation happens in rb-logic-core; this hook only manages:
 * - Recorder instance lifecycle
 * - Verification result state
 * - Time travel navigation state
 * - UI-level callbacks
 */
export function useDeterminismRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [verificationResult, setVerificationResult] = useState(null);
    const [currentSnapshot, setCurrentSnapshot] = useState(null);
    const [eventCount, setEventCount] = useState(0);
    const [tickCount, setTickCount] = useState(0);
    const recorderRef = useRef(null);
    const initialCircuitRef = useRef(null);
    const startRecording = useCallback((initialCircuit) => {
        if (isRecording) {
            console.warn('Recorder already running');
            return;
        }
        // Create recorder with real-time clock (Date.now)
        const recorder = createRecorder();
        // Record the initial circuit snapshot
        recorder.recordCircuitLoaded(initialCircuit);
        recorderRef.current = recorder;
        initialCircuitRef.current = JSON.parse(JSON.stringify(initialCircuit)); // Deep clone
        setIsRecording(true);
        setVerificationResult(null);
        setEventCount(1); // Initial circuit load event
        setTickCount(0);
    }, [isRecording]);
    const stopRecording = useCallback(() => {
        if (!isRecording || !recorderRef.current) {
            console.warn('No active recording to stop');
            return;
        }
        recorderRef.current.stop();
        setIsRecording(false);
    }, [isRecording]);
    const recordInputToggled = useCallback((nodeId, portName, value) => {
        if (!recorderRef.current || !recorderRef.current.isRecording())
            return;
        recorderRef.current.recordInputToggled(nodeId, portName, value);
        setEventCount((prev) => prev + 1);
    }, []);
    const recordSimulationTick = useCallback((dt = 1) => {
        if (!recorderRef.current || !recorderRef.current.isRecording())
            return;
        recorderRef.current.recordSimulationTick(dt);
        setEventCount((prev) => prev + 1);
        setTickCount((prev) => prev + 1);
    }, []);
    const verifyRecording = useCallback(async () => {
        if (!recorderRef.current || !initialCircuitRef.current) {
            console.warn('No recording to verify');
            return;
        }
        const eventLog = recorderRef.current.getLog();
        const engineFactory = (circuit) => new LogicEngine(circuit);
        const result = await verifyReplay(initialCircuitRef.current, eventLog, { engineFactory });
        setVerificationResult(result);
    }, []);
    const reset = useCallback(() => {
        recorderRef.current = null;
        initialCircuitRef.current = null;
        setIsRecording(false);
        setVerificationResult(null);
        setCurrentSnapshot(null);
        setEventCount(0);
        setTickCount(0);
    }, []);
    // Time travel navigation callbacks
    const initializeTimeTravel = useCallback(() => {
        if (!recorderRef.current || !initialCircuitRef.current) {
            console.warn('No recording available for time travel');
            return;
        }
        const eventLog = recorderRef.current.getLog();
        const engineFactory = (circuit) => new LogicEngine(circuit);
        // Initialize at the beginning of the log
        const snapshot = getStateAtIndex(initialCircuitRef.current, eventLog, 0, { engineFactory });
        setCurrentSnapshot(snapshot);
    }, []);
    const stepForwardInTime = useCallback(() => {
        if (!currentSnapshot || !recorderRef.current || !initialCircuitRef.current) {
            return;
        }
        const eventLog = recorderRef.current.getLog();
        const engineFactory = (circuit) => new LogicEngine(circuit);
        const next = stepForward(initialCircuitRef.current, eventLog, currentSnapshot, { engineFactory });
        if (next) {
            setCurrentSnapshot(next);
        }
    }, [currentSnapshot]);
    const stepBackwardInTime = useCallback(() => {
        if (!currentSnapshot || !recorderRef.current || !initialCircuitRef.current) {
            return;
        }
        const eventLog = recorderRef.current.getLog();
        const engineFactory = (circuit) => new LogicEngine(circuit);
        const prev = stepBackward(initialCircuitRef.current, eventLog, currentSnapshot, { engineFactory });
        if (prev) {
            setCurrentSnapshot(prev);
        }
    }, [currentSnapshot]);
    const canNavigateForward = useCallback(() => {
        return currentSnapshot ? canStepForward(currentSnapshot) : false;
    }, [currentSnapshot]);
    const canNavigateBackward = useCallback(() => {
        return currentSnapshot ? canStepBackward(currentSnapshot) : false;
    }, [currentSnapshot]);
    const exportLog = useCallback(() => {
        if (!recorderRef.current || !initialCircuitRef.current) {
            console.warn('No recording available to export');
            return;
        }
        const eventLog = recorderRef.current.getLog();
        const exportData = {
            initialCircuit: initialCircuitRef.current,
            eventLog,
            metadata: {
                exportedAt: Date.now(),
                eventCount: eventLog.events.length,
            },
        };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `determinism-log-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);
    const getLog = useCallback(() => {
        if (!recorderRef.current)
            return null;
        return recorderRef.current.getLog();
    }, []);
    // Derived state for TruthBar
    const hasRecording = recorderRef.current !== null || initialCircuitRef.current !== null;
    const isTimeTraveling = currentSnapshot !== null;
    return {
        // Core state
        isRecording,
        verificationResult,
        currentSnapshot,
        // TruthBar state
        eventCount,
        tickCount,
        hasRecording,
        isTimeTraveling,
        // Recording actions
        startRecording,
        stopRecording,
        recordInputToggled,
        recordSimulationTick,
        // Verification
        verifyRecording,
        reset,
        exportLog,
        getLog,
        // Time travel
        initializeTimeTravel,
        stepForwardInTime,
        stepBackwardInTime,
        canNavigateForward,
        canNavigateBackward,
    };
}
