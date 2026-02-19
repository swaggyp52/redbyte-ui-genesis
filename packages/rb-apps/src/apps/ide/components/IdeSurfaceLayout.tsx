import React from 'react';

type IdeSurfaceMode = 'project' | 'design' | 'verify' | 'export' | 'import';

export interface IdeSurfaceLayoutProps {
  mode: IdeSurfaceMode;
  children: React.ReactNode;
  inspector: React.ReactNode;
}

export const IdeSurfaceLayout: React.FC<IdeSurfaceLayoutProps> = ({ mode, children, inspector }) => {
  return (
    <section
      className="ide-surface-shell"
      data-testid={`ide-mode-${mode}`}
      data-ide-mode-marker={mode}
    >
      <div className="ide-content-grid" data-testid="ide-surface-grid">
        <main className="ide-main-area" data-testid="ide-mode-body">
          {children}
        </main>
        <aside className="ide-inspector" data-testid="ide-inspector">
          {inspector}
        </aside>
      </div>
    </section>
  );
};
