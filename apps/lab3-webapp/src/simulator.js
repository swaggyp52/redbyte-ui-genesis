import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLabStore } from './store';
import { SevenSegmentDisplay } from './seven-segment';
export const Simulator = () => {
    const simulationInput = useLabStore((s) => s.simulationInput);
    const setSimulationInput = useLabStore((s) => s.setSimulationInput);
    const runAllVectors = useLabStore((s) => s.runAllVectors);
    const evalSeg = useLabStore((s) => s.evalSeg);
    const validationResults = useLabStore((s) => s.validationResults);
    const currentOutput = evalSeg(simulationInput);
    const currentSeg = [
        ((currentOutput >> 0) & 1),
        ((currentOutput >> 1) & 1),
        ((currentOutput >> 2) & 1),
        ((currentOutput >> 3) & 1),
        ((currentOutput >> 4) & 1),
        ((currentOutput >> 5) & 1),
        ((currentOutput >> 6) & 1),
    ];
    const passCount = validationResults.filter((r) => r.pass).length;
    return (_jsxs("div", { style: { padding: '20px' }, children: [_jsx("h2", { children: "Simulator" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }, children: [_jsxs("div", { children: [_jsx("h3", { children: "Input Controls (B3-B0)" }), _jsx("div", { style: { marginBottom: '20px' }, children: [3, 2, 1, 0].map((bit) => (_jsxs("label", { style: { display: 'block', marginBottom: '12px' }, children: [_jsx("input", { type: "checkbox", checked: ((simulationInput >> bit) & 1) === 1, onChange: (e) => {
                                                const newVal = e.target.checked ? simulationInput | (1 << bit) : simulationInput & ~(1 << bit);
                                                setSimulationInput(newVal);
                                            }, style: { marginRight: '8px' } }), `B${bit} = ${((simulationInput >> bit) & 1)}`] }, bit))) }), _jsxs("p", { style: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }, children: ["Input (decimal): ", _jsx("span", { style: { color: '#0066cc' }, children: simulationInput })] }), _jsx("button", { onClick: runAllVectors, style: {
                                    padding: '12px 24px',
                                    backgroundColor: '#00aa00',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                }, children: "Run All 16 Vectors" })] }), _jsxs("div", { children: [_jsx("h3", { children: "Output Display" }), _jsx(SevenSegmentDisplay, { seg: currentSeg, size: 120 }), _jsxs("p", { style: { marginTop: '20px', fontSize: '14px' }, children: ["seg[6:0] = ", currentSeg.map((s) => s).reverse().join('')] })] })] }), validationResults.length > 0 && (_jsxs("div", { style: { marginTop: '40px' }, children: [_jsxs("h3", { children: ["Validation Results: ", passCount, "/10 Correct", ' ', passCount === 10 ? '✅' : passCount >= 8 ? '⚠️' : '❌'] }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '12px',
                            marginTop: '20px',
                        }, children: validationResults.slice(0, 10).map((result) => (_jsxs("div", { style: {
                                padding: '12px',
                                backgroundColor: result.pass ? '#e8f5e9' : '#ffebee',
                                border: `2px solid ${result.pass ? '#4caf50' : '#f44336'}`,
                                borderRadius: 4,
                                textAlign: 'center',
                            }, children: [_jsxs("div", { style: { fontWeight: 'bold' }, children: ["Input ", result.input] }), _jsxs("div", { style: { fontSize: '12px', marginTop: '4px' }, children: ["Expected: ", result.expected.toString(2).padStart(7, '0')] }), _jsxs("div", { style: { fontSize: '12px' }, children: ["Got: ", result.actual.toString(2).padStart(7, '0')] }), _jsx("div", { style: { marginTop: '8px', fontSize: '14px', fontWeight: 'bold' }, children: result.pass ? '✅' : '❌' })] }, result.input))) })] }))] }));
};
