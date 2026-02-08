import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import styles from './WelcomeApp.module.css';
export const WelcomeAppContent = ({ onClose, onNavigate }) => {
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
    return (_jsx("div", { className: styles.container, children: _jsxs("div", { className: styles.body, children: [_jsxs("p", { className: styles.lead, children: ["The Operating System for Computer Engineering Education.", _jsx("br", {}), _jsx("br", {}), _jsx("strong", { children: "Design -> Pack -> Run -> Prove" })] }), _jsx("p", { className: styles.tagline, children: "Verify your logic on real hardware with a single command." }), _jsx("p", { className: styles.subtle, children: "Get started by exploring the Studio environment or jumping straight into the Logic Playground to build your first circuit." }), _jsxs("div", { className: styles.actions, children: [_jsx("button", { onClick: handleExploreStudio, "data-testid": "welcome-explore-studio", className: `${styles.button} ${styles.buttonPrimary}`, type: "button", children: "Explore Studio" }), _jsx("button", { onClick: handleOpenPlayground, "data-testid": "welcome-open-playground", className: `${styles.button} ${styles.buttonSecondary}`, type: "button", children: "Open Logic Playground" })] }), _jsx("div", { className: styles.footer, children: _jsxs("label", { className: styles.checkboxLabel, children: [_jsx("input", { type: "checkbox", checked: dontShowAgain, onChange: (e) => setDontShowAgain(e.target.checked), "data-testid": "welcome-dont-show-again", className: styles.checkbox }), _jsx("span", { children: "Don't show again" })] }) })] }) }));
};
export const WelcomeApp = {
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
