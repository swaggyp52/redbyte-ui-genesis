// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Modal } from '@redbyte/rb-primitives';
import { getVersionString } from './version';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * About Modal
 *
 * Displays information about RedByte Logic Playground:
 * - What it is
 * - What it is not
 * - Links to documentation and source code
 */
export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About RedByte Logic Playground"
      width={700}
      height={600}
    >
      <div className="p-8 space-y-6 text-gray-200">
        {/* Version */}
        <div className="text-center pb-4 border-b border-gray-700">
          <div className="text-3xl text-cyan-400 mb-2">RedByte Logic Playground</div>
          <div className="text-sm text-gray-400">{getVersionString()}</div>
        </div>

        {/* What this is */}
        <div>
          <h2 className="text-xl text-cyan-300 mb-3">What This Is</h2>
          <p className="text-gray-300 leading-relaxed">
            RedByte Logic Playground is a <strong>browser-based digital logic circuit simulator</strong> that
            lets you build, simulate, and understand logic circuits—from basic gates to complete CPUs. Everything
            runs entirely in your browser with no server required. It's designed for education, experimentation,
            and understanding how computers work from first principles. Whether you're a student learning digital
            logic or an enthusiast exploring circuit design, this tool makes complex concepts interactive and accessible.
          </p>
        </div>

        {/* What this is NOT */}
        <div>
          <h2 className="text-xl text-cyan-300 mb-3">What This Is Not</h2>
          <p className="text-gray-300 leading-relaxed">
            This is <strong>not a professional EDA tool</strong> for designing real hardware, nor a replacement
            for industry-standard circuit simulators like Verilog/VHDL environments. It does not model analog
            circuits, timing constraints, or physical properties of real silicon. It is a <strong>pedagogical
            and experimental platform</strong> focused on clarity, determinism, and interactive learning—not
            production chip design. If you need industrial-strength simulation, use tools like Quartus, Vivado,
            or ModelSim.
          </p>
        </div>

        {/* Links */}
        <div>
          <h2 className="text-xl text-cyan-300 mb-3">Learn More</h2>
          <div className="space-y-3">
            <a
              href="https://github.com/connorturlan/redbyte-ui"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600 transition-colors group"
            >
              <svg className="w-5 h-5 text-gray-400 group-hover:text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-semibold text-gray-200 group-hover:text-cyan-300">View on GitHub</div>
                <div className="text-xs text-gray-400">Source code, issues, and contributions</div>
              </div>
            </a>

            <div className="flex items-center gap-2 p-3 bg-slate-800 rounded border border-slate-600">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <div className="font-semibold text-gray-200">Research Paper</div>
                <div className="text-xs text-gray-400">
                  "Deterministic Interactive Computation in the Browser"
                  <br />
                  <span className="text-amber-400">See project root for PDF files</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* License */}
        <div className="pt-4 border-t border-gray-700 text-xs text-gray-500 text-center">
          <div className="mb-2">Copyright © 2025 Connor Angiel — RedByte OS Genesis</div>
          <div>Licensed under the RedByte Proprietary License (RPL-1.0)</div>
        </div>
      </div>
    </Modal>
  );
};
