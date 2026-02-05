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
    // Phase 5.1: Direct student to Lab 1 (Intro to Digital Logic) by default
    onOpenApp?.('ece-lab', { labId: 'lab-1', initialTab: 'hardware' });
  };

  const handleOpenVirtualLab = () => {
    onOpenApp?.('ece-lab', {});
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
          <p className={styles.cardBody}>
            Unified lab surface — 2D circuit editor (canonical) with optional 3D read-only visualization.
          </p>
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
          <li><strong>Virtual Lab</strong> — 2D canonical editor + optional 3D read-only view</li>
          <li><strong>Lab Assignment</strong> — Course lab wrapper + template + submit</li>
          <li><strong>Lab Examiner</strong> — Read-only inspection + integrity verification</li>
        </ul>
        <p className={styles.labMapFiles}>
          <code>.rb-lab.zip</code> = evidence capsule
        </p>
      </section>
      <div className="mt-6 pt-4 border-t border-white/5 text-[9px] text-gray-600 font-mono text-center">
        RedByte OS Genesis · {import.meta.env.MODE} · <BuildInfo />
      </div>
    </div>
  );
};

const BuildInfo = () => {
  const [info, setInfo] = React.useState('Loading...');
  React.useEffect(() => {
    fetch('/build.json').then(r => r.json()).then(d => setInfo(`${d.sha} (${d.env})`)).catch(() => setInfo('dev-mode'));
  }, []);
  return <span>{info}</span>;
}

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
