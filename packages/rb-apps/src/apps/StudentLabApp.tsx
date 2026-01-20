// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useCallback } from 'react';
import type { RedByteApp } from '../types';
import styles from './StudentLabApp.module.css';
import {
  loadPresets,
  runSelfCheckWithPreset,
  type Preset,
  type PresetsFile,
  type SelfCheckResult,
} from '../utils/selfCheck';
import { exportBundle, downloadBlob, type ExportResult } from '../utils/bundleExport';

// ============================================================================
// Types
// ============================================================================

interface LabSpec {
  lab_id: string;
  title: string;
  description: string;
  constraints?: {
    allowedGates?: string[];
    maxGates?: number;
    requiredInputs?: string[];
    requiredOutputs?: string[];
  };
  studentVectors: Array<{
    id: string;
    name: string;
    inputs: Record<string, number>;
  }>;
}

interface SelfCheckSummary {
  passCount: number;
  totalCount: number;
  lastRunAt: string;
  results: SelfCheckResult[];
}

interface EventEntry {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface AttemptState {
  attemptId: string;
  startedAt: string;
  labId: string;
}

interface HardwareSnapshot {
  timestamp: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  notes?: string;
  source: 'bridge' | 'manual';
}

interface BoardStatus {
  connected: boolean;
  model?: string;
  lastSeen?: string;
}

interface BridgeStatus {
  online: boolean;
  lastChecked: string;
}

// ============================================================================
// Hardcoded Lab List (expand as specs are added)
// ============================================================================

const AVAILABLE_LABS: Array<{ lab_id: string; title: string; description: string }> = [
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

function loadStudentIdentity(): { name: string; id: string } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_STUDENT);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveStudentIdentity(name: string, id: string): void {
  localStorage.setItem(STORAGE_KEY_STUDENT, JSON.stringify({ name, id }));
}

function generateStudentId(): string {
  return `student-${Date.now().toString(36)}`;
}

// ============================================================================
// Main Component
// ============================================================================

const StudentLabAppContent = () => {
  // App phase: 'select' | 'attempt' | 'exported'
  const [phase, setPhase] = useState<'select' | 'attempt' | 'exported'>('select');

  // Student identity
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');

  // Lab selection
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  // Attempt state
  const [attempt, setAttempt] = useState<AttemptState | null>(null);

  // Lab spec (loaded after attempt starts)
  const [spec, setSpec] = useState<LabSpec | null>(null);
  const [specLoading, setSpecLoading] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);

  // Self-check state
  const [selfCheckSummary, setSelfCheckSummary] = useState<SelfCheckSummary | null>(null);

  // Presets state (Option B: controlled inputs)
  const [presets, setPresets] = useState<PresetsFile | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [presetsLoading, setPresetsLoading] = useState(false);

  // Event log (append-only)
  const [eventLog, setEventLog] = useState<EventEntry[]>([]);

  // Active tab during attempt
  const [activeTab, setActiveTab] = useState<'spec' | 'build' | 'hardware' | 'self-check' | 'export'>('spec');

  // Hardware state
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ online: false, lastChecked: new Date().toISOString() });
  const [boardStatus, setBoardStatus] = useState<BoardStatus>({ connected: false });
  const [snapshots, setSnapshots] = useState<HardwareSnapshot[]>([]);
  const [showManualSnapshotModal, setShowManualSnapshotModal] = useState(false);
  const [manualInputs, setManualInputs] = useState('');
  const [manualOutputs, setManualOutputs] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  // Export state
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // ============================================================================
  // Event Emitter (append-only)
  // ============================================================================

  const emitEvent = useCallback((type: string, data: Record<string, unknown>) => {
    const entry: EventEntry = {
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
    if (phase !== 'attempt') return;

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
        } else {
          setBridgeStatus({ online: false, lastChecked: new Date().toISOString() });
        }
      } catch (err) {
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
      const data: LabSpec = await res.json();
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
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
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
          const snapshot: HardwareSnapshot = {
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
      } catch (err) {
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

      const snapshot: HardwareSnapshot = {
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
    } catch (err) {
      alert('Invalid JSON format. Use {"SW":1,"BTN":0} format.');
    }
  };

  // ============================================================================
  // Self-Check Handler (uses real proof-core grading)
  // ============================================================================

  const handleSelfCheck = () => {
    if (!spec || !selectedPreset) return;

    // Run self-check using the selected preset (real proof-core grading)
    const output = runSelfCheckWithPreset(selectedPreset, spec.lab_id);
    const lastRunAt = new Date().toISOString();

    const summary: SelfCheckSummary = {
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

  const canExport = (): boolean => {
    return !!(
      studentName.trim() &&
      attempt &&
      selectedPreset &&
      selfCheckSummary
    );
  };

  const handleExportClick = () => {
    if (!canExport()) return;
    setShowExportConfirm(true);
  };

  const handleExportConfirm = async () => {
    if (!spec || !attempt || !selfCheckSummary || !selectedPreset) return;

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
        const vector: any = {
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
    } catch (err) {
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

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>RedByte Logic Labs</h1>
          <p className={styles.subtitle}>Build, test, and submit your digital logic designs</p>
        </div>

        <div className={styles.selectContent}>
          {/* Student Identity Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Identity</h2>
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Student Name <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="Enter your name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>
                Student ID <span className={styles.optional}>(auto-generated if blank)</span>
              </label>
              <input
                type="text"
                className={styles.input}
                placeholder="e.g., student-001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
            </div>
          </section>

          {/* Lab Selection Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Choose Your Lab</h2>
            <div className={styles.labGrid}>
              {AVAILABLE_LABS.map((lab) => (
                <button
                  type="button"
                  key={lab.lab_id}
                  className={`${styles.labCard} ${selectedLabId === lab.lab_id ? styles.labCardSelected : ''}`}
                  onClick={() => setSelectedLabId(lab.lab_id)}
                >
                  <div className={styles.labCardTitle}>{lab.title}</div>
                  <div className={styles.labCardId}>{lab.lab_id}</div>
                  <div className={styles.labCardDesc}>{lab.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Start Button */}
          <div className={styles.startSection}>
            {specLoading && <div className={styles.loadingText}>Loading lab...</div>}
            {specError && <div className={styles.errorText}>Error: {specError}</div>}
            <button
              className={`${styles.startButton} ${!canStart ? styles.startButtonDisabled : ''}`}
              onClick={handleStartAttempt}
              disabled={!canStart || specLoading}
            >
              Start Attempt
            </button>
            {!studentName.trim() && (
              <div className={styles.hint}>Please enter your name to continue</div>
            )}
            {studentName.trim() && !selectedLabId && (
              <div className={styles.hint}>Please select a lab to continue</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Exported Phase (Receipt)
  // ============================================================================

  if (phase === 'exported' && exportResult && spec && attempt && selectedPreset && selfCheckSummary) {
    const handleDownloadAgain = () => {
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
      } catch (e) {
        console.error('Failed to copy receipt:', e);
      }
    };

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Submission Receipt</h1>
          <p className={styles.subtitle}>Your lab submission has been exported successfully</p>
        </div>

        <div className={styles.receiptContent}>
          <div className={styles.successIcon}>✓</div>

          {/* Receipt Details */}
          <div className={styles.receiptCard}>
            <div className={styles.receiptSection}>
              <h3 className={styles.receiptSectionTitle}>Lab</h3>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Title:</span>
                <span className={styles.receiptValue}>{spec.title}</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Lab ID:</span>
                <span className={styles.receiptValue}>{spec.lab_id}</span>
              </div>
            </div>

            <div className={styles.receiptSection}>
              <h3 className={styles.receiptSectionTitle}>Student</h3>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Name:</span>
                <span className={styles.receiptValue}>{studentName}</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Student ID:</span>
                <span className={styles.receiptValue}>{studentId}</span>
              </div>
            </div>

            <div className={styles.receiptSection}>
              <h3 className={styles.receiptSectionTitle}>Attempt</h3>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Attempt ID:</span>
                <span className={styles.receiptValue}>{attempt.attemptId}</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Started:</span>
                <span className={styles.receiptValue}>{new Date(attempt.startedAt).toLocaleString()}</span>
              </div>
            </div>

            <div className={styles.receiptSection}>
              <h3 className={styles.receiptSectionTitle}>Self-Check Results</h3>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Passed:</span>
                <span className={styles.receiptValue}>
                  {selfCheckSummary.passCount} / {selfCheckSummary.totalCount}
                </span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Last Run:</span>
                <span className={styles.receiptValue}>{new Date(selfCheckSummary.lastRunAt).toLocaleString()}</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Preset:</span>
                <span className={styles.receiptValue}>{selectedPreset.name}</span>
              </div>
            </div>

            <div className={styles.receiptSection}>
              <h3 className={styles.receiptSectionTitle}>Submission</h3>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Filename:</span>
                <span className={styles.receiptValueMono}>{exportResult.filename}</span>
              </div>
              <div className={styles.receiptRow}>
                <span className={styles.receiptLabel}>Timestamp:</span>
                <span className={styles.receiptValue}>{new Date(exportResult.timestamp).toLocaleString()}</span>
              </div>
              {exportResult.hash && (
                <div className={styles.receiptRow}>
                  <span className={styles.receiptLabel}>SHA-256:</span>
                  <span className={styles.receiptValueMono}>{exportResult.hash}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className={styles.receiptActions}>
            <button type="button" className={styles.receiptActionButton} onClick={handleDownloadAgain}>
              Download Again
            </button>
            <button type="button" className={styles.receiptActionButton} onClick={handleCopyReceipt}>
              Copy Receipt
            </button>
          </div>

          <p className={styles.receiptInstructions}>
            Submit the .rb-lab.zip file to your instructor. Keep this receipt for your records.
          </p>

          <button
            type="button"
            className={styles.newAttemptButton}
            onClick={() => {
              setPhase('select');
              setAttempt(null);
              setSpec(null);
              setSelfCheckSummary(null);
              setEventLog([]);
              setExportResult(null);
              setSelectedLabId(null);
              setSelectedPreset(null);
              setPresets(null);
            }}
          >
            Start New Attempt
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render: Attempt Phase (Main Lab UI)
  // ============================================================================

  if (!spec || !attempt) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const exportDisabledReasons: string[] = [];
  if (!studentName.trim()) exportDisabledReasons.push('Student name is required');
  if (!attempt) exportDisabledReasons.push('Attempt not started');
  if (!selectedPreset) exportDisabledReasons.push('Preset must be selected (Build tab)');
  if (!selfCheckSummary) exportDisabledReasons.push('Self-check must be run at least once');

  // Progress steps
  const steps = [
    { id: 'spec', label: 'Spec', complete: true },
    { id: 'build', label: 'Build', complete: !!selectedPreset },    { id: 'hardware', label: 'Hardware', completed: snapshots.length > 0 },    { id: 'self-check', label: 'Self-Check', complete: !!selfCheckSummary },
    { id: 'export', label: 'Export', complete: false },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === activeTab);

  return (
    <div className={styles.container}>
      {/* Header with attempt info */}
      <div className={styles.header}>
        <h1 className={styles.title}>{spec.title}</h1>
        <div className={styles.attemptInfo}>
          <span className={styles.attemptBadge}>Attempt in progress</span>
          <span className={styles.attemptMeta}>
            ID: {attempt.attemptId} | Started: {new Date(attempt.startedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className={styles.progressBar}>
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className={`${styles.progressStep} ${
              idx === currentStepIndex ? styles.progressStepActive : ''
            } ${step.complete ? styles.progressStepComplete : ''}`}
          >
            <div className={styles.progressStepNumber}>{idx + 1}</div>
            <div className={styles.progressStepLabel}>{step.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'spec' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('spec')}
        >
          1. Spec
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'build' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('build')}
        >
          2. Build
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'hardware' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('hardware')}
        >
          3. Hardware
          {snapshots.length > 0 && (
            <span className={styles.tabBadge}>{snapshots.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'self-check' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('self-check')}
        >
          4. Self-Check
          {selfCheckSummary && (
            <span className={styles.tabBadge}>
              {selfCheckSummary.passCount}/{selfCheckSummary.totalCount}
            </span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'export' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('export')}
        >
          5. Export
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Spec Tab */}
        {activeTab === 'spec' && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Lab Specification</h2>
            <p className={styles.description}>{spec.description}</p>

            {spec.constraints && (
              <div className={styles.constraints}>
                <h3>Constraints</h3>
                {spec.constraints.allowedGates && (
                  <div className={styles.constraint}>
                    <span className={styles.constraintLabel}>Allowed Gates:</span>
                    <span className={styles.constraintValue}>{spec.constraints.allowedGates.join(', ')}</span>
                  </div>
                )}
                {spec.constraints.maxGates && (
                  <div className={styles.constraint}>
                    <span className={styles.constraintLabel}>Max Gates:</span>
                    <span className={styles.constraintValue}>{spec.constraints.maxGates}</span>
                  </div>
                )}
                {spec.constraints.requiredInputs && (
                  <div className={styles.constraint}>
                    <span className={styles.constraintLabel}>Required Inputs:</span>
                    <span className={styles.constraintValue}>{spec.constraints.requiredInputs.join(', ')}</span>
                  </div>
                )}
                {spec.constraints.requiredOutputs && (
                  <div className={styles.constraint}>
                    <span className={styles.constraintLabel}>Required Outputs:</span>
                    <span className={styles.constraintValue}>{spec.constraints.requiredOutputs.join(', ')}</span>
                  </div>
                )}
              </div>
            )}

            <div className={styles.vectors}>
              <h3>Student Test Vectors ({spec.studentVectors.length})</h3>
              {spec.studentVectors.map((vec) => (
                <div key={vec.id} className={styles.vector}>
                  <div className={styles.vectorName}>{vec.name}</div>
                  <div className={styles.vectorInputs}>{JSON.stringify(vec.inputs)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Build Tab - Preset Selector (Option B) */}
        {activeTab === 'build' && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Select Your Implementation</h2>
            <p className={styles.buildInfo}>
              Choose an implementation preset below. Each preset simulates a different circuit design
              with predetermined test results. This allows you to experience the full submission flow.
            </p>

            {presetsLoading && <div className={styles.loadingText}>Loading presets...</div>}

            {!presetsLoading && presets && presets.presets.length > 0 && (
              <div className={styles.presetGrid}>
                {presets.presets.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className={`${styles.presetCard} ${selectedPreset?.id === preset.id ? styles.presetCardSelected : ''}`}
                    onClick={() => {
                      setSelectedPreset(preset);
                      // Clear previous self-check when preset changes
                      setSelfCheckSummary(null);
                      // Emit preset_selected event
                      emitEvent('preset_selected', {
                        lab_id: spec?.lab_id,
                        preset_id: preset.id,
                        preset_name: preset.name,
                      });
                    }}
                  >
                    <div className={styles.presetCardTitle}>{preset.name}</div>
                    <div className={styles.presetCardDesc}>{preset.description}</div>
                    <div className={styles.presetCardVectors}>
                      {preset.vectors.filter((v) => v.pass).length}/{preset.vectors.length} vectors pass
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!presetsLoading && (!presets || presets.presets.length === 0) && (
              <div className={styles.comingSoon}>
                <div className={styles.comingSoonIcon}>🔧</div>
                <div className={styles.comingSoonTitle}>No Presets Available</div>
                <p className={styles.comingSoonText}>
                  No implementation presets are available for this lab.
                  The circuit editor will be integrated in a future release.
                </p>
              </div>
            )}

            {selectedPreset && (
              <div className={styles.selectedPresetInfo}>
                <h3>Selected: {selectedPreset.name}</h3>
                <p>{selectedPreset.description}</p>
                <div className={styles.nextStepHint}>
                  Proceed to the <strong>Self-Check</strong> tab to verify your implementation.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hardware Tab */}
        {activeTab === 'hardware' && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Hardware Session</h2>
            <p className={styles.hardwareInfo}>
              Connect your FPGA board and capture hardware evidence for your submission.
            </p>

            {/* Bridge Status */}
            <div className={styles.hardwareStatus}>
              <div className={styles.statusCard}>
                <div className={styles.statusLabel}>Desktop Bridge</div>
                <div className={`${styles.statusValue} ${bridgeStatus.online ? styles.statusOnline : styles.statusOffline}`}>
                  {bridgeStatus.online ? '● Online' : '○ Offline'}
                </div>
                <div className={styles.statusDetail}>
                  Last checked: {new Date(bridgeStatus.lastChecked).toLocaleTimeString()}
                </div>
                {!bridgeStatus.online && (
                  <div className={styles.statusHint}>
                    Start the Desktop Bridge to enable automatic board detection.
                    <br />
                    <code>node tools/desktop-bridge.js</code>
                  </div>
                )}
              </div>

              <div className={styles.statusCard}>
                <div className={styles.statusLabel}>FPGA Board</div>
                <div className={`${styles.statusValue} ${boardStatus.connected ? styles.statusOnline : styles.statusOffline}`}>
                  {boardStatus.connected ? '● Connected' : '○ Not Connected'}
                </div>
                {boardStatus.model && (
                  <div className={styles.statusDetail}>Model: {boardStatus.model}</div>
                )}
                {boardStatus.lastSeen && (
                  <div className={styles.statusDetail}>
                    Last seen: {new Date(boardStatus.lastSeen).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Capture Snapshot Button */}
            <div className={styles.hardwareActions}>
              <button
                className={styles.captureButton}
                onClick={handleCaptureSnapshot}
              >
                📸 Capture Snapshot
              </button>
              <div className={styles.actionHint}>
                {bridgeStatus.online && boardStatus.connected
                  ? 'Snapshot will capture current board I/O state'
                  : 'Manual entry will be used (no bridge/board detected)'}
              </div>
            </div>

            {/* Snapshots List */}
            <div className={styles.snapshotsList}>
              <h3>Hardware Evidence ({snapshots.length})</h3>
              {snapshots.length === 0 && (
                <div className={styles.emptySnapshots}>
                  No snapshots captured yet. Capture at least one snapshot to include hardware evidence in your submission.
                </div>
              )}
              {snapshots.map((snapshot, idx) => (
                <div key={idx} className={styles.snapshotCard}>
                  <div className={styles.snapshotHeader}>
                    <span className={styles.snapshotTime}>
                      {new Date(snapshot.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`${styles.snapshotSource} ${snapshot.source === 'bridge' ? styles.sourceBridge : styles.sourceManual}`}>
                      {snapshot.source === 'bridge' ? '🔗 Bridge' : '✏️ Manual'}
                    </span>
                  </div>
                  <div className={styles.snapshotData}>
                    <div className={styles.snapshotDataRow}>
                      <span className={styles.snapshotDataLabel}>Inputs:</span>
                      <code className={styles.snapshotDataValue}>{JSON.stringify(snapshot.inputs)}</code>
                    </div>
                    <div className={styles.snapshotDataRow}>
                      <span className={styles.snapshotDataLabel}>Outputs:</span>
                      <code className={styles.snapshotDataValue}>{JSON.stringify(snapshot.outputs)}</code>
                    </div>
                    {snapshot.notes && (
                      <div className={styles.snapshotDataRow}>
                        <span className={styles.snapshotDataLabel}>Notes:</span>
                        <span className={styles.snapshotDataValue}>{snapshot.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Manual Snapshot Modal */}
            {showManualSnapshotModal && (
              <div className={styles.modal}>
                <div className={styles.modalContent}>
                  <h3 className={styles.modalTitle}>Manual Snapshot Entry</h3>
                  <p className={styles.modalInfo}>
                    Enter the observed I/O states from your FPGA board in JSON format.
                  </p>
                  
                  <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Inputs (JSON)</label>
                    <input
                      type="text"
                      className={styles.modalInput}
                      placeholder='{"SW":1,"BTN":0}'
                      value={manualInputs}
                      onChange={(e) => setManualInputs(e.target.value)}
                    />
                  </div>

                  <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Outputs (JSON)</label>
                    <input
                      type="text"
                      className={styles.modalInput}
                      placeholder='{"LED":7}'
                      value={manualOutputs}
                      onChange={(e) => setManualOutputs(e.target.value)}
                    />
                  </div>

                  <div className={styles.modalField}>
                    <label className={styles.modalLabel}>Notes (Optional)</label>
                    <input
                      type="text"
                      className={styles.modalInput}
                      placeholder="Additional observations..."
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                    />
                  </div>

                  <div className={styles.modalActions}>
                    <button
                      className={styles.modalButtonSecondary}
                      onClick={() => setShowManualSnapshotModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.modalButtonPrimary}
                      onClick={handleSaveManualSnapshot}
                    >
                      Save Snapshot
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Self-Check Tab */}
        {activeTab === 'self-check' && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Self-Check (Browser Only)</h2>
            <p className={styles.selfCheckInfo}>
              Run your implementation against the student test vectors to check your progress.
              This check runs locally in your browser and does not submit anything.
            </p>

            {!selectedPreset && (
              <div className={styles.noPresetWarning}>
                Please select an implementation preset in the <strong>Build</strong> tab first.
              </div>
            )}

            <button
              className={`${styles.checkButton} ${!selectedPreset ? styles.checkButtonDisabled : ''}`}
              onClick={handleSelfCheck}
              disabled={!selectedPreset}
            >
              Run Self-Check
            </button>

            {selectedPreset && (
              <div className={styles.presetIndicator}>
                Testing: <strong>{selectedPreset.name}</strong>
              </div>
            )}

            {selfCheckSummary && (
              <div className={styles.selfCheckSummary}>
                <div className={styles.summaryHeader}>
                  <span className={styles.summaryScore}>
                    {selfCheckSummary.passCount} / {selfCheckSummary.totalCount} passed
                  </span>
                  <span className={styles.summaryTime}>
                    Last run: {new Date(selfCheckSummary.lastRunAt).toLocaleString()}
                  </span>
                </div>

                <div className={styles.results}>
                  {selfCheckSummary.results.map((result) => (
                    <div
                      key={result.vectorId}
                      className={`${styles.result} ${result.status === 'PASS' ? styles.resultPass : styles.resultFail}`}
                    >
                      <div className={styles.resultHeader}>
                        <span className={styles.resultName}>{result.vectorName}</span>
                        <span className={`${styles.badge} ${result.status === 'PASS' ? styles.badgePass : styles.badgeFail}`}>
                          {result.status}
                        </span>
                      </div>
                      {result.firstMismatch && (
                        <div className={styles.mismatch}>
                          First mismatch: tick {result.firstMismatch.tick}, signal {result.firstMismatch.signal}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Export Submission</h2>

            {/* Pre-export summary */}
            <div className={styles.exportSummary}>
              <h3>Submission Summary</h3>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Student:</span>
                <span className={styles.summaryValue}>{studentName || '(not set)'}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Student ID:</span>
                <span className={styles.summaryValue}>{studentId}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Lab:</span>
                <span className={styles.summaryValue}>{spec.lab_id}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Self-Check:</span>
                <span className={styles.summaryValue}>
                  {selfCheckSummary
                    ? `${selfCheckSummary.passCount}/${selfCheckSummary.totalCount} passed`
                    : 'Not run yet'}
                </span>
              </div>
            </div>

            {/* Warnings */}
            {selfCheckSummary && selfCheckSummary.passCount < selfCheckSummary.totalCount && (
              <div className={styles.warningBanner}>
                Warning: Not all self-check tests passed ({selfCheckSummary.passCount}/{selfCheckSummary.totalCount}).
                You can still export, but your submission may not receive full credit.
              </div>
            )}

            {/* Export disabled reasons */}
            {exportDisabledReasons.length > 0 && (
              <div className={styles.exportRequirements}>
                <h4>Requirements to export:</h4>
                <ul>
                  {exportDisabledReasons.map((reason, i) => (
                    <li key={i} className={styles.requirementItem}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Export error */}
            {exportError && (
              <div className={styles.errorBanner}>
                Export failed: {exportError}
              </div>
            )}

            {/* Export button */}
            <button
              type="button"
              className={`${styles.exportButton} ${!canExport() ? styles.exportButtonDisabled : ''}`}
              onClick={handleExportClick}
              disabled={!canExport()}
            >
              Export .rb-lab.zip
            </button>

            {/* Confirmation Modal */}
            {showExportConfirm && (
              <div className={styles.modalOverlay}>
                <div className={styles.modal}>
                  <h3 className={styles.modalTitle}>Confirm Export</h3>
                  <p className={styles.modalText}>
                    You are about to export your submission for <strong>{spec.title}</strong> as <strong>{studentName}</strong>.
                  </p>
                  <p className={styles.modalText}>
                    This will download a .rb-lab.zip file that you can submit to your instructor.
                  </p>
                  <div className={styles.modalButtons}>
                    <button type="button" className={styles.modalCancel} onClick={handleExportCancel}>
                      Cancel
                    </button>
                    <button type="button" className={styles.modalConfirm} onClick={handleExportConfirm}>
                      Confirm Export
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const StudentLabApp: RedByteApp = {
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
