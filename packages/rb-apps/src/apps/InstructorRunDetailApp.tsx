// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import type { RedByteApp } from '../types';
import styles from './InstructorRunDetailApp.module.css';
import { useRenderStormDetector } from '../hooks/useRenderStormDetector';

const OPS_SERVER = 'http://127.0.0.1:3001';

interface VectorResult {
  name: string;
  result: 'PASS' | 'FAIL' | string;
  inputs?: Record<string, number>;
  expected?: string;
  observed?: string;
}

interface RunDetail {
  run_id: string;
  created_at?: string;
  timestamp?: string; // legacy/back-compat
  student_id?: string;
  lab_id?: string;
  verdict?: 'PASS' | 'FAIL' | 'INVALID' | 'UNKNOWN';
  exit_code?: number;
  grade_json?: any;
  grade_md?: string;
  summary?: {
    passed?: number;
    failed?: number;
    total?: number;
  };
  results?: VectorResult[];
  artifacts?: {
    'grade.json'?: string;
    'grade.md'?: string;
    'capsule.json'?: string;
    'events.ndjson'?: string;
  };
}

interface InstructorRunDetailAppProps {
  runId?: string;
  onNavigate?: (appId: string, props?: any) => void;
}

export const InstructorRunDetailAppContent: React.FC<InstructorRunDetailAppProps> = ({ runId, onNavigate }) => {
  useRenderStormDetector('InstructorRunDetailAppContent');
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'vectors' | 'artifacts'>('summary');

  useEffect(() => {
    if (!runId) {
      setError('No run ID provided');
      setLoading(false);
      return;
    }

    setError(null);

    fetch(`${OPS_SERVER}/api/labs/runs/${runId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        const inferredArtifacts: NonNullable<RunDetail['artifacts']> = {
          'grade.json': `${OPS_SERVER}/api/labs/runs/${runId}/artifacts/grade.json`,
          'grade.md': `${OPS_SERVER}/api/labs/runs/${runId}/artifacts/grade.md`,
          'capsule.json': `${OPS_SERVER}/api/labs/runs/${runId}/artifacts/capsule.json`,
          'events.ndjson': `${OPS_SERVER}/api/labs/runs/${runId}/artifacts/events.ndjson`,
        };

        const normalized: RunDetail = {
          ...(data || {}),
          timestamp: data?.timestamp ?? data?.created_at,
          exit_code: data?.exit_code ?? data?.grade_json?.exit_code,
          artifacts: data?.artifacts ?? inferredArtifacts,
        };

        setDetail(normalized);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch run detail:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [runId]);

  const handleBack = () => {
    onNavigate?.('instructor');
  };

  const getBadgeClass = (verdict?: string) => {
    if (verdict === 'PASS') return styles.badgePass;
    if (verdict === 'FAIL') return styles.badgeFail;
    if (verdict === 'INVALID') return styles.badgeInvalid;
    return styles.badgeUnknown;
  };

  const getResultBadgeClass = (result: string) => {
    if (result === 'PASS') return styles.resultPass;
    if (result === 'FAIL') return styles.resultFail;
    return styles.resultUnknown;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading run details...</div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={styles.container}>
        <button onClick={handleBack} className={styles.backButton}>
          ← Back to Runs
        </button>
        <div className={styles.error}>
          <strong>Error:</strong> {error || 'Run not found'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button onClick={handleBack} className={styles.backButton}>
        ← Back to Runs
      </button>

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Run: {detail.run_id.slice(0, 12)}</h1>
          <span className={getBadgeClass(detail.verdict)}>
            {detail.verdict || 'UNKNOWN'}
          </span>
        </div>
        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Student:</span>
            <span className={styles.metaValue}>{detail.student_id || '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Lab:</span>
            <span className={styles.metaValue}>{detail.lab_id || '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Time:</span>
            <span className={styles.metaValue}>{detail.created_at || detail.timestamp ? new Date(detail.created_at || detail.timestamp).toLocaleString() : '—'}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Exit Code:</span>
            <span className={styles.metaValue}>{detail.exit_code !== undefined ? detail.exit_code : '—'}</span>
          </div>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'summary' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={activeTab === 'vectors' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('vectors')}
        >
          Vectors ({detail.results?.length || 0})
        </button>
        <button
          className={activeTab === 'artifacts' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('artifacts')}
        >
          Artifacts
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'summary' && (
          <div className={styles.summarySection}>
            {detail.grade_md && detail.grade_md.trim().length > 0 ? (
              <div className={styles.vectorCard}>
                <div className={styles.vectorValue} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {detail.grade_md}
                </div>
              </div>
            ) : detail.summary ? (
              <div className={styles.summaryCards}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Passed</div>
                  <div className={styles.summaryValuePass}>{detail.summary.passed || 0}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Failed</div>
                  <div className={styles.summaryValueFail}>{detail.summary.failed || 0}</div>
                </div>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>Total</div>
                  <div className={styles.summaryValue}>{detail.summary.total || 0}</div>
                </div>
              </div>
            ) : (
              <div className={styles.empty}>No grade report available</div>
            )}
          </div>
        )}

        {activeTab === 'vectors' && (
          <div className={styles.vectorsSection}>
            {detail.results && detail.results.length > 0 ? (
              <div className={styles.vectorsList}>
                {detail.results.map((vec, idx) => (
                  <div key={idx} className={styles.vectorCard}>
                    <div className={styles.vectorHeader}>
                      <span className={styles.vectorName}>{vec.name}</span>
                      <span className={getResultBadgeClass(vec.result)}>{vec.result}</span>
                    </div>
                    {vec.inputs && (
                      <div className={styles.vectorDetail}>
                        <span className={styles.vectorLabel}>Inputs:</span>
                        <span className={styles.vectorValue}>
                          {Object.entries(vec.inputs).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </span>
                      </div>
                    )}
                    {vec.expected && (
                      <div className={styles.vectorDetail}>
                        <span className={styles.vectorLabel}>Expected:</span>
                        <span className={styles.vectorValue}>{vec.expected}</span>
                      </div>
                    )}
                    {vec.observed && (
                      <div className={styles.vectorDetail}>
                        <span className={styles.vectorLabel}>Observed:</span>
                        <span className={styles.vectorValue}>{vec.observed}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No vector results available</div>
            )}
          </div>
        )}

        {activeTab === 'artifacts' && (
          <div className={styles.artifactsSection}>
            {detail.artifacts && Object.keys(detail.artifacts).length > 0 ? (
              <div className={styles.artifactsList}>
                {Object.entries(detail.artifacts).map(([name, url]) => (
                  <div key={name} className={styles.artifactCard}>
                    <span className={styles.artifactName}>{name}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.artifactLink}
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No artifacts available</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const InstructorRunDetailApp: RedByteApp = {
  manifest: {
    id: 'instructor-run-detail',
    name: 'Run Detail',
    iconId: 'file-text',
    singleton: false,
    defaultSize: {
      width: 800,
      height: 700,
    },
  },
  component: InstructorRunDetailAppContent,
};
