import React from 'react';
import {
  IdeButton,
  IdeCallout,
  IdeEmptyState,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

export interface DesignSurfaceProps {
  onOpenPalette?: () => void;
}

const PALETTE_GROUPS = [
  { title: 'IO', entries: ['INPUT', 'OUTPUT', 'Switch', 'Lamp'] },
  { title: 'Logic', entries: ['AND', 'OR', 'NOT', 'NAND', 'NOR'] },
  { title: 'Sequential', entries: ['DFF', 'JKFF', 'Counter4Bit'] },
];

export const DesignSurface: React.FC<DesignSurfaceProps> = ({ onOpenPalette }) => {
  return (
    <div className="ide-content-grid" data-testid="ide-mode-design" data-ide-mode-marker="design">
      <main className="ide-main-area" data-testid="ide-mode-body">
        <IdePanel
          title="Design Workspace"
          description="Build deterministic circuit graphs for Basys3."
          right={<IdeStatusPill tone="idle">Canvas Ready</IdeStatusPill>}
          testId="ide-design-panel"
        >
          <div className="ide-design-toolbar">
            <IdeButton tone="primary">Select</IdeButton>
            <IdeButton tone="secondary">Wire</IdeButton>
            <IdeButton tone="ghost">Delete</IdeButton>
            <IdeButton tone="ghost">Zoom In</IdeButton>
            <IdeButton tone="ghost">Zoom Out</IdeButton>
          </div>

          <div className="ide-design-layout">
            <section className="ide-design-palette" data-testid="ide-design-palette">
              <header className="ide-design-subheader">
                <h3>Palette</h3>
                <IdeButton tone="ghost" onClick={onOpenPalette}>
                  Search
                </IdeButton>
              </header>
              <div className="ide-palette-groups">
                {PALETTE_GROUPS.map((group) => (
                  <div key={group.title} className="ide-palette-group">
                    <h4>{group.title}</h4>
                    <div className="ide-palette-chips">
                      {group.entries.map((entry) => (
                        <button key={entry} className="ide-palette-chip" type="button">
                          {entry}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="ide-design-canvas" data-testid="ide-design-canvas">
              <IdeEmptyState
                title="Start building your circuit"
                body="Drop IO first, then add logic gates and wires. This surface is intentionally circuit-first."
                primaryAction={<IdeButton tone="primary">Add input/output pins</IdeButton>}
                secondaryAction={
                  <>
                    <IdeButton tone="secondary">Drop an AND gate</IdeButton>
                    <IdeButton tone="ghost">Open palette</IdeButton>
                  </>
                }
                testId="ide-design-empty-state"
              />
            </section>
          </div>
        </IdePanel>
      </main>

      <aside className="ide-inspector" data-testid="ide-inspector">
        <IdeInspectorSection title="Selection">
          <p className="ide-copy">No node selected. Click a node or wire to edit properties.</p>
        </IdeInspectorSection>
        <IdeInspectorSection title="IO Binding">
          <IdeCallout tone="info" title="Pin binding">
            Select an IO node to bind or review Basys3 pin mapping.
          </IdeCallout>
        </IdeInspectorSection>
      </aside>
    </div>
  );
};
