// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';

interface WelcomeWindowProps {
  onClose: () => void;
  onExploreStudio: () => void;
  onOpenPlayground: () => void;
}

export const WelcomeWindow: React.FC<WelcomeWindowProps> = ({
  onClose,
  onExploreStudio,
  onOpenPlayground,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('rb-os:v1:welcomeSeen', 'true');
    }
    onClose();
  };

  const handleExploreStudio = () => {
    if (dontShowAgain) {
      localStorage.setItem('rb-os:v1:welcomeSeen', 'true');
    }
    onExploreStudio();
  };

  const handleOpenPlayground = () => {
    if (dontShowAgain) {
      localStorage.setItem('rb-os:v1:welcomeSeen', 'true');
    }
    onOpenPlayground();
  };

  return (
    <div className="welcome-window" data-testid="welcome-window">
      <div className="welcome-header">
        <h2 className="welcome-title">Welcome to RedByte OS Genesis</h2>
        <button
          className="welcome-close"
          onClick={handleClose}
          aria-label="Close welcome window"
          data-testid="welcome-close"
        >
          ×
        </button>
      </div>

      <div className="welcome-content">
        <p className="welcome-description">
          RedByte is a visual logic circuit simulator. Build digital circuits,
          simulate behavior in real-time, and understand how logic gates work —
          all in your browser.
        </p>

        <p className="welcome-features">
          <strong>Build • Simulate • Understand</strong>
        </p>

        <p className="welcome-info">
          Get started by exploring the Studio environment or jumping straight
          into the Logic Playground to build your first circuit.
        </p>

        <div className="welcome-actions">
          <button
            className="welcome-button welcome-button-primary"
            onClick={handleExploreStudio}
            data-testid="welcome-explore-studio"
          >
            Explore Studio
          </button>
          <button
            className="welcome-button welcome-button-secondary"
            onClick={handleOpenPlayground}
            data-testid="welcome-open-playground"
          >
            Open Logic Playground
          </button>
        </div>

        <div className="welcome-footer">
          <label className="welcome-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              data-testid="welcome-dont-show-again"
            />
            <span>Don't show again</span>
          </label>
        </div>
      </div>

      <style>{`
        .welcome-window {
          background: var(--rb-color-neutral-50, #f8f9fa);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          max-width: 500px;
          width: 100%;
        }

        .welcome-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid var(--rb-color-neutral-200, #dee2e6);
        }

        .welcome-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--rb-color-neutral-900, #0a0c0e);
        }

        .welcome-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--rb-color-neutral-600, #6c757d);
          padding: 0.25rem 0.5rem;
          line-height: 1;
        }

        .welcome-close:hover {
          color: var(--rb-color-neutral-900, #0a0c0e);
        }

        .welcome-content {
          padding: 1.5rem;
        }

        .welcome-description {
          margin: 0 0 1rem 0;
          color: var(--rb-color-neutral-700, #495057);
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        .welcome-features {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          color: var(--rb-color-neutral-900, #0a0c0e);
          text-align: center;
        }

        .welcome-info {
          margin: 0 0 1.5rem 0;
          color: var(--rb-color-neutral-600, #6c757d);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .welcome-actions {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .welcome-button {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 0.9375rem;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .welcome-button-primary {
          background: linear-gradient(135deg, #ff0000, #0087ff);
          color: white;
        }

        .welcome-button-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
        }

        .welcome-button-secondary {
          background: var(--rb-color-neutral-200, #e9ecef);
          color: var(--rb-color-neutral-900, #0a0c0e);
        }

        .welcome-button-secondary:hover {
          background: var(--rb-color-neutral-300, #dee2e6);
        }

        .welcome-footer {
          padding-top: 1rem;
          border-top: 1px solid var(--rb-color-neutral-200, #dee2e6);
        }

        .welcome-checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--rb-color-neutral-700, #495057);
        }

        .welcome-checkbox-label input[type="checkbox"] {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
