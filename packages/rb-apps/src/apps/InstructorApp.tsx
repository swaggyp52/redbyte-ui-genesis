// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState, useCallback } from 'react';
import type { RedByteApp } from '../types';
import styles from './InstructorApp.module.css';
import { fetchLabRuns } from '../services/opsClient';
import { InstructorRunDetailAppContent } from './InstructorRunDetailApp';

interface LabRun {
  run_id: string;
  created_at?: string;
  timestamp?: string; // legacy/back-compat
  student_id?: string;
  lab_id?: string;
  verdict?: 'PASS' | 'FAIL' | 'INVALID' | 'UNKNOWN';
  exit_code?: number;
}

interface InstructorAppProps {
  onNavigate?: (appId: string, props?: any) => void;
}

export const InstructorAppContent: React.FC<InstructorAppProps> = ({ onNavigate }) => {
  const [runs, setRuns] = useState<LabRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    fetchLabRuns()
      .then((data) => {
        setRuns(data as LabRun[]);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch runs:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  const handleRunClick = useCallback((runId: string) => {
    setSelectedRunId(runId);
  }, []);

  const handleBackToRuns = useCallback(() => {
    setSelectedRunId(null);
  }, []);

  const getBadgeClass = (verdict?: string) => {
    if (verdict === 'PASS') return styles.badgePass;
    if (verdict === 'FAIL') return styles.badgeFail;
    if (verdict === 'INVALID') return styles.badgeInvalid;
    return styles.badgeUnknown;
  };

  // ── Run Detail (inline view) ──────────────────────────────────────
  if (selectedRunId) {
    return (
      <InstructorRunDetailAppContent
        runId={selectedRunId}
        onNavigate={(_appId, _props) => {
          // "Back to Runs" from RunDetail navigates back to the runs list
          handleBackToRuns();
        }}
      />
    );
  }

  // ── Runs List (dashboard) ─────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading runs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Instructor Dashboard</h1>
        <p className={styles.subtitle}>
          {runs.length} {runs.length === 1 ? 'submission' : 'submissions'} ingested
        </p>
      </div>

      {runs.length === 0 ? (
        <div className={styles.empty}>
          No lab runs yet. Students must export submissions, then ops must ingest them.
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Student</th>
                <th>Lab</th>
                <th>Verdict</th>
                <th>Exit Code</th>
                <th>Run ID</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.run_id}
                  className={styles.row}
                  onClick={() => handleRunClick(run.run_id)}
                  data-testid={`run-row-${run.run_id}`}
                >
                  <td>{run.created_at || run.timestamp ? new Date(run.created_at || run.timestamp!).toLocaleString() : '—'}</td>
                  <td>{run.student_id || '—'}</td>
                  <td>{run.lab_id || '—'}</td>
                  <td>
                    <span className={getBadgeClass(run.verdict)}>
                      {run.verdict || '—'}
                    </span>
                  </td>
                  <td>{run.exit_code !== undefined ? run.exit_code : '—'}</td>
                  <td className={styles.runId}>{run.run_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const InstructorApp: RedByteApp = {
  manifest: {
    id: 'instructor',
    name: 'Instructor Dashboard',
    iconId: 'grid',
    singleton: true,
    defaultSize: {
      width: 1000,
      height: 700,
    },
  },
  component: InstructorAppContent,
};
