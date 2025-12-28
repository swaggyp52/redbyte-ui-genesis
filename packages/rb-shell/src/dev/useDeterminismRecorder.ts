// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { useState, useCallback, useRef } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { LogicEngine } from '../../../rb-logic-core/src/engine';
import {
  createRecorder,
  verifyReplay,
  getStateAtIndex,
  stepForward,
  stepBackward,
  canStepForward,
  canStepBackward,
  type Recorder,
  type VerifyReplayResult,
  type CircuitStateSnapshot,
} from '../../../rb-logic-core/src/determinism';

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
  const [verificationResult, setVerificationResult] = useState<VerifyReplayResult | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<CircuitStateSnapshot | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const initialCircuitRef = useRef<Circuit | null>(null);

  const startRecording = useCallback((initialCircuit: Circuit) => {
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
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !recorderRef.current) {
      console.warn('No active recording to stop');
      return;
    }

    recorderRef.current.stop();
    setIsRecording(false);
  }, [isRecording]);

  const recordInputToggled = useCallback((nodeId: string, portName: string, value: number) => {
    if (!recorderRef.current || !recorderRef.current.isRecording()) return;
    recorderRef.current.recordInputToggled(nodeId, portName, value);
  }, []);

  const recordSimulationTick = useCallback((dt: number = 1) => {
    if (!recorderRef.current || !recorderRef.current.isRecording()) return;
    recorderRef.current.recordSimulationTick(dt);
  }, []);

  const verifyRecording = useCallback(async () => {
    if (!recorderRef.current || !initialCircuitRef.current) {
      console.warn('No recording to verify');
      return;
    }

    const eventLog = recorderRef.current.getLog();
    const engineFactory = (circuit: Circuit) => new LogicEngine(circuit);

    const result = await verifyReplay(initialCircuitRef.current, eventLog, { engineFactory });
    setVerificationResult(result);
  }, []);

  const reset = useCallback(() => {
    recorderRef.current = null;
    initialCircuitRef.current = null;
    setIsRecording(false);
    setVerificationResult(null);
    setCurrentSnapshot(null);
  }, []);

  // Time travel navigation callbacks
  const initializeTimeTravel = useCallback(() => {
    if (!recorderRef.current || !initialCircuitRef.current) {
      console.warn('No recording available for time travel');
      return;
    }

    const eventLog = recorderRef.current.getLog();
    const engineFactory = (circuit: Circuit) => new LogicEngine(circuit);

    // Initialize at the beginning of the log
    const snapshot = getStateAtIndex(initialCircuitRef.current, eventLog, 0, { engineFactory });
    setCurrentSnapshot(snapshot);
  }, []);

  const stepForwardInTime = useCallback(() => {
    if (!currentSnapshot || !recorderRef.current || !initialCircuitRef.current) {
      return;
    }

    const eventLog = recorderRef.current.getLog();
    const engineFactory = (circuit: Circuit) => new LogicEngine(circuit);

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
    const engineFactory = (circuit: Circuit) => new LogicEngine(circuit);

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

  return {
    isRecording,
    verificationResult,
    currentSnapshot,
    startRecording,
    stopRecording,
    recordInputToggled,
    recordSimulationTick,
    verifyRecording,
    reset,
    initializeTimeTravel,
    stepForwardInTime,
    stepBackwardInTime,
    canNavigateForward,
    canNavigateBackward,
    exportLog,
  };
}
