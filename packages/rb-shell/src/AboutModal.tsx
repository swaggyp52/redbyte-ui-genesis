// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Modal } from '@redbyte/rb-primitives';
import { VERSION, GIT_SHA, BUILD_DATE, getFullVersionString } from './version';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About RedByte OS"
      width={640}
      height={520}
    >
      <div className="p-8 space-y-6" style={{ color: 'var(--rb-text)' }}>
        {/* Version header */}
        <div className="text-center pb-4" style={{ borderBottom: '1px solid var(--rb-border)' }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--rb-accent)' }}
            >
              <span className="text-sm font-bold text-white leading-none">R</span>
            </div>
            <span className="text-2xl font-semibold" style={{ color: 'var(--rb-text)' }}>
              RedByte OS
            </span>
          </div>
          <div className="text-sm font-mono" style={{ color: 'var(--rb-text-2)' }}>
            {getFullVersionString()}
          </div>
        </div>

        {/* Build info grid */}
        <div
          className="grid grid-cols-3 gap-4 p-4 rounded-lg"
          style={{ background: 'var(--rb-surface-1)', border: '1px solid var(--rb-border)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--rb-text-3)' }}>Version</div>
            <div className="text-sm font-mono" style={{ color: 'var(--rb-text)' }}>v{VERSION}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--rb-text-3)' }}>Build</div>
            <div className="text-sm font-mono" style={{ color: 'var(--rb-text)' }}>{GIT_SHA.substring(0, 7)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--rb-text-3)' }}>Date</div>
            <div className="text-sm font-mono" style={{ color: 'var(--rb-text)' }}>{BUILD_DATE}</div>
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--rb-text-2)' }}>
            RedByte OS is a browser-based deterministic operating system for digital logic education.
            Build, simulate, and verify circuits from basic gates to complete CPUs — entirely in your browser.
          </p>
        </div>

        {/* Links */}
        <div className="space-y-2">
          <a
            href="https://github.com/swaggyp52/redbyte-ui-genesis"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg transition-colors"
            style={{
              background: 'var(--rb-surface-1)',
              border: '1px solid var(--rb-border)',
              color: 'var(--rb-text)',
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--rb-text)' }}>View on GitHub</div>
            <div className="text-xs ml-auto" style={{ color: 'var(--rb-text-3)' }}>Source code</div>
          </a>
        </div>

        {/* License */}
        <div className="pt-4 text-center" style={{ borderTop: '1px solid var(--rb-border)' }}>
          <div className="text-xs" style={{ color: 'var(--rb-text-3)' }}>
            Copyright © 2025 Connor Angiel — RedByte OS Genesis
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--rb-text-3)' }}>
            Licensed under the RedByte Proprietary License (RPL-1.0)
          </div>
        </div>
      </div>
    </Modal>
  );
};
