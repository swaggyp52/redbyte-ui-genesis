import React from 'react';
import { IdeCallout, IdeSectionHeader } from './IdePrimitives';

export const SurfaceSectionTitle: React.FC<{
  title: string;
  meta?: React.ReactNode;
  testId?: string;
}> = ({ title, meta, testId }) => (
  <div className="ide-surface-section-title">
    <IdeSectionHeader title={title} meta={meta} testId={testId} />
  </div>
);

export const SurfacePanel: React.FC<{
  children: React.ReactNode;
  className?: string;
  testId?: string;
}> = ({ children, className, testId }) => (
  <section
    className={`ide-surface-panel${className ? ` ${className}` : ''}`}
    data-testid={testId}
  >
    {children}
  </section>
);

export const SurfaceCallout: React.FC<{
  tone?: 'info' | 'warn' | 'error' | 'success';
  title?: string;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}> = ({ tone = 'info', title, children, testId, className }) => (
  <div className="ide-surface-callout">
    <IdeCallout
      tone={tone}
      title={title}
      testId={testId}
      className={className}
    >
      {children}
    </IdeCallout>
  </div>
);

export const SurfaceTwoCol: React.FC<{
  main: React.ReactNode;
  side?: React.ReactNode;
  className?: string;
  testId?: string;
  mainClassName?: string;
  sideClassName?: string;
}> = ({ main, side, className, testId, mainClassName, sideClassName }) => (
  <div
    className={`ide-surface-two-col${className ? ` ${className}` : ''}`}
    data-testid={testId}
  >
    <div
      className={`ide-surface-two-col-main${
        mainClassName ? ` ${mainClassName}` : ''
      }`}
    >
      {main}
    </div>
    {side ? (
      <aside
        className={`ide-surface-two-col-side${
          sideClassName ? ` ${sideClassName}` : ''
        }`}
      >
        {side}
      </aside>
    ) : null}
  </div>
);
