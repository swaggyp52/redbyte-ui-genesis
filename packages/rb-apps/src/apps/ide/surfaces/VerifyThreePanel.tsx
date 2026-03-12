import React from 'react';

export interface VerifyThreePanelProps {
  leftPanel: React.ReactNode;
  centerPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  testId?: string;
}

export const VerifyThreePanel: React.FC<VerifyThreePanelProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  testId = 'ide-verify-three-panel',
}) => {
  return (
    <section className="ide-verify-three-panel" data-testid={testId}>
      <aside className="ide-verify-three-panel-left" data-testid="ide-verify-three-panel-left">
        {leftPanel}
      </aside>
      <main className="ide-verify-three-panel-center" data-testid="ide-verify-three-panel-center">
        {centerPanel}
      </main>
      <aside className="ide-verify-three-panel-right" data-testid="ide-verify-three-panel-right">
        {rightPanel}
      </aside>
    </section>
  );
};
