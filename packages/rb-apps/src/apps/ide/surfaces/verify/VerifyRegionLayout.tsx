import React from 'react';

interface VerifyRegionProps {
  children: React.ReactNode;
}

export const VerifyHeaderRegion: React.FC<VerifyRegionProps> = ({ children }) => (
  <section className="ide-verify-region ide-verify-region--header" data-zone="header" data-testid="ide-verify-region-header">
    {children}
  </section>
);

export const VerifyResultRegion: React.FC<VerifyRegionProps> = ({ children }) => (
  <section className="ide-verify-region ide-verify-region--result" data-zone="result" data-testid="ide-verify-region-result">
    {children}
  </section>
);

export const VerifyStimulusRegion: React.FC<VerifyRegionProps> = ({ children }) => (
  <section className="ide-verify-region ide-verify-region--stimulus" data-zone="stimulus" data-testid="ide-verify-region-stimulus">
    {children}
  </section>
);

export const VerifyWaveformRegion: React.FC<VerifyRegionProps> = ({ children }) => (
  <section className="ide-verify-region ide-verify-region--waveform" data-zone="waveform" data-testid="ide-verify-region-waveform">
    {children}
  </section>
);

export const VerifyInspectorRegion: React.FC<VerifyRegionProps> = ({ children }) => (
  <section className="ide-verify-region ide-verify-region--inspector" data-zone="inspector" data-testid="ide-verify-region-inspector">
    {children}
  </section>
);

export const VerifyWorkspaceRegion: React.FC<VerifyRegionProps> = ({ children }) => (
  <div className="ide-verify-workspace" data-zone="workspace" data-testid="ide-verify-workspace">
    {children}
  </div>
);
