/**
 * Lab Examiner App
 * 
 * UI for instructors to upload student .rb-lab.zip submissions,
 * view grades, and inspect proof artifacts.
 * 
 * Calls local ops server for grading (no logic in browser).
 */

import React, { useState, useCallback, useRef } from 'react';
import styles from './LabExaminerApp.module.css';

interface GradeData {
  run_id: string;
  verdict: 'PASS' | 'FAIL' | 'INVALID' | 'UNKNOWN';
  lab_id: string;
  student_id: string;
  created_at: string;
  grade_json: {
    run_id: string;
    timestamp: string;
    verdict: string;
    details: {
      summary: string;
      details: string;
    };
  };
  grade_md: string;
}

interface Run {
  run_id: string;
  created_at: string;
  verdict: 'PASS' | 'FAIL' | 'INVALID' | 'UNKNOWN';
}

const OPS_SERVER = 'http://127.0.0.1:3001';

const LabExaminerApp: React.FC = () => {
  const [tab, setTab] = useState<'upload' | 'grade' | 'runs'>('upload');
  const [serverStatus, setServerStatus] = useState<'checking' | 'ready' | 'offline'>('checking');
  const [gradeData, setGradeData] = useState<GradeData | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragZoneRef = useRef<HTMLDivElement>(null);

  // Check server status on mount
  React.useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(`${OPS_SERVER}/health`, { mode: 'no-cors' });
        setServerStatus('ready');
      } catch {
        setServerStatus('offline');
      }
    };
    checkServer();
  }, []);

  // Load runs list
  React.useEffect(() => {
    if (tab === 'runs' && serverStatus === 'ready') {
      loadRuns();
    }
  }, [tab, serverStatus]);

  const loadRuns = async () => {
    try {
      const response = await fetch(`${OPS_SERVER}/api/labs/runs`);
      if (!response.ok) throw new Error('Failed to load runs');
      const data = await response.json();
      setRuns(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load runs');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragZoneRef.current) {
      dragZoneRef.current.classList.add(styles.dragging);
    }
  };

  const handleDragLeave = () => {
    if (dragZoneRef.current) {
      dragZoneRef.current.classList.remove(styles.dragging);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragZoneRef.current) {
      dragZoneRef.current.classList.remove(styles.dragging);
    }

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.zip') && !file.name.endsWith('.rb-lab.zip')) {
      setError('Only .zip and .rb-lab.zip files are accepted');
      return;
    }

    setLoading(true);
    setError(null);
    setGradeData(null);

    try {
      const bytes = await file.arrayBuffer();

      const response = await fetch(`${OPS_SERVER}/api/labs/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/zip' },
        body: bytes,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      const result = await response.json();
      const runId = result?.run_id;
      if (!runId || typeof runId !== 'string') {
        throw new Error('Upload succeeded but server did not return a run_id');
      }

      await loadRunDetail(runId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const loadRunDetail = async (runId: string) => {
    try {
      setError(null);
      const response = await fetch(`${OPS_SERVER}/api/labs/runs/${runId}`);
      if (!response.ok) throw new Error('Failed to load run');
      const data = await response.json();
      setGradeData(data);
      setTab('grade');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Lab Examiner</h1>
        <div className={styles.status}>
          {serverStatus === 'ready' && <span className={styles.statusBadge}>Server Ready</span>}
          {serverStatus === 'offline' && (
            <span className={styles.statusBadge + ' ' + styles.error}>Server Offline (Start with: pnpm ops:server)</span>
          )}
        </div>
      </div>

      {error && <div className={styles.alert + ' ' + styles.error}>{error}</div>}

      <div className={styles.tabs}>
        <button className={tab === 'upload' ? styles.tabActive : ''} onClick={() => setTab('upload')}>
          Upload
        </button>
        {gradeData && (
          <button className={tab === 'grade' ? styles.tabActive : ''} onClick={() => setTab('grade')}>
            Grade
          </button>
        )}
        <button className={tab === 'runs' ? styles.tabActive : ''} onClick={() => setTab('runs')}>
          Runs
        </button>
      </div>

      {tab === 'upload' && (
        <div className={styles.tabContent}>
          {serverStatus === 'offline' ? (
            <div className={styles.alert + ' ' + styles.error}>
              <h3>Ops Server Offline</h3>
              <p>Start the local server first:</p>
              <code>pnpm ops:server</code>
            </div>
          ) : (
            <div>
              <div
                ref={dragZoneRef}
                className={styles.dragZone}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className={styles.dragZoneContent}>
                  <p className={styles.dragZoneText}>Drag and drop .rb-lab.zip here</p>
                  <p className={styles.dragZoneSmall}>or</p>
                  <button
                    className={styles.button}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Select File'}
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.rb-lab.zip"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                title="Select .rb-lab.zip submission file"
              />
            </div>
          )}
        </div>
      )}

      {tab === 'grade' && gradeData && (
        <div className={styles.tabContent}>
          <div className={styles.gradeHeader}>
            <h2>Grade Summary</h2>
            <div className={styles.verdictBadge + ' ' + (gradeData.verdict === 'PASS' ? styles.pass : gradeData.verdict === 'FAIL' ? styles.fail : styles.invalid)}>
              {gradeData.verdict}
            </div>
          </div>

          <div className={styles.metadata}>
            <div className={styles.metadataItem}>
              <strong>Lab:</strong> {gradeData.lab_id}
            </div>
            <div className={styles.metadataItem}>
              <strong>Student:</strong> {gradeData.student_id}
            </div>
            <div className={styles.metadataItem}>
              <strong>Run ID:</strong> {gradeData.run_id}
            </div>
            <div className={styles.metadataItem}>
              <strong>Timestamp:</strong> {new Date(gradeData.created_at).toLocaleString()}
            </div>
          </div>

          <div className={styles.markdownContent}>
            <h3>Details</h3>
            <div className={styles.markdown}>
              {gradeData.grade_md.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'runs' && (
        <div className={styles.tabContent}>
          <h2>Recent Runs</h2>
          {runs.length === 0 ? (
            <p className={styles.empty}>No runs yet.</p>
          ) : (
            <div className={styles.runsList}>
              {runs.map((run) => (
                <div key={run.run_id} className={styles.runItem}>
                  <div className={styles.runInfo}>
                    <div className={styles.runId}>{run.run_id}</div>
                    <div className={styles.runTimestamp}>{new Date(run.created_at).toLocaleString()}</div>
                  </div>
                  <div className={styles.runVerdict + ' ' + (run.verdict === 'PASS' ? styles.pass : run.verdict === 'FAIL' ? styles.fail : styles.invalid)}>
                    {run.verdict}
                  </div>
                  <button className={styles.buttonSmall} onClick={() => loadRunDetail(run.run_id)}>
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LabExaminerApp;
