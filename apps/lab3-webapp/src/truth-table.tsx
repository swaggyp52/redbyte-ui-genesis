import React from 'react';
import { useLabStore } from './store';
import { SevenSegmentDisplay } from './seven-segment';

export const TruthTableEditor: React.FC = () => {
  const truthTable = useLabStore((s) => s.truthTable);
  const setTableRow = useLabStore((s) => s.setTableRow);
  const toggleDontCare = useLabStore((s) => s.toggleDontCare);
  const fillStandardDigits = useLabStore((s) => s.fillStandardDigits);
  const [selectedRow, setSelectedRow] = React.useState(0);

  const selectedSeg = truthTable[selectedRow]?.seg || [1, 1, 1, 1, 1, 1, 1];

  const toggleSegment = (segIndex: number) => {
    const row = truthTable[selectedRow]!;
    const newSeg = [...row.seg] as [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
    newSeg[segIndex] = newSeg[segIndex] === 0 ? 1 : 0;
    setTableRow(selectedRow, { seg: newSeg });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Truth Table Editor</h2>

      <button onClick={fillStandardDigits} style={{ padding: '10px 20px', marginBottom: '20px', fontSize: '14px' }}>
        Fill Standard Digits (0-9)
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
        <div>
          <h3>Select Input (0-15)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {truthTable.map((row, i) => (
              <button
                key={i}
                onClick={() => setSelectedRow(i)}
                style={{
                  padding: '10px',
                  backgroundColor: selectedRow === i ? '#0066cc' : '#ddd',
                  color: selectedRow === i ? 'white' : 'black',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: selectedRow === i ? 'bold' : 'normal',
                }}
              >
                {i}
              </button>
            ))}
          </div>

          <div style={{ marginTop: '20px' }}>
            <label>
              <input
                type="checkbox"
                checked={truthTable[selectedRow]?.isDontCare || false}
                onChange={() => toggleDontCare(selectedRow)}
              />
              {' Don\'t Care (inputs 10-15)'}
            </label>
          </div>
        </div>

        <div>
          <h3>Input: {selectedRow} (B3.B2.B1.B0)</h3>
          <div style={{ marginBottom: '20px' }}>
            <p>
              B3={truthTable[selectedRow]?.b3} B2={truthTable[selectedRow]?.b2} B1={truthTable[selectedRow]?.b1} B0={truthTable[selectedRow]?.b0}
            </p>
          </div>

          <h4>Segments (click to toggle):</h4>
          <div style={{ marginBottom: '20px' }}>
            {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((name, idx) => (
              <button
                key={name}
                onClick={() => toggleSegment(idx)}
                style={{
                  padding: '8px 16px',
                  margin: '4px',
                  backgroundColor: selectedSeg[idx] === 0 ? '#00ff00' : '#ddd',
                  color: selectedSeg[idx] === 0 ? 'black' : 'black',
                  border: '1px solid #999',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                seg_{name} = {selectedSeg[idx]}
              </button>
            ))}
          </div>

          <h4>Live Preview:</h4>
          <SevenSegmentDisplay seg={selectedSeg} size={80} />
        </div>
      </div>
    </div>
  );
};
