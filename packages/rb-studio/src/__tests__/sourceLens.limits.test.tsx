import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SourceLens } from '../lenses/SourceLens';

// Defect C: when the generated source cannot express a part, the Source lens says
// so before the text instead of showing a made-up value as if it were the design.
describe('SourceLens limitations', () => {
  const file = { path: 'top.vhd', text: 'entity top is\nend entity top;' };
  const base = { file, spans: [], activeNodeId: null, onSelectNode: () => {}, nodeLabel: (id: string) => id };

  it('names every limitation above the source', () => {
    const message = 'Unsupported synth subset node type "Delay" on node "dl" (in top.vhd). Fix: replace it.';
    const view = render(<SourceLens {...base} limits={[message]} />);
    const note = view.getByTestId('meridian-source-limits');
    expect(note.getAttribute('role')).toBe('note');
    expect(note.textContent).toContain('This source cannot be packaged yet.');
    expect(note.textContent).toContain(message);
    expect(note.compareDocumentPosition(view.getByTestId('meridian-source')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no note when the source expresses the whole design', () => {
    const view = render(<SourceLens {...base} />);
    expect(view.queryByTestId('meridian-source-limits')).toBeNull();
    expect(view.getByTestId('meridian-source')).toBeTruthy();
  });
});
