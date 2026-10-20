import React from 'react';
import { WorkbenchDisclosure } from '../../components/WorkbenchDisclosure';

/** Presentation of the existing selected recording and authored-scenario authorities. */
export function SelectedResult({ signal, position, tick, expected, observed, inputs, mismatch, recorded,
  navigator, onInspect, inspecting, onEditDesign, draftExpected, onSetExpected, tools }: {
  signal: string | null;
  position: string;
  tick: number | null;
  expected: string | null;
  observed: string | null;
  inputs: readonly { label: string; value: string | null }[];
  mismatch: boolean;
  recorded: boolean;
  navigator?: React.ReactNode;
  onInspect?: () => void;
  inspecting?: boolean;
  onEditDesign?: () => void;
  draftExpected?: unknown;
  onSetExpected?: (value: 0 | 1 | null) => void;
  tools?: React.ReactNode;
}) {
  return <section className="rb-selected-result" data-testid="ide-verify-selected-result" data-tick={tick ?? ''} data-signal={signal ?? ''}
    data-mismatch={mismatch ? 'true' : 'false'} aria-label="Selected result">
    <div className="rb-selected-result-main">
      <div className="rb-selected-result-values" data-testid="ide-verify-fail-nav-summary">
        <strong>{signal ?? 'Select an output'}</strong><span>{position}</span>
        {expected != null && <span>expected <code>{expected}</code></span>}
        <span>{recorded ? 'observed' : 'unrecorded'} <code data-testid="ide-selected-result-observed">{observed ?? '—'}</code></span>
        {mismatch && <strong className="rb-selected-result-mismatch">≠ Mismatch</strong>}
      </div>
      <div className="rb-selected-result-actions">
        {onInspect && <button type="button" className="wb-btn" data-testid="ide-selected-result-inspect" aria-pressed={inspecting} onClick={onInspect}>Inspect circuit</button>}
        {onSetExpected && <WorkbenchDisclosure className="rb-selected-result-check" summary="Edit expectation" data-testid="ide-selected-result-check-editor">
          <span>Current draft · {signal} · {position} · expected {draftExpected == null ? 'unset' : String(draftExpected)}</span>
          <div role="group" aria-label="Authored expected value">
            <button type="button" className="wb-btn" onClick={() => onSetExpected(0)}>Set 0</button>
            <button type="button" className="wb-btn" onClick={() => onSetExpected(1)}>Set 1</button>
            <button type="button" className="wb-btn" onClick={() => onSetExpected(null)}>Clear check</button>
          </div>
          <small>Edits the authored scenario. The selected recording stays unchanged; rerun to evaluate.</small>
        </WorkbenchDisclosure>}
        {onEditDesign && <button type="button" className="wb-btn wb-btn--ghost" data-testid="ide-verify-fail-focus-trace" onClick={onEditDesign}>Edit in Design</button>}
      </div>
    </div>
    <div className="rb-selected-result-context">
      {inputs.length > 0 && <div className="rb-selected-result-inputs" data-testid="ide-selected-result-inputs"><span>Recorded inputs</span>
        {inputs.map((input, index) => <code key={index}>{input.label}={input.value ?? 'unrecorded'}</code>)}
      </div>}
      {navigator}{tools}
    </div>
  </section>;
}
