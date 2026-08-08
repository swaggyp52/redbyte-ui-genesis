import React from 'react';
import { IdeButton } from './IdePrimitives';
import './StudioControlStateMatrix.css';

export const StudioControlStateMatrix: React.FC = () => (
  <main className="ide-control-matrix" data-testid="ide-control-state-matrix">
    <header className="ide-control-matrix__header">
      <div>
        <span className="ide-control-matrix__eyebrow">Development visual proof</span>
        <h1>Studio Light control states</h1>
        <p>Shared student-facing actions, fields, and navigation states at normal browser scale.</p>
      </div>
      <span className="ide-status-pill ide-status-ok">Contrast checked</span>
    </header>

    <section className="ide-control-matrix__section" aria-labelledby="button-states-title">
      <div className="ide-control-matrix__section-heading">
        <h2 id="button-states-title">Actions</h2>
        <p>Primary intent is blue; secondary and ghost actions stay neutral.</p>
      </div>
      <div className="ide-control-matrix__grid">
        <label><span>Primary</span><IdeButton tone="primary">Run simulation</IdeButton></label>
        <label><span>Secondary</span><IdeButton tone="secondary">Copy</IdeButton></label>
        <label><span>Ghost</span><IdeButton tone="ghost">Focus path</IdeButton></label>
        <label><span>Hover</span><IdeButton tone="secondary" className="is-demo-hover">Open waveform</IdeButton></label>
        <label><span>Disabled</span><IdeButton tone="secondary" disabled>Duplicate</IdeButton></label>
        <label><span>Danger</span><IdeButton tone="danger">Clear mapping</IdeButton></label>
      </div>
    </section>

    <section className="ide-control-matrix__section" aria-labelledby="field-states-title">
      <div className="ide-control-matrix__section-heading">
        <h2 id="field-states-title">Fields and navigation</h2>
        <p>Values and focus remain visible without relying on color alone.</p>
      </div>
      <div className="ide-control-matrix__fields">
        <label><span>Input</span><input defaultValue="LD1 (SUM)" readOnly /></label>
        <label><span>Select</span><select defaultValue="dark"><option value="dark">Dark canvas</option><option value="light">Light canvas</option></select></label>
        <label><span>Focused input</span><input className="is-demo-focus" defaultValue="HalfAdder" readOnly /></label>
        <label><span>Disabled input</span><input defaultValue="Assignment saved" disabled /></label>
      </div>
      <div className="ide-control-matrix__tabs" role="tablist" aria-label="Example navigation states">
        <button type="button" role="tab">Timeline</button>
        <button type="button" role="tab" aria-selected="true">Waveform</button>
        <button type="button" role="tab">Testbench</button>
      </div>
    </section>

    <footer className="ide-control-matrix__footer">
      <span>Studio Light</span>
      <span>100% browser zoom</span>
      <span>Minimum workflow text: 12px</span>
    </footer>
  </main>
);
