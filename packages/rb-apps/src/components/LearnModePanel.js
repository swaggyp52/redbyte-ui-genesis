import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useEffect } from 'react';
import { GUIDED_EXAMPLES, getCurrentStep, isExampleComplete, validateCurrentStep, } from '../logic/learnMode';
export const LearnModePanel = ({ circuit, onLoadExample, onExitLearnMode, }) => {
    const [activeExampleId, setActiveExampleId] = useState(null);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const activeExample = activeExampleId ? GUIDED_EXAMPLES[activeExampleId] : null;
    // Auto-validate current step whenever circuit changes
    useEffect(() => {
        if (!activeExample)
            return;
        const validation = validateCurrentStep(activeExample, completedSteps, circuit);
        if (validation.isValid && validation.step) {
            // Mark step as complete
            setCompletedSteps((prev) => new Set([...prev, validation.step.id]));
        }
    }, [circuit, activeExample, completedSteps]);
    const handleStartExample = (exampleId) => {
        const example = GUIDED_EXAMPLES[exampleId];
        setActiveExampleId(exampleId);
        setCompletedSteps(new Set());
        onLoadExample?.(example);
    };
    const handleExitExample = () => {
        setActiveExampleId(null);
        setCompletedSteps(new Set());
        onExitLearnMode?.();
    };
    const handleMarkStepComplete = (stepId) => {
        setCompletedSteps((prev) => new Set([...prev, stepId]));
    };
    // Show example list
    if (!activeExample) {
        return (_jsxs("div", { className: "h-full p-4 space-y-4", children: [_jsxs("div", { className: "mb-4", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-200 mb-1", children: "Learn Mode" }), _jsx("p", { className: "text-xs text-gray-400", children: "Follow guided examples to learn digital logic fundamentals" })] }), _jsx("div", { className: "space-y-2", children: Object.values(GUIDED_EXAMPLES).map((example) => (_jsxs("button", { onClick: () => handleStartExample(example.id), className: "w-full text-left p-3 rounded bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 transition-colors", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("div", { className: "text-sm font-medium text-white", children: example.title }), _jsx("div", { className: `text-xs px-2 py-0.5 rounded ${example.difficulty === 'beginner'
                                            ? 'bg-green-900/30 text-green-400'
                                            : example.difficulty === 'intermediate'
                                                ? 'bg-yellow-900/30 text-yellow-400'
                                                : 'bg-red-900/30 text-red-400'}`, children: example.difficulty })] }), _jsx("div", { className: "text-xs text-gray-400", children: example.description }), _jsxs("div", { className: "text-xs text-gray-500 mt-2", children: [example.steps.length, " steps"] })] }, example.id))) }), _jsxs("div", { className: "mt-6 p-3 bg-blue-900/20 border border-blue-700/30 rounded text-xs text-blue-300", children: [_jsx("div", { className: "font-semibold mb-1", children: "\uD83D\uDCA1 Tip" }), _jsx("div", { children: "Each example guides you step-by-step. Follow the checklist and watch the circuit come to life." })] })] }));
    }
    // Show active example with step checklist
    const currentStep = getCurrentStep(activeExample, completedSteps);
    const isComplete = isExampleComplete(activeExample, completedSteps);
    return (_jsxs("div", { className: "h-full flex flex-col", children: [_jsxs("div", { className: "p-4 border-b border-gray-700", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-200", children: activeExample.title }), _jsx("button", { onClick: handleExitExample, className: "text-xs text-gray-400 hover:text-white transition-colors", children: "\u2190 Back" })] }), _jsx("p", { className: "text-xs text-gray-400", children: activeExample.description }), _jsxs("div", { className: "mt-3", children: [_jsxs("div", { className: "flex items-center justify-between text-xs text-gray-400 mb-1", children: [_jsx("span", { children: "Progress" }), _jsxs("span", { children: [completedSteps.size, " / ", activeExample.steps.length] })] }), _jsx("div", { className: "h-2 bg-gray-800 rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-cyan-600 transition-all duration-300", style: {
                                        width: `${(completedSteps.size / activeExample.steps.length) * 100}%`,
                                    } }) })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-2", children: activeExample.steps.map((step, index) => {
                    const isStepComplete = completedSteps.has(step.id);
                    const isStepActive = currentStep?.id === step.id;
                    return (_jsx("div", { className: `p-3 rounded border transition-all ${isStepComplete
                            ? 'bg-green-900/20 border-green-700/30'
                            : isStepActive
                                ? 'bg-cyan-900/20 border-cyan-700/50 shadow-lg'
                                : 'bg-gray-800/30 border-gray-700/30'}`, children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "flex-shrink-0 mt-0.5", children: isStepComplete ? (_jsx("div", { className: "w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-xs", children: "\u2713" })) : (_jsx("div", { className: `w-5 h-5 rounded-full border-2 ${isStepActive ? 'border-cyan-500' : 'border-gray-600'}` })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: `text-sm font-medium mb-1 ${isStepComplete
                                                ? 'text-green-300 line-through'
                                                : isStepActive
                                                    ? 'text-cyan-300'
                                                    : 'text-gray-400'}`, children: step.title }), step.hint && isStepActive && (_jsx("div", { className: "text-xs text-gray-400 italic", children: step.hint })), isStepActive && !step.validate && (_jsx("button", { onClick: () => handleMarkStepComplete(step.id), className: "mt-2 px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded transition-colors", children: "Mark as done" }))] })] }) }, step.id));
                }) }), isComplete && activeExample.completionMessage && (_jsxs("div", { className: "p-4 border-t border-gray-700", children: [_jsx("div", { className: "p-3 bg-green-900/20 border border-green-700/30 rounded", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-lg", children: "\uD83C\uDF89" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "text-sm font-semibold text-green-300 mb-1", children: "Complete!" }), _jsx("div", { className: "text-xs text-green-400", children: activeExample.completionMessage })] })] }) }), _jsx("button", { onClick: handleExitExample, className: "w-full mt-3 px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 rounded transition-colors", children: "Try another example" })] }))] }));
};
