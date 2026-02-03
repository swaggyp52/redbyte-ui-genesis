import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState } from 'react';
export const WelcomeWindow = ({ onClose, onExploreStudio, onOpenPlayground, }) => {
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
    return (_jsxs("div", { className: "welcome-window", "data-testid": "welcome-window", children: [_jsxs("div", { className: "welcome-header", children: [_jsx("h2", { className: "welcome-title", children: "Welcome to RedByte OS Genesis" }), _jsx("button", { className: "welcome-close", onClick: handleClose, "aria-label": "Close welcome window", "data-testid": "welcome-close", children: "\u00D7" })] }), _jsxs("div", { className: "welcome-content", children: [_jsx("p", { className: "welcome-description", children: "RedByte is a visual logic circuit simulator. Build digital circuits, simulate behavior in real-time, and understand how logic gates work \u2014 all in your browser." }), _jsx("p", { className: "welcome-features", children: _jsx("strong", { children: "Build \u2022 Simulate \u2022 Understand" }) }), _jsx("p", { className: "welcome-info", children: "Get started by exploring the Studio environment or jumping straight into the Logic Playground to build your first circuit." }), _jsxs("div", { className: "welcome-actions", children: [_jsx("button", { className: "welcome-button welcome-button-primary", onClick: handleExploreStudio, "data-testid": "welcome-explore-studio", children: "Explore Studio" }), _jsx("button", { className: "welcome-button welcome-button-secondary", onClick: handleOpenPlayground, "data-testid": "welcome-open-playground", children: "Open Logic Playground" })] }), _jsx("div", { className: "welcome-footer", children: _jsxs("label", { className: "welcome-checkbox-label", children: [_jsx("input", { type: "checkbox", checked: dontShowAgain, onChange: (e) => setDontShowAgain(e.target.checked), "data-testid": "welcome-dont-show-again" }), _jsx("span", { children: "Don't show again" })] }) })] }), _jsx("style", { children: `
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
      ` })] }));
};
