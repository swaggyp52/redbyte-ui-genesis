import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const tourSteps = [
    {
        title: "Welcome to RedByte",
        content: "RedByte is a browser-based environment for learning and building digital logic. Every simulation is deterministic - same inputs always produce same outputs, and you can step backward through time.",
        highlight: "Deterministic simulation makes debugging circuits straightforward.",
    },
    {
        title: "Visual Circuit Design",
        content: "Build circuits with gates (AND, OR, XOR, etc.) and wires using a visual editor. The OS-style desktop lets you arrange windows and use keyboard shortcuts for fast navigation.",
        highlight: "Press Ctrl+K anytime to open the command palette.",
    },
    {
        title: "Try the Interactive Examples",
        content: "Before downloading, try the demos on this site. Toggle logic gates, step through a counter, and scrub through waveforms - all running live in your browser.",
        action: { label: "Go to Examples", route: "/examples" },
    },
    {
        title: "Built for Education",
        content: "RedByte includes a Lab Workbench for structured assignments, automatic validation, and submission export. Instructors can use the Submission Inspector to review student work.",
        highlight: "No accounts, no cloud - everything stays local.",
    },
    {
        title: "Ready to Start?",
        content: "Check out the Getting Started guide to run RedByte locally, or explore the examples and manual to learn more.",
        action: { label: "Getting Started", route: "/getting-started" },
    },
];
export default function GuidedTour({ onClose }) {
    const [currentStep, setCurrentStep] = useState(0);
    const navigate = useNavigate();
    const handleNext = () => {
        if (currentStep < tourSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
        else {
            onClose();
        }
    };
    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };
    const handleAction = () => {
        const step = tourSteps[currentStep];
        if (step.action) {
            onClose();
            navigate(step.action.route);
        }
    };
    const step = tourSteps[currentStep];
    const progress = ((currentStep + 1) / tourSteps.length) * 100;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-rb-bg/90 backdrop-blur-sm", onClick: onClose }), _jsxs("div", { className: "relative bg-rb-surface border border-rb-border rounded-lg max-w-md w-full shadow-modal animate-fade-in", children: [_jsx("div", { className: "h-1 bg-rb-raised rounded-t-lg overflow-hidden", children: _jsx("div", { className: "h-full bg-rb-accent transition-all duration-300 ease-out", style: { width: `${progress}%` } }) }), _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { children: [_jsxs("span", { className: "text-xs text-rb-dim font-mono", children: [currentStep + 1, " / ", tourSteps.length] }), _jsx("h3", { className: "text-h3 text-rb-text mt-1", children: step.title })] }), _jsx("button", { type: "button", onClick: onClose, className: "p-1.5 text-rb-muted hover:text-rb-text transition-colors rounded", "aria-label": "Close tour", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("p", { className: "text-rb-muted leading-relaxed mb-4", children: step.content }), step.highlight && (_jsx("div", { className: "bg-rb-accent-bg border border-rb-accent/20 rounded-md px-4 py-3 mb-4", children: _jsx("p", { className: "text-sm text-rb-text", children: step.highlight }) })), _jsxs("div", { className: "flex items-center justify-between pt-2", children: [_jsx("button", { type: "button", onClick: handleBack, disabled: currentStep === 0, className: `px-4 py-2 text-sm rounded transition-colors ${currentStep === 0
                                            ? 'text-rb-dim cursor-not-allowed'
                                            : 'text-rb-muted hover:text-rb-text hover:bg-rb-raised'}`, children: "Back" }), _jsxs("div", { className: "flex gap-2", children: [step.action && (_jsx("button", { type: "button", onClick: handleAction, className: "btn btn-secondary text-sm", children: step.action.label })), _jsx("button", { type: "button", onClick: handleNext, className: "btn btn-primary text-sm", children: currentStep === tourSteps.length - 1 ? 'Finish' : 'Next' })] })] })] }), _jsx("div", { className: "flex justify-center gap-1.5 pb-4", children: tourSteps.map((_, i) => (_jsx("button", { type: "button", onClick: () => setCurrentStep(i), "aria-label": `Go to step ${i + 1}`, className: `w-2 h-2 rounded-full transition-colors ${i === currentStep
                                ? 'bg-rb-accent'
                                : i < currentStep
                                    ? 'bg-rb-accent/40'
                                    : 'bg-rb-border'}` }, i))) })] })] }));
}
