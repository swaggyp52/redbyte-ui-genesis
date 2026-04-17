import React from 'react';
import { IdeButton, IdeCallout } from '../../components/IdePrimitives';

export type VerifyPrimaryStatusTone = 'info' | 'warn' | 'error';

export interface VerifyPrimaryStatusAction {
  label: string;
  onClick: () => void;
  tone?: 'primary' | 'secondary' | 'ghost';
  testId: string;
}

export interface VerifyPrimaryStatusAreaProps {
  tone: VerifyPrimaryStatusTone;
  title: string;
  message: string;
  /** Optional second line (e.g. default next-run behavior) with its own test id for contracts */
  footnote?: string;
  footnoteTestId?: string;
  actions?: VerifyPrimaryStatusAction[];
  /** Tighter chrome when nested inside the unified Verify command bar */
  density?: 'default' | 'embedded';
}

export const VerifyPrimaryStatusArea: React.FC<VerifyPrimaryStatusAreaProps> = ({
  tone,
  title,
  message,
  footnote,
  footnoteTestId,
  actions = [],
  density = 'default',
}) => {
  const densityClass = density === 'embedded' ? ' ide-verify-primary-status--embedded' : '';
  return (
    <div className={`ide-verify-primary-status${densityClass}`} data-testid="ide-verify-primary-status">
      <IdeCallout tone={tone} title={title} testId="ide-verify-primary-status-callout">
        <p className="ide-copy" style={{ margin: 0 }}>{message}</p>
        {footnote ? (
          <p className="ide-copy ide-verify-primary-status-footnote" style={{ margin: '6px 0 0' }} data-testid={footnoteTestId}>
            {footnote}
          </p>
        ) : null}
        {actions.length > 0 && (
          <div className="ide-inline-actions" style={{ marginTop: 8 }}>
            {actions.map((action) => (
              <IdeButton
                key={action.testId}
                tone={action.tone ?? 'secondary'}
                onClick={action.onClick}
                testId={action.testId}
              >
                {action.label}
              </IdeButton>
            ))}
          </div>
        )}
      </IdeCallout>
    </div>
  );
};
