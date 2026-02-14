// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
import React from 'react';
import type { DeterminismMode } from './TruthBar';
import styles from './HomeScreen.module.css';

export interface HomeScreenProps {
  onOpenApp: (appId: string, props?: any) => void;
  onOpenExample: (exampleId: string) => void;
  determinismMode: DeterminismMode;
  tickCount: number;
  isRecording: boolean;
  hasRecording: boolean;
  logEntryCount: number;
  hasProofPack: boolean;
  verificationStatus?: 'pass' | 'fail';
}

const PIPELINE_STAGES = ['Build', 'Simulate', 'Hardware', 'Export'] as const;

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenApp }) => {
  return (
    <div className={styles.root} data-testid="home-screen-root">
      <div className={styles.hero}>
        <h1 className={styles.title}>RedByte Studio</h1>
        <p className={styles.subtitle}>Digital Logic Lab Environment</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => onOpenApp('home')}
          >
            Open Dashboard
          </button>
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => onOpenApp('lab-workspace')}
          >
            Open Studio
          </button>
        </div>
      </div>

      <div className={styles.pipeline} aria-label="Studio pipeline">
        {PIPELINE_STAGES.map((stage, index) => (
          <React.Fragment key={stage}>
            <div className={styles.stage}>
              <span className={styles.stageDot} aria-hidden="true" />
              <span className={styles.stageLabel}>{stage}</span>
            </div>
            {index < PIPELINE_STAGES.length - 1 && <span className={styles.stageDivider} aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
