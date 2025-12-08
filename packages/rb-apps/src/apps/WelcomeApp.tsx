// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import type { RedByteApp } from '../types';

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
    <div className="welcome-app" style={{ padding: '1.5rem', maxWidth: '500px', margin: '0 auto' }}>
      <div className="welcome-content" style={{ color: '#212529' }}>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', lineHeight: '1.5', color: '#495057' }}>
          RedByte is a visual logic circuit simulator. Build digital circuits,
          simulate behavior in real-time, and understand how logic gates work —
          all in your browser.
        </p>

        <p style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', textAlign: 'center', fontWeight: '600' }}>
          <strong>Build • Simulate • Understand</strong>
        </p>

        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', lineHeight: '1.5', color: '#6c757d' }}>
          Get started by exploring the Studio environment or jumping straight
          into the Logic Playground to build your first circuit.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={handleExploreStudio}
            data-testid="welcome-explore-studio"
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              fontSize: '0.9375rem',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #ff0000, #0087ff)',
              color: 'white',
            }}
          >
            Explore Studio
          </button>
          <button
            onClick={handleOpenPlayground}
            data-testid="welcome-open-playground"
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              fontSize: '0.9375rem',
              fontWeight: '500',
              border: 'none',
              cursor: 'pointer',
              background: '#e9ecef',
              color: '#0a0c0e',
            }}
          >
            Open Logic Playground
          </button>
        </div>

        <div style={{ paddingTop: '1rem', borderTop: '1px solid #dee2e6' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#495057' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              data-testid="welcome-dont-show-again"
              style={{ cursor: 'pointer' }}
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
