// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { RedByteApp } from '../types';
import styles from './StartHereApp.module.css';

interface StartHereAppProps {
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
}

export const StartHereAppContent: React.FC<StartHereAppProps> = ({ onOpenApp }) => {
  const playgroundExampleId = '04_4bit-counter';

  const handleOpenPlayground = () => {
    onOpenApp?.('logic-playground', { initialExampleId: playgroundExampleId });
  };

  const handleOpenLab = () => {
    onOpenApp?.('student-lab', { initialTab: 'hardware', simGuide: true });
  };

  const handleOpenInspector = () => {
    onOpenApp?.('submission-inspector', { loadSample: true });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Start Here</h1>
        <p className={styles.subtitle}>
          Three quick paths to see RedByte working end to end.
        </p>
      </header>

      <div className={styles.grid}>
        <button type="button" className={styles.card} onClick={handleOpenPlayground}>
          <div className={styles.cardTitle}>Try Logic Playground (Simulation)</div>
          <p className={styles.cardBody}>
            Build and simulate logic instantly -- no hardware required. Loads the 4-bit counter example.
          </p>
          <div className={styles.cardAction}>Open Playground</div>
        </button>

        <button type="button" className={styles.card} onClick={handleOpenLab}>
          <div className={styles.cardTitle}>Try FPGA Lab (SIM Mode)</div>
          <p className={styles.cardBody}>See the FPGA lab workflow using simulated hardware data.</p>
          <div className={styles.cardAction}>Open Lab Workbench</div>
        </button>

        <button type="button" className={styles.card} onClick={handleOpenInspector}>
          <div className={styles.cardTitle}>Grade a Sample Submission</div>
          <p className={styles.cardBody}>Replay a real submission, verify integrity, and export a grading report.</p>
          <div className={styles.cardAction}>Open Submission Inspector</div>
        </button>
      </div>
    </div>
  );
};

export const StartHereApp: RedByteApp = {
  manifest: {
    id: 'start-here',
    name: 'Start Here',
    iconId: 'cpu',
    category: 'system',
    defaultSize: {
      width: 720,
      height: 520,
    },
  },
  component: StartHereAppContent,
};
