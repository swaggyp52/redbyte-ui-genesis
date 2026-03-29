/**
 * VectorEditor — Phase 4: Custom Test Vector Editor
 *
 * Inline table for adding/editing/deleting custom test vectors.
 * Each row is one (tick, inputs, expected-outputs) bundle.
 * Immutable updates: all mutations return new arrays.
 */

import React from 'react';

export interface CustomTestVector {
  id: string;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}

export interface VectorEditorField {
  id: string;
  label: string;
}

export interface VectorEditorProps {
  inputFields: VectorEditorField[];
  outputFields: VectorEditorField[];
  vectors: CustomTestVector[];
  onChange: (vectors: CustomTestVector[]) => void;
}

function makeDefault(fields: VectorEditorField[]): Record<string, 0 | 1> {
  const result: Record<string, 0 | 1> = {};
  for (const f of fields) result[f.id] = 0;
  return result;
}

function generateId(): string {
  return `cv_${Math.random().toString(36).slice(2, 9)}`;
}

function nextTick(vectors: CustomTestVector[]): number {
  if (vectors.length === 0) return 1;
  return Math.max(...vectors.map((v) => v.tick)) + 1;
}

export const VectorEditor: React.FC<VectorEditorProps> = ({
  inputFields,
  outputFields,
  vectors,
  onChange,
}) => {
  const handleAddRow = () => {
    const newVector: CustomTestVector = {
      id: generateId(),
      tick: nextTick(vectors),
      inputs: makeDefault(inputFields),
      expected: makeDefault(outputFields),
    };
    onChange([...vectors, newVector]);
  };

  const handleDelete = (id: string) => {
    onChange(vectors.filter((v) => v.id !== id));
  };

  const handleInputChange = (id: string, fieldId: string, value: 0 | 1) => {
    onChange(
      vectors.map((v) =>
        v.id === id ? { ...v, inputs: { ...v.inputs, [fieldId]: value } } : v,
      ),
    );
  };

  const handleExpectedChange = (id: string, fieldId: string, value: 0 | 1) => {
    onChange(
      vectors.map((v) =>
        v.id === id ? { ...v, expected: { ...v.expected, [fieldId]: value } } : v,
      ),
    );
  };

  const handleTickChange = (id: string, tick: number) => {
    if (!Number.isFinite(tick) || tick < 0) return;
    onChange(vectors.map((v) => (v.id === id ? { ...v, tick } : v)));
  };

  const hasFields = inputFields.length > 0 || outputFields.length > 0;

  if (!hasFields) {
    return (
      <p className="ide-vector-editor-empty" style={{ color: 'var(--rb-text-secondary)', fontSize: '0.85em', margin: '8px 0' }}>
        No IO mapping — add inputs and outputs in Map Pins first.
      </p>
    );
  }

  return (
    <div className="ide-vector-editor" data-testid="ide-verify-vector-editor">
      <table className="ide-vector-editor-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82em' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--rb-text-secondary)' }}>Tick</th>
            {inputFields.map((f) => (
              <th key={f.id} style={{ padding: '4px 6px', color: 'var(--rb-text-secondary)', fontStyle: 'italic' }}>{f.label}</th>
            ))}
            <th style={{ padding: '4px 6px', color: 'var(--rb-text-secondary)', borderLeft: '1px solid var(--rb-border)' }}>→</th>
            {outputFields.map((f) => (
              <th key={f.id} style={{ padding: '4px 6px', color: 'var(--rb-text-secondary)', fontStyle: 'italic' }}>{f.label}</th>
            ))}
            <th style={{ padding: '4px 6px' }} />
          </tr>
        </thead>
        <tbody>
          {vectors.map((v) => (
            <tr key={v.id} data-testid={`ide-vector-row-${v.id}`} style={{ borderTop: '1px solid var(--rb-border)' }}>
              <td style={{ padding: '3px 6px' }}>
                <input
                  type="number"
                  min={0}
                  value={v.tick}
                  onChange={(e) => handleTickChange(v.id, Number(e.target.value))}
                  style={{ width: '44px', background: 'transparent', border: '1px solid var(--rb-border)', color: 'inherit', borderRadius: 3, padding: '1px 4px' }}
                  data-testid={`ide-vector-tick-${v.id}`}
                />
              </td>
              {inputFields.map((f) => (
                <td key={f.id} style={{ padding: '3px 6px', textAlign: 'center' }}>
                  <select
                    value={v.inputs[f.id] ?? 0}
                    onChange={(e) => handleInputChange(v.id, f.id, Number(e.target.value) as 0 | 1)}
                    style={{ background: 'transparent', border: '1px solid var(--rb-border)', color: 'inherit', borderRadius: 3 }}
                    data-testid={`ide-vector-input-${v.id}-${f.id}`}
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                  </select>
                </td>
              ))}
              <td style={{ padding: '3px 6px', borderLeft: '1px solid var(--rb-border)' }} />
              {outputFields.map((f) => (
                <td key={f.id} style={{ padding: '3px 6px', textAlign: 'center' }}>
                  <select
                    value={v.expected[f.id] ?? 0}
                    onChange={(e) => handleExpectedChange(v.id, f.id, Number(e.target.value) as 0 | 1)}
                    style={{ background: 'transparent', border: '1px solid var(--rb-border)', color: 'inherit', borderRadius: 3 }}
                    data-testid={`ide-vector-expected-${v.id}-${f.id}`}
                  >
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                  </select>
                </td>
              ))}
              <td style={{ padding: '3px 6px' }}>
                <button
                  onClick={() => handleDelete(v.id)}
                  title="Delete row"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rb-text-secondary)', fontSize: '1.1em', lineHeight: 1 }}
                  data-testid={`ide-vector-delete-${v.id}`}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={handleAddRow}
        data-testid="ide-vector-add-row"
        style={{
          marginTop: '6px',
          background: 'none',
          border: '1px dashed var(--rb-border)',
          color: 'var(--rb-text-secondary)',
          borderRadius: 4,
          padding: '3px 10px',
          cursor: 'pointer',
          fontSize: '0.82em',
          width: '100%',
        }}
      >
        + Add test vector
      </button>
    </div>
  );
};
