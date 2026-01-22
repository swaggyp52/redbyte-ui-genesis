// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { RedByteApp } from '../types';
import styles from './WelcomeApp.module.css';

interface WelcomeAppProps {
  onClose?: () => void;
  onNavigate?: (appId: string) => void;
}

export const WelcomeAppContent: React.FC<WelcomeAppProps> = ({ onClose, onNavigate }) => {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('rb-os:v1:welcomeSeen', 'true');
    }
    onClose?.();
  };

  const handleExploreStudio = () => {
    if (dontShowAgain) {
      localStorage.setItem('rb-os:v1:welcomeSeen', 'true');
    }
    // Studio is the main shell - close this window
    onClose?.();
  };

  const handleOpenPlayground = () => {
    if (dontShowAgain) {
      localStorage.setItem('rb-os:v1:welcomeSeen', 'true');
    }
    onNavigate?.('logic-playground');
  };

  return (
    <div className={styles.container}>
      <div className={styles.body}>
        <p className={styles.lead}>
          The Operating System for Computer Engineering Education.
          <br /><br />
          <strong>Design -&gt; Pack -&gt; Run -&gt; Prove</strong>
        </p>

        <p className={styles.tagline}>
          Verify your logic on real hardware with a single command.
        </p>

        <p className={styles.subtle}>
          Get started by exploring the Studio environment or jumping straight
          into the Logic Playground to build your first circuit.
        </p>

        <div className={styles.actions}>
          <button
            onClick={handleExploreStudio}
            data-testid="welcome-explore-studio"
            className={`${styles.button} ${styles.buttonPrimary}`}
            type="button"
          >
            Explore Studio
          </button>
          <button
            onClick={handleOpenPlayground}
            data-testid="welcome-open-playground"
            className={`${styles.button} ${styles.buttonSecondary}`}
            type="button"
          >
            Open Logic Playground
          </button>
        </div>

        <div className={styles.footer}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              data-testid="welcome-dont-show-again"
              className={styles.checkbox}
            />
            <span>Don't show again</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export const WelcomeApp: RedByteApp = {
  manifest: {
    id: 'welcome',
    name: 'Welcome to RedByte OS Genesis',
    iconId: 'neon-wave',
    singleton: true,
    defaultSize: {
      width: 500,
      height: 400,
    },
  },
  component: WelcomeAppContent,
};
