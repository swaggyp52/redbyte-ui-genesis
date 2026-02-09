import React from 'react';
import { useLabStore } from './store';
import { SevenSegmentDisplay } from './seven-segment';

export const Simulator: React.FC = () => {
  const simulationInput = useLabStore((s) => s.simulationInput);
  const setSimulationInput = useLabStore((s) => s.setSimulationInput);
  const runAllVectors = useLabStore((s) => s.runAllVectors);
  const evalSeg = useLabStore((s) => s.evalSeg);
  const validationResults = useLabStore((s) => s.validationResults);

  const currentOutput = evalSeg(simulationInput);
  const currentSeg: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1] = [
    ((currentOutput >> 0) & 1) as 0 | 1,
    ((currentOutput >> 1) & 1) as 0 | 1,
    ((currentOutput >> 2) & 1) as 0 | 1,
    ((currentOutput >> 3) & 1) as 0 | 1,
    ((currentOutput >> 4) & 1) as 0 | 1,
    ((currentOutput >> 5) & 1) as 0 | 1,
    ((currentOutput >> 6) & 1) as 0 | 1,
  ];

  const passCount = validationResults.filter((r) => r.pass).length;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Simulator</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
        <div>
          <h3>Input Controls (B3-B0)</h3>
          <div style={{ marginBottom: '20px' }}>
            {[3, 2, 1, 0].map((bit) => (
              <label key={bit} style={{ display: 'block', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  checked={((simulationInput >> bit) & 1) === 1}
                  onChange={(e) => {
                    const newVal = e.target.checked ? simulationInput | (1 << bit) : simulationInput & ~(1 << bit);
                    setSimulationInput(newVal);
                  }}
                  style={{ marginRight: '8px' }}
                />
                {`B${bit} = ${((simulationInput >> bit) & 1)}`}
              </label>
            ))}
          </div>

          <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
            Input (decimal): <span style={{ color: '#0066cc' }}>{simulationInput}</span>
          </p>

          <button
            onClick={runAllVectors}
            style={{
              padding: '12px 24px',
              backgroundColor: '#00aa00',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Run All 16 Vectors
          </button>
        </div>

        <div>
          <h3>Output Display</h3>
          <SevenSegmentDisplay seg={currentSeg} size={120} />
          <p style={{ marginTop: '20px', fontSize: '14px' }}>
            seg[6:0] = {currentSeg.map((s) => s).reverse().join('')}
          </p>
        </div>
      </div>

      {validationResults.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h3>
            Validation Results: {passCount}/10 Correct{' '}
            {passCount === 10 ? '✅' : passCount >= 8 ? '⚠️' : '❌'}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginTop: '20px',
            }}
          >
            {validationResults.slice(0, 10).map((result) => (
              <div
                key={result.input}
                style={{
                  padding: '12px',
                  backgroundColor: result.pass ? '#e8f5e9' : '#ffebee',
                  border: `2px solid ${result.pass ? '#4caf50' : '#f44336'}`,
                  borderRadius: 4,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>Input {result.input}</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Expected: {result.expected.toString(2).padStart(7, '0')}
                </div>
                <div style={{ fontSize: '12px' }}>
                  Got: {result.actual.toString(2).padStart(7, '0')}
                </div>
                <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                  {result.pass ? '✅' : '❌'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
