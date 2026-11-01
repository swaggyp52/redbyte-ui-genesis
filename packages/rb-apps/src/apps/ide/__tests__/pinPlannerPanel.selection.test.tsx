// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import { PinPlannerPanel } from '../components/PinPlannerPanel';
import { applyHardwareMappingV2Edit } from '../hardwareMappingV2EditorModel';

afterEach(cleanup);
const scalarDoc: HardwareMappingDocumentV2 = {
  schemaVersion: '2.0', boardId: 'basys3', entries: [
    { id: 'a', kind: 'scalar', width: 1, direction: 'in', portName: 'A', nodeId: 'a', port: 'out', pin: 'V17' },
    { id: 'b', kind: 'scalar', width: 1, direction: 'in', portName: 'B', nodeId: 'b', port: 'out', pin: 'V16' },
  ],
};
function Editor({ initialDoc = scalarDoc, selectedRowId }: { initialDoc?: HardwareMappingDocumentV2; selectedRowId: string }) {
  const [doc, setDoc] = useState(initialDoc);
  return <PinPlannerPanel doc={doc} selectedRowId={selectedRowId} onEdit={(operation) => setDoc((current) => applyHardwareMappingV2Edit(current, operation))} />;
}

describe('Pin planner selected-port editing', () => {
  it('edits only the chosen port while checking collisions against the whole mapping, with undo and exact XDC changes', () => {
    const view = render(<Editor selectedRowId="b" />);
    expect(view.queryByTestId('ide-pin-planner-pin-input-a')).toBeNull();
    const input = view.getByTestId('ide-pin-planner-pin-input-b');
    fireEvent.change(input, { target: { value: 'V17' } });
    fireEvent.blur(input);
    expect(view.getByTestId('ide-pin-planner-conflict-count').textContent).toBe('1 conflict');
    expect(view.getByTestId('ide-pin-planner-conflicts').textContent).toContain('A ↔ B');
    expect(view.getByTestId('ide-pin-planner-xdc-diff').textContent).toContain('PACKAGE_PIN V17');
    expect(view.getByTestId('ide-pin-planner-xdc-diff').textContent).toContain('PACKAGE_PIN V16');
    fireEvent.click(view.getByTestId('ide-pin-planner-undo'));
    expect((input as HTMLInputElement).value).toBe('V16');
    expect(view.getByTestId('ide-pin-planner-conflict-count').textContent).toBe('0 conflicts');
  });

  it('retains one-action conflict repair even when the other owner is outside the selected editor', () => {
    const doc = structuredClone(scalarDoc);
    (doc.entries[1] as { pin: string }).pin = 'V17';
    const view = render(<Editor initialDoc={doc} selectedRowId="b" />);
    fireEvent.click(view.getByTestId('ide-pin-planner-resolve-V17'));
    expect((view.getByTestId('ide-pin-planner-pin-input-b') as HTMLInputElement).value).toBe('');
    expect(view.getByTestId('ide-pin-planner-conflict-count').textContent).toBe('0 conflicts');
  });

  it('resolves flattened bus and non-zero slice identities to the selected package-pin field', () => {
    const doc: HardwareMappingDocumentV2 = {
      schemaVersion: '2.0', boardId: 'basys3', entries: [
        { id: 'a', kind: 'bus', direction: 'in', portName: 'A', width: 2, bits: [
          { id: 'input-bit-0', bitIndex: 0, nodeId: 'a0', port: 'out', pin: 'V17' }, { id: 'input-bit-1', bitIndex: 1, nodeId: 'a1', port: 'out', pin: 'V16' },
        ] },
        { id: 'slice', kind: 'slice', direction: 'out', portName: 'Y', nodeId: 'y', port: 'in', msb: 5, lsb: 4, pins: ['U16', 'E19'] },
      ],
    };
    const view = render(<Editor initialDoc={doc} selectedRowId="input-bit-1" />);
    expect((view.getByTestId('ide-pin-planner-pin-input-a:1') as HTMLInputElement).value).toBe('V16');
    expect(view.queryByTestId('ide-pin-planner-pin-input-a:0')).toBeNull();
    view.rerender(<Editor initialDoc={doc} selectedRowId="slice[5]" />);
    expect((view.getByTestId('ide-pin-planner-pin-input-slice:1') as HTMLInputElement).value).toBe('E19');
    expect(view.queryByTestId('ide-pin-planner-pin-input-slice:0')).toBeNull();
  });
});
