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
  actions?: VerifyPrimaryStatusAction[];
}

export const VerifyPrimaryStatusArea: React.FC<VerifyPrimaryStatusAreaProps> = ({
  tone,
  title,
  message,
  actions = [],
}) => {
  return (
    <div className="ide-verify-primary-status" data-testid="ide-verify-primary-status">
      <IdeCallout tone={tone} title={title} testId="ide-verify-primary-status-callout">
        <p className="ide-copy" style={{ margin: 0 }}>{message}</p>
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
