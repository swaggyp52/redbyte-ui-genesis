// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useState } from 'react';
import { LAB_CATALOG, type LabDefinition } from '@redbyte/rb-apps';
import styles from './HomeScreen.module.css';

export interface HomeScreenProps {
  onOpenApp: (appId: string, props?: any) => void;
  onOpenExample?: (exampleId: string) => void;
  determinismMode?: string;
  tickCount?: number;
  isRecording?: boolean;
  hasRecording?: boolean;
  logEntryCount?: number;
  hasProofPack?: boolean;
  verificationStatus?: 'pass' | 'fail';
}

const LABS: LabDefinition[] = LAB_CATALOG;

interface LabCardProps {
  lab: LabDefinition;
  index: number;
  onOpen: (lab: LabDefinition) => void;
  visible: boolean;
}

const LabCard: React.FC<LabCardProps> = ({ lab, index, onOpen, visible }) => {
  return (
    <div
      className={[
        styles.labCard,
        styles['labCard--available'],
        visible ? styles.labCardVisible : '',
      ].join(' ')}
      style={{ '--card-index': index } as React.CSSProperties}
      data-status="available"
    >
      <div className={styles.labCardHeader}>
        <span className={styles.labNumber}>{lab.number}</span>
        <span className={[styles.statusBadge, styles['statusBadge--available']].join(' ')}>
          Template
        </span>
      </div>

      <h3 className={styles.labTitle}>{lab.title}</h3>
      <p className={styles.labDescription}>{lab.description}</p>
      <div className={styles.labTags}>
        {lab.tags.map((tag) => (
          <span key={tag} className={styles.labTag}>{tag}</span>
        ))}
      </div>
      <div className={styles.labCardFooter}>
        <span className={styles.labTime}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
            <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {lab.timeEstimate}
        </span>

        <button
          type="button"
          className={styles.openLabBtn}
          onClick={() => onOpen(lab)}
          aria-label={`Load Lab ${lab.number} template`}
        >
          Load Template
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenApp }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleOpenLab = (lab: LabDefinition) => {
    onOpenApp(lab.appId, {
      labId: lab.id,
      ...(lab.starterInstructions ? { starterInstructions: lab.starterInstructions } : {}),
    });
  };

  return (
    <div className={[styles.root, visible ? styles.rootVisible : ''].join(' ')}>
      {/* Scanline overlay */}
      <div className={styles.scanlines} aria-hidden="true" />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkRed}>RED</span>
            <span className={styles.wordmarkWhite}>BYTE</span>
          </div>
          <div className={styles.headerDivider} aria-hidden="true" />
          <div className={styles.courseInfo}>
            <span className={styles.courseCode}>ECE348 / GECE598</span>
            <span className={styles.courseName}>Digital Logic Laboratory</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.progressPill}>
            <span className={styles.progressCount}>{LABS.length}</span>
            <span className={styles.progressLabel}>TEMPLATES</span>
          </div>
        </div>
      </header>

      {/* Grid background */}
      <div className={styles.gridBg} aria-hidden="true" />

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.sectionLabel}>
          <span className={styles.sectionLine} aria-hidden="true" />
          <span className={styles.sectionText}>TEMPLATE LIBRARY</span>
          <span className={styles.sectionLine} aria-hidden="true" />
        </div>

        <div className={styles.labGrid}>
          {LABS.map((lab, i) => (
            <LabCard
              key={lab.id}
              lab={lab}
              index={i}
              onOpen={handleOpenLab}
              visible={visible}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles.footerItem}>Basys3 · VHDL</span>
        <span className={styles.footerDot} aria-hidden="true" />
        <span className={styles.footerItem}>Powered by RedByte v0.9</span>
        <span className={styles.footerDot} aria-hidden="true" />
        <span className={styles.footerItem}>Xilinx Vivado Target</span>
      </footer>
    </div>
  );
};
