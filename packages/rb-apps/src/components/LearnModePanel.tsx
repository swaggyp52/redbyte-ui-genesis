// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  GUIDED_EXAMPLES,
  getCurrentStep,
  isExampleComplete,
  validateCurrentStep,
  type GuidedExample,
  type LearnStep,
} from '../logic/learnMode';

export interface LearnModePanelProps {
  circuit: Circuit;
  onLoadExample?: (example: GuidedExample) => void;
  onExitLearnMode?: () => void;
}

export const LearnModePanel: React.FC<LearnModePanelProps> = ({
  circuit,
  onLoadExample,
  onExitLearnMode,
}) => {
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const activeExample = activeExampleId ? GUIDED_EXAMPLES[activeExampleId] : null;

  // Auto-validate current step whenever circuit changes
  useEffect(() => {
    if (!activeExample) return;

    const validation = validateCurrentStep(activeExample, completedSteps, circuit);

    if (validation.isValid && validation.step) {
      // Mark step as complete
      setCompletedSteps((prev) => new Set([...prev, validation.step!.id]));
    }
  }, [circuit, activeExample, completedSteps]);

  const handleStartExample = (exampleId: string) => {
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

  const handleMarkStepComplete = (stepId: string) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
  };

  // Show example list
  if (!activeExample) {
    return (
      <div className="h-full p-4 space-y-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-200 mb-1">Learn Mode</h3>
          <p className="text-xs text-gray-400">
            Follow guided examples to learn digital logic fundamentals
          </p>
        </div>

        <div className="space-y-2">
          {Object.values(GUIDED_EXAMPLES).map((example) => (
            <button
              key={example.id}
              onClick={() => handleStartExample(example.id)}
              className="w-full text-left p-3 rounded bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-white">{example.title}</div>
                <div
                  className={`text-xs px-2 py-0.5 rounded ${
                    example.difficulty === 'beginner'
                      ? 'bg-green-900/30 text-green-400'
                      : example.difficulty === 'intermediate'
                        ? 'bg-yellow-900/30 text-yellow-400'
                        : 'bg-red-900/30 text-red-400'
                  }`}
                >
                  {example.difficulty}
                </div>
              </div>
              <div className="text-xs text-gray-400">{example.description}</div>
              <div className="text-xs text-gray-500 mt-2">
                {example.steps.length} steps
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 p-3 bg-blue-900/20 border border-blue-700/30 rounded text-xs text-blue-300">
          <div className="font-semibold mb-1">💡 Tip</div>
          <div>
            Each example guides you step-by-step. Follow the checklist and watch the circuit come
            to life.
          </div>
        </div>
      </div>
    );
  }

  // Show active example with step checklist
  const currentStep = getCurrentStep(activeExample, completedSteps);
  const isComplete = isExampleComplete(activeExample, completedSteps);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-200">{activeExample.title}</h3>
          <button
            onClick={handleExitExample}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
        </div>
        <p className="text-xs text-gray-400">{activeExample.description}</p>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>
              {completedSteps.size} / {activeExample.steps.length}
            </span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-600 transition-all duration-300"
              style={{
                width: `${(completedSteps.size / activeExample.steps.length) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Step checklist */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {activeExample.steps.map((step, index) => {
          const isStepComplete = completedSteps.has(step.id);
          const isStepActive = currentStep?.id === step.id;

          return (
            <div
              key={step.id}
              className={`p-3 rounded border transition-all ${
                isStepComplete
                  ? 'bg-green-900/20 border-green-700/30'
                  : isStepActive
                    ? 'bg-cyan-900/20 border-cyan-700/50 shadow-lg'
                    : 'bg-gray-800/30 border-gray-700/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div className="flex-shrink-0 mt-0.5">
                  {isStepComplete ? (
                    <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  ) : (
                    <div
                      className={`w-5 h-5 rounded-full border-2 ${
                        isStepActive ? 'border-cyan-500' : 'border-gray-600'
                      }`}
                    />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isStepComplete
                        ? 'text-green-300 line-through'
                        : isStepActive
                          ? 'text-cyan-300'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </div>

                  {step.hint && isStepActive && (
                    <div className="text-xs text-gray-400 italic">{step.hint}</div>
                  )}

                  {/* Manual completion button for steps without auto-validation */}
                  {isStepActive && !step.validate && (
                    <button
                      onClick={() => handleMarkStepComplete(step.id)}
                      className="mt-2 px-2 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
                    >
                      Mark as done
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion message */}
      {isComplete && activeExample.completionMessage && (
        <div className="p-4 border-t border-gray-700">
          <div className="p-3 bg-green-900/20 border border-green-700/30 rounded">
            <div className="flex items-start gap-2">
              <span className="text-lg">🎉</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-green-300 mb-1">Complete!</div>
                <div className="text-xs text-green-400">{activeExample.completionMessage}</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleExitExample}
            className="w-full mt-3 px-3 py-2 text-sm bg-cyan-600 hover:bg-cyan-500 rounded transition-colors"
          >
            Try another example
          </button>
        </div>
      )}
    </div>
  );
};
