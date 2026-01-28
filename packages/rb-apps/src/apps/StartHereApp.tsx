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
    onOpenApp?.('ece-lab', { initialTab: 'hardware', simGuide: true });
  };

  const handleOpenVirtualLab = () => {
    onOpenApp?.('virtual-lab', {});
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
          <div className={styles.cardTitle}>Logic Playground</div>
          <p className={styles.cardBody}>
            2D digital circuits — drag gates, wires. Best for logic design and truth tables.
          </p>
          <div className={styles.cardAction}>Open Playground</div>
        </button>

        <button type="button" className={styles.card} onClick={handleOpenVirtualLab}>
          <div className={styles.cardTitle}>Virtual Lab</div>
          <p className={styles.cardBody}>3D bench — MCU + wiring + scope + serial. Export lab capsules.</p>
          <div className={styles.cardAction}>Open Virtual Lab</div>
        </button>

        <button type="button" className={styles.card} onClick={handleOpenLab}>
          <div className={styles.cardTitle}>Lab Assignment</div>
          <p className={styles.cardBody}>Course lab wrapper — pick template, run vectors, submit capsule.</p>
          <div className={styles.cardAction}>Open Lab Assignment</div>
        </button>
      </div>

      {/* Lab Map Section */}
      <section className={styles.labMapSection}>
        <h2 className={styles.labMapTitle}>Lab Map</h2>
        <ul className={styles.labMapList}>
          <li><strong>Logic Playground</strong> — 2D circuits + truth tables + replay</li>
          <li><strong>Virtual Lab</strong> — 3D bench + MCU sketch + instruments + capsule export</li>
          <li><strong>Lab Assignment</strong> — Course lab wrapper + template + submit</li>
          <li><strong>Lab Examiner</strong> — Read-only inspection + integrity verification</li>
        </ul>
        <p className={styles.labMapFiles}>
          <code>.labcapsule.json</code> = evidence capsule
        </p>
      </section>
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
