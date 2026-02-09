import React from 'react';
import { TruthTableEditor } from './truth-table';
import { Simulator } from './simulator';
import { VerilogExporter } from './verilog';
import { useLabStore } from './store';

export const App: React.FC = () => {
  const [tab, setTab] = React.useState<'table' | 'simulator' | 'verilog'>('table');
  const reset = useLabStore((s) => s.reset);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <header
        style={{
          backgroundColor: '#1a1a1a',
          color: 'white',
          padding: '20px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <h1 style={{ margin: '0 0 10px 0' }}>Lab 3: Seven-Segment Display Driver</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>
          Design a 4-bit to 7-segment decoder (active-low, inputs 0-9, don't-cares 10-15)
        </p>
      </header>

      <nav
        style={{
          backgroundColor: '#333',
          padding: '10px 20px',
          display: 'flex',
          gap: '10px',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => setTab('table')}
          style={{
            padding: '10px 20px',
            backgroundColor: tab === 'table' ? '#0066cc' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: tab === 'table' ? 'bold' : 'normal',
          }}
        >
          1. Truth Table
        </button>

        <button
          onClick={() => setTab('simulator')}
          style={{
            padding: '10px 20px',
            backgroundColor: tab === 'simulator' ? '#0066cc' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: tab === 'simulator' ? 'bold' : 'normal',
          }}
        >
          2. Simulator
        </button>

        <button
          onClick={() => setTab('verilog')}
          style={{
            padding: '10px 20px',
            backgroundColor: tab === 'verilog' ? '#0066cc' : '#555',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: tab === 'verilog' ? 'bold' : 'normal',
          }}
        >
          3. Verilog & Export
        </button>

        <button
          onClick={reset}
          style={{
            padding: '10px 20px',
            backgroundColor: '#aa0000',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Reset
        </button>
      </nav>

      <main style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {tab === 'table' && <TruthTableEditor />}
        {tab === 'simulator' && <Simulator />}
        {tab === 'verilog' && <VerilogExporter />}
      </main>

      <footer
        style={{
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#f0f0f0',
          color: '#666',
          marginTop: '40px',
          fontSize: '14px',
        }}
      >
        <p>
          Lab 3 Web Tool v1.0 — Active-low seven-segment decoder simulator. Use alongside Vivado for synthesis and FPGA programming.
        </p>
      </footer>
    </div>
  );
};
