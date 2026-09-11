import React from 'react';

export interface ScenarioTestbenchPreviewProps {
  readonly scenarioName: string;
  readonly source?: string;
}

/**
 * Generated testbench source for the active scenario — the same file the
 * package carries. Read-only; edits happen through the scenario's events
 * and checks, which regenerate it.
 */
export const ScenarioTestbenchPreview: React.FC<ScenarioTestbenchPreviewProps> = ({
  scenarioName,
  source,
}) => {
  const lines = (source?.trim() || '-- Add scenario events to generate testbench.vhd.').split('\n');
  return (
    <section className="rb-tb-preview" data-testid="ide-scenario-testbench-preview">
      <header className="rb-tb-preview-bar">
        <span className="rb-tb-preview-eyebrow">Generated simulation source</span>
        <h3 className="rb-tb-preview-file">testbench.vhd</h3>
        <span className="wb-toolbar-spacer" />
        <strong className="rb-tb-preview-scenario">{scenarioName}</strong>
        <small className="rb-tb-preview-note">Same source packaged by Build &amp; Export</small>
      </header>
      <div className="rb-tb-preview-code" role="region" aria-label="Generated VHDL testbench">
        {lines.map((line, index) => (
          <div key={index} className="rb-tb-preview-line">
            <span className="rb-tb-preview-no">{index + 1}</span>
            <code>{line || ' '}</code>
          </div>
        ))}
      </div>
    </section>
  );
};
