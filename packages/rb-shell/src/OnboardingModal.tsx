// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import { Modal } from '@redbyte/rb-primitives';
import type { Intent } from './intent-types';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (appId: string) => void;
  onDispatchIntent: (intent: Intent) => void;
}

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
export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOpenApp,
  onDispatchIntent,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('rb:onboarding:dismissed', 'true');
      } catch {
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

  const handleLoadExample = (exampleId: '03_half-adder' | '04_4bit-counter') => {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Start Here"
      width={600}
      height={550}
    >
      <div className="p-8 space-y-6">
        {/* Welcome Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl text-cyan-400 mb-3">
            Welcome to RedByte Logic Playground
          </h2>
          <p className="text-gray-300 text-sm">
            Build and simulate digital logic circuits in your browser.
            Choose an option below to get started!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Open Playground */}
          <button
            onClick={handleOpenPlayground}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-lg text-left transition-all border border-blue-500/30 shadow-lg hover:shadow-xl"
          >
            <div className="font-semibold text-white text-lg mb-1">
              Open Playground
            </div>
            <div className="text-blue-100 text-sm">
              Start with a blank canvas. Drag components from the palette and connect them with wires.
            </div>
          </button>

          {/* Open Help */}
          <button
            onClick={handleOpenHelp}
            className="w-full p-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-lg text-left transition-all border border-purple-500/30 shadow-lg hover:shadow-xl"
          >
            <div className="font-semibold text-white text-lg mb-1">
              Open Help
            </div>
            <div className="text-purple-100 text-sm">
              Learn digital logic step-by-step with interactive tutorials and guided lessons.
            </div>
          </button>

          {/* Load Example: Half Adder */}
          <button
            onClick={() => handleLoadExample('03_half-adder')}
            className="w-full p-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-lg text-left transition-all border border-green-500/30 shadow-lg hover:shadow-xl"
          >
            <div className="font-semibold text-white text-lg mb-1">
              Load Example: Half Adder
            </div>
            <div className="text-green-100 text-sm">
              See how XOR and AND gates combine to add two 1-bit numbers. Great first circuit!
            </div>
          </button>

          {/* Load Example: 4-bit Counter */}
          <button
            onClick={() => handleLoadExample('04_4bit-counter')}
            className="w-full p-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 rounded-lg text-left transition-all border border-amber-500/30 shadow-lg hover:shadow-xl"
          >
            <div className="font-semibold text-white text-lg mb-1">
              Load Example: 4-bit Counter
            </div>
            <div className="text-amber-100 text-sm">
              Watch a clock-driven binary counter in action. Perfect for understanding sequential logic!
            </div>
          </button>
        </div>

        {/* Don't show again checkbox */}
        <div className="flex items-center justify-center pt-4 border-t border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
            />
            Don't show this again
          </label>
        </div>
      </div>
    </Modal>
  );
};
