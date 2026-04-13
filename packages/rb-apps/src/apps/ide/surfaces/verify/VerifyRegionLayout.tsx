import React from 'react';

interface VerifyRegionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export const VerifyHeaderRegion: React.FC<VerifyRegionProps> = ({ children, className, ...rest }) => (
  <section className={joinClassNames('ide-verify-region ide-verify-region--header', className)} data-zone="header" data-testid="ide-verify-region-header" {...rest}>
    {children}
  </section>
);

export const VerifyResultRegion: React.FC<VerifyRegionProps> = ({ children, className, ...rest }) => (
  <section className={joinClassNames('ide-verify-region ide-verify-region--result', className)} data-zone="result" data-testid="ide-verify-region-result" {...rest}>
    {children}
  </section>
);

export const VerifyStimulusRegion: React.FC<VerifyRegionProps> = ({ children, className, ...rest }) => (
  <section className={joinClassNames('ide-verify-region ide-verify-region--stimulus', className)} data-zone="stimulus" data-testid="ide-verify-region-stimulus" {...rest}>
    {children}
  </section>
);

export const VerifyWaveformRegion: React.FC<VerifyRegionProps> = ({ children, className, ...rest }) => (
  <section className={joinClassNames('ide-verify-region ide-verify-region--waveform', className)} data-zone="waveform" data-testid="ide-verify-region-waveform" {...rest}>
    {children}
  </section>
);

export const VerifyInspectorRegion: React.FC<VerifyRegionProps> = ({ children, className, ...rest }) => (
  <section className={joinClassNames('ide-verify-region ide-verify-region--inspector', className)} data-zone="inspector" data-testid="ide-verify-region-inspector" {...rest}>
    {children}
  </section>
);

export const VerifyWorkspaceRegion: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...rest }) => (
  <div className={joinClassNames('ide-verify-workspace', className)} data-zone="workspace" data-testid="ide-verify-workspace" {...rest}>
    {children}
  </div>
);
