import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState } from 'react';
import { Modal } from '@redbyte/rb-primitives';
/**
 * Start Here Onboarding Modal
 *
 * Appears on first load to help new users understand what they can do.
 * Provides quick access to:
 * - Open Playground (blank canvas)
 * - Open Help (tutorial system)
 * - Load Example: Half Adder
 * - Load Example: 4-bit Counter
 *
 * Can be dismissed permanently via "Don't show again" checkbox.
 */
export const OnboardingModal = ({ isOpen, onClose, onOpenApp, onDispatchIntent, }) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const handleClose = () => {
        if (dontShowAgain) {
            try {
                localStorage.setItem('rb:onboarding:dismissed', 'true');
            }
            catch {
                // Silently fail if localStorage is unavailable
            }
        }
        onClose();
    };
    const handleOpenPlayground = () => {
        onOpenApp('logic-playground');
        handleClose();
    };
    const handleOpenHelp = () => {
        onOpenApp('help');
        handleClose();
    };
    const handleLoadExample = (exampleId) => {
        onDispatchIntent({
            type: 'open-example',
            payload: {
                sourceAppId: 'onboarding',
                targetAppId: 'logic-playground',
                exampleId,
            },
        });
        handleClose();
    };
    return (_jsx(Modal, { isOpen: isOpen, onClose: handleClose, title: "Start Here", width: 600, height: 550, children: _jsxs("div", { className: "p-8 space-y-6", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("h2", { className: "text-2xl text-cyan-400 mb-3", children: "Welcome to RedByte Logic Playground" }), _jsx("p", { className: "text-gray-300 text-sm", children: "Build and simulate digital logic circuits in your browser. Choose an option below to get started!" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("button", { onClick: handleOpenPlayground, className: "w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg text-left transition-all border border-blue-500/30 shadow-lg hover:shadow-xl", children: [_jsx("div", { className: "font-semibold text-white text-lg mb-1", children: "Open Playground" }), _jsx("div", { className: "text-blue-100 text-sm", children: "Start with a blank canvas. Drag components from the palette and connect them with wires." })] }), _jsxs("button", { onClick: handleOpenHelp, className: "w-full p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-lg text-left transition-all border border-purple-500/30 shadow-lg hover:shadow-xl", children: [_jsx("div", { className: "font-semibold text-white text-lg mb-1", children: "Open Help" }), _jsx("div", { className: "text-purple-100 text-sm", children: "Learn digital logic step-by-step with interactive tutorials and guided lessons." })] }), _jsxs("button", { onClick: () => handleLoadExample('03_half-adder'), className: "w-full p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-lg text-left transition-all border border-green-500/30 shadow-lg hover:shadow-xl", children: [_jsx("div", { className: "font-semibold text-white text-lg mb-1", children: "Load Example: Half Adder" }), _jsx("div", { className: "text-green-100 text-sm", children: "See how XOR and AND gates combine to add two 1-bit numbers. Great first circuit!" })] }), _jsxs("button", { onClick: () => handleLoadExample('04_4bit-counter'), className: "w-full p-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-lg text-left transition-all border border-amber-500/30 shadow-lg hover:shadow-xl", children: [_jsx("div", { className: "font-semibold text-white text-lg mb-1", children: "Load Example: 4-bit Counter" }), _jsx("div", { className: "text-amber-100 text-sm", children: "Watch a clock-driven binary counter in action. Perfect for understanding sequential logic!" })] })] }), _jsx("div", { className: "flex items-center justify-center pt-4 border-t border-gray-700", children: _jsxs("label", { className: "flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300", children: [_jsx("input", { type: "checkbox", checked: dontShowAgain, onChange: (e) => setDontShowAgain(e.target.checked), className: "w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer" }), "Don't show this again"] }) })] }) }));
};
