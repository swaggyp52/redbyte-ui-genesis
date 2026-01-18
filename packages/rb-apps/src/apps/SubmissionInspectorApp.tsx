// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useRef } from 'react';
import type { RedByteApp } from '../types';
import styles from './SubmissionInspectorApp.module.css';
import JSZip from 'jszip';

interface BundleData {
  manifest: Record<string, any>;
  capsule: Record<string, any>;
  events: Array<Record<string, any>>;
  hardware?: Record<string, any>;
  grade?: {
    json?: Record<string, any>;
    md?: string;
  };
}

interface InspectorProps {
  // Props injected by shell if opening with file
  filePath?: string;
}

export const SubmissionInspectorAppContent: React.FC<InspectorProps> = () => {
  const [bundle, setBundle] = useState<BundleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'vectors' | 'events' | 'hardware' | 'files'>('summary');
  const [demoMode, setDemoMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseBundle = async (zipFile: File) => {
    setLoading(true);
    setError(null);
    
    try {
      const zip = new JSZip();
      const loaded = await zip.loadAsync(zipFile);

      // Parse manifest
      const manifestFile = loaded.file('manifest.json');
      if (!manifestFile) throw new Error('manifest.json not found');
      const manifest = JSON.parse(await manifestFile.async('string'));

      // Parse capsule
      const capsuleFile = loaded.file('proofs/capsule.json');
      const capsule = capsuleFile ? JSON.parse(await capsuleFile.async('string')) : null;

      // Parse events (NDJSON)
      const eventsFile = loaded.file('proofs/events.ndjson');
      const events = eventsFile
        ? (await eventsFile.async('string'))
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => JSON.parse(line))
        : [];

      // Parse hardware if present
      const hardwareFile = loaded.file('proofs/hardware.json');
      const hardware = hardwareFile ? JSON.parse(await hardwareFile.async('string')) : null;

      // Parse grade artifacts if present
      const gradeJsonFile = loaded.file('grade.json');
      const gradeMdFile = loaded.file('grade.md');
      const grade = {
        json: gradeJsonFile ? JSON.parse(await gradeJsonFile.async('string')) : null,
        md: gradeMdFile ? await gradeMdFile.async('string') : null,
      };

      setBundle({
        manifest,
        capsule,
        events,
        hardware,
        grade,
      });
      setActiveTab('summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse bundle');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      parseBundle(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.style.background = 'rgba(0, 135, 255, 0.1)';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.style.background = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.style.background = '';
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.rb-lab.zip')) {
      parseBundle(file);
    }
  };

  if (!bundle) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Submission Inspector</h1>
          <p className={styles.subtitle}>Open a .rb-lab.zip bundle to inspect student submissions</p>
        </div>

        <div
          className={styles.dropZone}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className={styles.dropZoneIcon}>📦</div>
          <div className={styles.dropZoneTitle}>Drop .rb-lab.zip file here</div>
          <div className={styles.dropZoneOr}>or</div>
          <button
            className={styles.browseButton}
            onClick={() => fileInputRef.current?.click()}
          >
            Browse for File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".rb-lab.zip"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {error && (
          <div className={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading && (
          <div className={styles.loading}>Loading bundle...</div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Submission Inspector</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={styles.closeButton}
            onClick={() => {
              setBundle(null);
              setError(null);
              setDemoMode(false);
            }}
          >
            ← Open Another
          </button>
          <button
            className={styles.closeButton}
            onClick={() => setDemoMode(!demoMode)}
            style={{
              background: demoMode ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              borderColor: demoMode ? 'rgba(34, 211, 238, 0.5)' : 'rgba(255, 255, 255, 0.1)',
              color: demoMode ? '#22d3ee' : '#94a3b8',
            }}
          >
            {demoMode ? '✓ Demo Mode' : 'Demo Mode'}
          </button>
        </div>
      </div>

      {demoMode ? (
        // Demo Mode: Presentation layout
        <div className={styles.demoModeContainer}>
          <div className={styles.demoVerdictSection}>
            <div className={styles.demoVerdictBadge} style={{
              background: bundle.capsule?.summary?.all_passed 
                ? 'rgba(16, 185, 129, 0.2)' 
                : 'rgba(239, 68, 68, 0.2)',
              borderColor: bundle.capsule?.summary?.all_passed 
                ? 'rgba(16, 185, 129, 0.5)' 
                : 'rgba(239, 68, 68, 0.5)',
              color: bundle.capsule?.summary?.all_passed ? '#10b981' : '#ef4444',
            }}>
              {bundle.capsule?.summary?.all_passed ? 'PASS' : 'FAIL'}
            </div>
          </div>

          <div className={styles.demoHeader}>
            <div>
              <h2 className={styles.demoTitle}>{bundle.manifest.student?.name || 'Unknown Student'}</h2>
              <p className={styles.demoSubtitle}>{bundle.manifest.lab_id}</p>
            </div>
            <div className={styles.demoStats}>
              <div className={styles.demoStat}>
                <span className={styles.demoStatLabel}>Passed</span>
                <span className={styles.demoStatValue} style={{ color: '#10b981' }}>
                  {bundle.capsule?.summary?.passed || 0}
                </span>
              </div>
              <div className={styles.demoStat}>
                <span className={styles.demoStatLabel}>Failed</span>
                <span className={styles.demoStatValue} style={{ color: '#ef4444' }}>
                  {bundle.capsule?.summary?.failed || 0}
                </span>
              </div>
              <div className={styles.demoStat}>
                <span className={styles.demoStatLabel}>Total</span>
                <span className={styles.demoStatValue}>{bundle.capsule?.summary?.total || 0}</span>
              </div>
            </div>
          </div>

          <div className={styles.demoContent}>
            <div className={styles.demoVectors}>
              <h3>Test Vectors</h3>
              <div className={styles.demoVectorsList}>
                {bundle.capsule?.vectors?.map((vec: any, idx: number) => (
                  <div key={idx} className={styles.demoVectorRow}>
                    <span className={styles.demoVectorName}>{vec.name}</span>
                    <span className={`${styles.demoVectorResult} ${vec.pass ? styles.demoResultPass : styles.demoResultFail}`}>
                      {vec.pass ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                )) || <div className={styles.demoEmpty}>No vectors</div>}
              </div>
            </div>

            {bundle.hardware && (
              <div className={styles.demoHardware}>
                <h3>Hardware Snapshots</h3>
                <div className={styles.demoSnapshotGallery}>
                  {bundle.hardware.snapshots?.map((snap: any, idx: number) => (
                    <div key={idx} className={styles.demoSnapshotTile}>
                      <div className={styles.demoSnapshotTime}>{snap.timestamp}</div>
                      <div className={styles.demoSnapshotData}>
                        <div><strong>In:</strong> {JSON.stringify(snap.inputs)}</div>
                        <div><strong>Out:</strong> {JSON.stringify(snap.outputs)}</div>
                      </div>
                    </div>
                  )) || <div className={styles.demoEmpty}>No snapshots</div>}
                </div>
              </div>
            )}

            <div className={styles.demoEvents}>
              <h3>Timeline</h3>
              <div className={styles.demoEventsList}>
                {bundle.events?.slice(0, 10).map((event: any, idx: number) => (
                  <div key={idx} className={styles.demoEventRow}>
                    <span className={styles.demoEventTime}>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    <span className={styles.demoEventType}>{event.type}</span>
                  </div>
                )) || <div className={styles.demoEmpty}>No events</div>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Normal Mode: Tabs
        <>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'vectors' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('vectors')}
        >
          Vectors ({bundle.capsule?.vectors?.length || 0})
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'events' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Events ({bundle.events.length})
        </button>
        {bundle.hardware && (
          <button
            className={`${styles.tab} ${activeTab === 'hardware' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('hardware')}
          >
            Hardware ({bundle.hardware.snapshots?.length || 0})
          </button>
        )}
        <button
          className={`${styles.tab} ${activeTab === 'files' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
      </div>

      <div className={styles.content}>
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Submission Summary</h2>
            
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Lab ID</div>
                <div className={styles.summaryValue}>{bundle.manifest.lab_id}</div>
              </div>

              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Student</div>
                <div className={styles.summaryValue}>{bundle.manifest.student?.name || 'Unknown'}</div>
              </div>

              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Student ID</div>
                <div className={styles.summaryValue}>{bundle.manifest.student?.id || '—'}</div>
              </div>

              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Created</div>
                <div className={styles.summaryValue}>
                  {new Date(bundle.manifest.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            {bundle.capsule && (
              <div className={styles.summarySection}>
                <h3>Self-Check Summary</h3>
                <div className={styles.summaryStats}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Passed</span>
                    <span className={styles.statValue} style={{ color: '#10b981' }}>
                      {bundle.capsule.summary?.passed || 0}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Failed</span>
                    <span className={styles.statValue} style={{ color: '#ef4444' }}>
                      {bundle.capsule.summary?.failed || 0}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Total</span>
                    <span className={styles.statValue}>{bundle.capsule.summary?.total || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {bundle.grade?.json && (
              <div className={styles.summarySection}>
                <h3>Grade</h3>
                <pre className={styles.codeBlock}>{JSON.stringify(bundle.grade.json, null, 2)}</pre>
              </div>
            )}

            {bundle.grade?.md && (
              <div className={styles.summarySection}>
                <h3>Grade Details</h3>
                <pre className={styles.codeBlock}>{bundle.grade.md}</pre>
              </div>
            )}
          </div>
        )}

        {/* Vectors Tab */}
        {activeTab === 'vectors' && (
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Test Vectors</h2>
            {bundle.capsule?.vectors && bundle.capsule.vectors.length > 0 ? (
              <div className={styles.vectorsList}>
                {bundle.capsule.vectors.map((vec: any, idx: number) => (
                  <div key={idx} className={styles.vectorCard}>
                    <div className={styles.vectorHeader}>
                      <span className={styles.vectorName}>{vec.name}</span>
                      <span className={`${styles.vectorBadge} ${vec.pass ? styles.badgePass : styles.badgeFail}`}>
                        {vec.pass ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    {vec.error && (
                      <div className={styles.vectorError}>{vec.error}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No vectors in this submission</div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Event Timeline</h2>
            {bundle.events.length > 0 ? (
              <div className={styles.eventsList}>
                {bundle.events.map((event: any, idx: number) => (
                  <div key={idx} className={styles.eventCard}>
                    <div className={styles.eventTime}>
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={styles.eventType}>{event.type}</div>
                    {Object.keys(event.data || {}).length > 0 && (
                      <pre className={styles.eventData}>{JSON.stringify(event.data, null, 2)}</pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No events recorded</div>
            )}
          </div>
        )}

        {/* Hardware Tab */}
        {activeTab === 'hardware' && (
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Hardware Evidence</h2>
            {bundle.hardware ? (
              <>
                <div className={styles.hardwareInfo}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Bridge Status:</span>
                    <span className={styles.infoValue}>{bundle.hardware.bridge_status}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Board Status:</span>
                    <span className={styles.infoValue}>{bundle.hardware.board_status}</span>
                  </div>
                  {bundle.hardware.board_model && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Board Model:</span>
                      <span className={styles.infoValue}>{bundle.hardware.board_model}</span>
                    </div>
                  )}
                </div>

                {bundle.hardware.snapshots && bundle.hardware.snapshots.length > 0 ? (
                  <div className={styles.snapshotsList}>
                    <h3>Snapshots ({bundle.hardware.snapshots.length})</h3>
                    {bundle.hardware.snapshots.map((snap: any, idx: number) => (
                      <div key={idx} className={styles.snapshotCard}>
                        <div className={styles.snapshotTime}>
                          {new Date(snap.timestamp).toLocaleTimeString()}
                          {snap.source && (
                            <span className={`${styles.snapshotSource} ${snap.source === 'bridge' ? styles.sourceBridge : styles.sourceManual}`}>
                              {snap.source}
                            </span>
                          )}
                        </div>
                        <div className={styles.snapshotData}>
                          <div><strong>Inputs:</strong> <code>{JSON.stringify(snap.inputs)}</code></div>
                          <div><strong>Outputs:</strong> <code>{JSON.stringify(snap.outputs)}</code></div>
                          {snap.notes && <div><strong>Notes:</strong> {snap.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.empty}>No snapshots recorded</div>
                )}
              </>
            ) : (
              <div className={styles.empty}>No hardware evidence in this bundle</div>
            )}
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className={styles.panel}>
            <h2 className={styles.sectionTitle}>Bundle Contents</h2>
            <div className={styles.filesList}>
              <div className={styles.fileItem}>manifest.json</div>
              <div className={styles.fileItem}>proofs/capsule.json</div>
              <div className={styles.fileItem}>proofs/events.ndjson</div>
              {bundle.hardware && <div className={styles.fileItem}>proofs/hardware.json</div>}
              {bundle.grade?.json && <div className={styles.fileItem}>grade.json</div>}
              {bundle.grade?.md && <div className={styles.fileItem}>grade.md</div>}
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export const SubmissionInspectorApp: RedByteApp = {
  manifest: {
    id: 'submission-inspector',
    name: 'Submission Inspector',
    iconId: 'search',
    category: 'tools',
    defaultSize: {
      width: 1000,
      height: 750,
    },
  },
  component: SubmissionInspectorAppContent,
};
