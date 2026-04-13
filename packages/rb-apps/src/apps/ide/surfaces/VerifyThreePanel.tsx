import React from 'react';

export interface VerifyThreePanelProps {
  leftPanel?: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel?: React.ReactNode;
  testId?: string;
}

export const VerifyThreePanel: React.FC<VerifyThreePanelProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  testId = 'ide-verify-three-panel',
}) => {
  const hasLeftPanel = leftPanel !== null && leftPanel !== undefined;
  const hasRightPanel = rightPanel !== null && rightPanel !== undefined;

  if (!hasLeftPanel && !hasRightPanel) {
    return (
      <main
        className="ide-verify-three-panel-center ide-verify-three-panel-center--solo"
        data-testid="ide-verify-three-panel-center"
      >
        {centerPanel}
      </main>
    );
  }

  return (
    <section
      className="ide-verify-three-panel"
      data-testid={testId}
      data-has-left={hasLeftPanel ? '1' : '0'}
      data-has-right={hasRightPanel ? '1' : '0'}
    >
      {hasLeftPanel ? (
        <aside className="ide-verify-three-panel-left" data-testid="ide-verify-three-panel-left">
          {leftPanel}
        </aside>
      ) : null}
      <main className="ide-verify-three-panel-center" data-testid="ide-verify-three-panel-center">
        {centerPanel}
      </main>
      {hasRightPanel ? (
        <aside className="ide-verify-three-panel-right" data-testid="ide-verify-three-panel-right">
          {rightPanel}
        </aside>
      ) : null}
    </section>
  );
};
