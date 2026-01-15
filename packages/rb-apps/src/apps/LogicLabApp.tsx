// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getGlobalLabSessionStore, 
  evaluateCheckpoint, 
  type CapsuleV1,
  getDefaultLabs,
  type LabDef,
  getBridgeClient,
  type BridgeClient,
  type Circuit,
  getGlobalTickEngine,
} from '@redbyte/rb-logic-core';
import { LogicCanvas, type LogicCanvasProps } from '@redbyte/rb-logic-view';

/**
 * ECE Lab Phase H0.6: LogicLabApp UI Shell
 * 
 * Complete student/instructor lab environment with:
 * - Left panel: instructions + hints
 * - Center panel: editable circuit editor (LogicCanvas)
 * - Right panel: checkpoint status badges
 * - Toolbar: Run Checks, Export, Import buttons
 */
const LogicLabApp = () => {
  const sessionStore = getGlobalLabSessionStore();
  
  // Get current state from store (Zustand allows calling the store as a selector)
  const [sessionState, setSessionState] = useState(sessionStore.getState().state);
  
  // Store methods from Zustand
  const createSession = sessionStore.getState().createSession;
  
  const [isRunning, setIsRunning] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [currentLab, setCurrentLab] = useState<LabDef | null>(null);
  const [labs, setLabs] = useState<LabDef[]>([]);
  const [bridgeClient, setBridgeClient] = useState<BridgeClient | null>(null);

  // H0.7: Circuit editor state and debounce
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tickEngine = getGlobalTickEngine();

  // Load available labs
  useEffect(() => {
    const defaultLabs = getDefaultLabs();
    setLabs(defaultLabs);
    if (defaultLabs.length > 0 && !selectedLabId) {
      setSelectedLabId(defaultLabs[0].id);
    }
  }, [selectedLabId]);

  // Initialize FPGA Bridge connection
  useEffect(() => {
    const initBridge = async () => {
      try {
        const client = getBridgeClient({ url: 'ws://localhost:3001' });
        await client.connect();
        setBridgeClient(client);
        console.log('Connected to FPGA Bridge');
      } catch (error) {
        console.warn('Failed to connect to FPGA Bridge:', error);
        // Graceful fallback: use local evaluator without bridge
      }
    };

    initBridge();

    return () => {
      // Cleanup: disconnect bridge on unmount
      if (bridgeClient && bridgeClient.isConnected()) {
        bridgeClient.disconnect();
      }
    };
  }, [bridgeClient]);

  // Update current lab when selection changes
  useEffect(() => {
    if (selectedLabId) {
      const lab = labs.find((l) => l.id === selectedLabId);
      setCurrentLab(lab || null);
    }
  }, [selectedLabId, labs]);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(
      (state) => state.state,
      (newState) => setSessionState(newState)
    );
    return () => unsubscribe();
  }, [sessionStore]);

  // H0.7: Load circuit from session store when it changes
  useEffect(() => {
    if (sessionState?.currentCircuit) {
      try {
        // Safe parse: currentCircuit is stored as JSON string
        const parsedCircuit = JSON.parse(sessionState.currentCircuit) as Circuit;
        setCircuit(parsedCircuit);
      } catch (error) {
        console.warn('Failed to parse circuit from session store:', error);
        // Fallback: create empty circuit if parsing fails
        setCircuit({ nodes: [], connections: [] });
      }
    } else {
      // No circuit in store yet; initialize empty
      setCircuit({ nodes: [], connections: [] });
    }
  }, [sessionState?.currentCircuit]);

  // Initialize lab session on mount
  useEffect(() => {
    if (!sessionState || !sessionState.labId) {
      const labToUse = currentLab || labs[0];
      if (labToUse) {
        createSession(labToUse.id);
      }
    }
  }, [sessionState?.labId, createSession, currentLab, labs]);

  // H0.7: Handle circuit changes from LogicCanvas with debounce
  const handleCircuitChange = useCallback((updatedCircuit: Circuit) => {
    // Update local state immediately for UI responsiveness
    setCircuit(updatedCircuit);

    // Debounce the store update (500ms)
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        // Persist to session store as JSON string
        const circuitJson = JSON.stringify(updatedCircuit);
        sessionStore.getState().setCircuit(circuitJson);
        console.log('Circuit persisted to session store');
      } catch (error) {
        console.error('Failed to persist circuit to session store:', error);
      }
    }, 500); // 500ms debounce
  }, [sessionStore]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Handle Run Checks button
  const handleRunChecks = useCallback(async () => {
    setIsRunning(true);
    try {
      if (!currentLab) {
        console.warn('No lab selected');
        return;
      }

      console.log(`Running checks for: ${currentLab.name}`);

      // Evaluate each checkpoint
      for (const checkpoint of currentLab.checkpoints) {
        try {
          let result;

          // Prefer bridge evaluation if connected, fallback to local
          if (bridgeClient && bridgeClient.isConnected()) {
            console.log(`[Bridge] Evaluating checkpoint: ${checkpoint.id}`);
            result = await bridgeClient.evaluateCheckpoint(
              currentLab.circuit,
              checkpoint
            );
          } else {
            console.log(`[Local] Evaluating checkpoint: ${checkpoint.id}`);
            result = evaluateCheckpoint(currentLab.circuit, checkpoint);
          }

          // Store result in session
          sessionStore.getState().setCheckpointResult(checkpoint.id, result);
          
          console.log(`Checkpoint ${checkpoint.id}: ${result.passed ? 'PASS' : 'FAIL'}`);
        } catch (error) {
          console.error(`Error evaluating checkpoint ${checkpoint.id}:`, error);
        }
      }
    } finally {
      setIsRunning(false);
    }
  }, [currentLab, bridgeClient, sessionStore]);

  // Handle Export button
  const handleExport = useCallback(() => {
    if (!sessionState) return;

    const capsule: CapsuleV1 = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: sessionState.labId,
      studentName: sessionState.studentName || 'Student',
      timestamp: Date.now(),
      circuitSnapshot: sessionState.currentCircuit as any,
      checkpointResults: Object.values(sessionState.checkpointResults),
    };

    const json = JSON.stringify(capsule, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = `${sessionState.labId}-${sessionState.sessionId}-${Date.now()}.rbcapsule`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  }, [sessionState]);

  // Handle Import button
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.rbcapsule,.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const capsule = JSON.parse(event.target.result);
          // TODO: Open ReplayView with capsule (from H0.4)
          console.log('Capsule imported:', capsule);
        } catch (err) {
          alert('Failed to import capsule: ' + (err instanceof Error ? err.message : String(err)));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Save is automatic via Zustand
        console.log('Session saved');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleExport();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleExport]);

  return (
    <main
      data-testid="logic-lab-container"
      style={{
        display: 'grid',
        gridTemplateColumns: '300px 1fr 300px',
        gridTemplateRows: 'auto 1fr',
        height: '100vh',
        gap: '1px',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: '8px',
          padding: '12px',
          backgroundColor: '#222',
          borderBottom: '1px solid #333',
        }}
      >
        <button
          onClick={handleRunChecks}
          disabled={isRunning}
          style={{
            padding: '6px 12px',
            backgroundColor: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          {isRunning ? 'Running...' : 'Run Checks'}
        </button>

        <button
          onClick={handleExport}
          style={{
            padding: '6px 12px',
            backgroundColor: '#006633',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Export
        </button>

        <button
          onClick={handleImport}
          style={{
            padding: '6px 12px',
            backgroundColor: '#663300',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          Import
        </button>

        <div style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.7 }}>
          {currentLab?.name || 'Lab'} • {sessionState?.studentName || 'Student'}
        </div>
      </div>

      {/* Left Panel: Instructions */}
      <div
        data-testid="instructions-panel"
        style={{
          gridColumn: '1',
          gridRow: '2',
          borderRight: '1px solid #333',
          padding: '16px',
          overflowY: 'auto',
          backgroundColor: '#1a1a1a',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Lab Selection</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px', opacity: 0.8 }}>
            Choose a Lab:
          </label>
          <select
            value={selectedLabId || ''}
            onChange={(e) => setSelectedLabId(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              backgroundColor: '#333',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            {labs.map((lab) => (
              <option key={lab.id} value={lab.id}>
                {lab.name}
              </option>
            ))}
          </select>
        </div>

        <hr style={{ borderColor: '#333', marginTop: '16px', marginBottom: '16px' }} />

        <h3 style={{ marginTop: 0 }}>Instructions</h3>
        {currentLab ? (
          <div style={{ fontSize: '12px', lineHeight: '1.5', opacity: 0.85 }}>
            <p style={{ whiteSpace: 'pre-wrap' }}>{currentLab.instructions}</p>
          </div>
        ) : (
          <p style={{ fontSize: '12px', opacity: 0.6 }}>No lab selected</p>
        )}

        <div style={{ marginTop: '24px', fontSize: '11px', opacity: 0.6 }}>
          <p>
            <strong>Keyboard Shortcuts:</strong>
            <br />
            Ctrl+S: Save <br />
            Ctrl+E: Export <br />
          </p>
        </div>
      </div>

      {/* Center Panel: Circuit Editor */}
      <div
        data-testid="circuit-panel"
        style={{
          gridColumn: '2',
          gridRow: '2',
          borderRight: '1px solid #333',
          backgroundColor: '#0a0a0a',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* H0.7: LogicCanvas Integration */}
        {circuit && tickEngine ? (
          <LogicCanvas
            engine={tickEngine}
            circuit={circuit}
            onCircuitChange={handleCircuitChange}
            showToolbar={true}
            width={800}
            height={600}
            isRunning={isRunning}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#666',
              fontSize: '12px',
            }}
          >
            Loading circuit editor...
          </div>
        )}
      </div>

      {/* Right Panel: Checkpoints */}
      <div
        data-testid="checkpoint-panel"
        style={{
          gridColumn: '3',
          gridRow: '2',
          padding: '16px',
          overflowY: 'auto',
          backgroundColor: '#1a1a1a',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Checkpoints</h3>
        {currentLab && currentLab.checkpoints.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentLab.checkpoints.map((checkpoint) => {
              const result = sessionState?.checkpointResults[checkpoint.id];
              const status = result?.status || 'not-attempted';
              const bgColor =
                status === 'passed' ? '#006633' : status === 'failed' ? '#663333' : '#333';

              return (
                <div
                  key={checkpoint.id}
                  data-testid={`checkpoint-${checkpoint.id}`}
                  style={{
                    padding: '8px',
                    backgroundColor: bgColor,
                    borderRadius: '4px',
                    fontSize: '11px',
                    borderLeft: `3px solid ${
                      status === 'passed' ? '#00ff00' : status === 'failed' ? '#ff0000' : '#888'
                    }`,
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                    {checkpoint.name}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: '10px' }}>
                    {status.toUpperCase()} ({checkpoint.testVectors.length} tests)
                  </div>
                  {result?.passedAt && (
                    <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
                      {new Date(result.passedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: '12px', opacity: 0.6 }}>No checkpoints for this lab</p>
        )}
      </div>
    </main>
  );
};

export default LogicLabApp;
