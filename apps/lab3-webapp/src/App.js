import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { TruthTableEditor } from './truth-table';
import { Simulator } from './simulator';
import { VerilogExporter } from './verilog';
import { useLabStore } from './store';
export const App = () => {
    const [tab, setTab] = React.useState('table');
    const reset = useLabStore((s) => s.reset);
    return (_jsxs("div", { style: { minHeight: '100vh', backgroundColor: '#f5f5f5' }, children: [_jsxs("header", { style: {
                    backgroundColor: '#1a1a1a',
                    color: 'white',
                    padding: '20px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }, children: [_jsx("h1", { style: { margin: '0 0 10px 0' }, children: "Lab 3: Seven-Segment Display Driver" }), _jsx("p", { style: { margin: 0, fontSize: '14px', color: '#aaa' }, children: "Design a 4-bit to 7-segment decoder (active-low, inputs 0-9, don't-cares 10-15)" })] }), _jsxs("nav", { style: {
                    backgroundColor: '#333',
                    padding: '10px 20px',
                    display: 'flex',
                    gap: '10px',
                    justifyContent: 'center',
                    alignItems: 'center',
                }, children: [_jsx("button", { onClick: () => setTab('table'), style: {
                            padding: '10px 20px',
                            backgroundColor: tab === 'table' ? '#0066cc' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: tab === 'table' ? 'bold' : 'normal',
                        }, children: "1. Truth Table" }), _jsx("button", { onClick: () => setTab('simulator'), style: {
                            padding: '10px 20px',
                            backgroundColor: tab === 'simulator' ? '#0066cc' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: tab === 'simulator' ? 'bold' : 'normal',
                        }, children: "2. Simulator" }), _jsx("button", { onClick: () => setTab('verilog'), style: {
                            padding: '10px 20px',
                            backgroundColor: tab === 'verilog' ? '#0066cc' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: tab === 'verilog' ? 'bold' : 'normal',
                        }, children: "3. Verilog & Export" }), _jsx("button", { onClick: reset, style: {
                            padding: '10px 20px',
                            backgroundColor: '#aa0000',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            marginLeft: 'auto',
                        }, children: "Reset" })] }), _jsxs("main", { style: { maxWidth: '1400px', margin: '0 auto' }, children: [tab === 'table' && _jsx(TruthTableEditor, {}), tab === 'simulator' && _jsx(Simulator, {}), tab === 'verilog' && _jsx(VerilogExporter, {})] }), _jsx("footer", { style: {
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: '#f0f0f0',
                    color: '#666',
                    marginTop: '40px',
                    fontSize: '14px',
                }, children: _jsx("p", { children: "Lab 3 Web Tool v1.0 \u2014 Active-low seven-segment decoder simulator. Use alongside Vivado for synthesis and FPGA programming." }) })] }));
};
