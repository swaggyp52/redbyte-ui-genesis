import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import JSZip from 'jszip';
import { useLabStore } from './store';
export const VerilogExporter = () => {
    const truthTable = useLabStore((s) => s.truthTable);
    const implMode = useLabStore((s) => s.implMode);
    const verilogCode = useLabStore((s) => s.verilogCode);
    const parseVerilogCase = useLabStore((s) => s.parseVerilogCase);
    const exportJSON = useLabStore((s) => s.exportJSON);
    const validationResults = useLabStore((s) => s.validationResults);
    const [pastedVerilog, setPastedVerilog] = React.useState('');
    const generateVerilog = () => {
        let code = `module ssd_driver(
  input [3:0] B,
  output reg [6:0] seg
);

always @(*) begin
  case (B)
`;
        for (let i = 0; i < 10; i++) {
            const row = truthTable[i];
            const segVal = row.seg.reverse().join('');
            code += `    4'b${i.toString(2).padStart(4, '0')}: seg = 7'b${segVal};\n`;
        }
        code += `    default: seg = 7'b1111111;  // Blank for don't-cares\n`;
        code += `  endcase\nend\n\nendmodule\n`;
        code += `\n// Top-level module for Basys3\nmodule lab3_top(\n`;
        code += `  input [3:0] SW,\n`;
        code += `  output [6:0] SEG,\n`;
        code += `  output [3:0] AN,\n`;
        code += `  output DP\n`;
        code += `);\n\n`;
        code += `  assign AN = 4'b1110;  // Enable first display\n`;
        code += `  assign DP = 1'b1;     // Disable decimal point\n\n`;
        code += `  ssd_driver driver(.B(SW), .seg(SEG));\n\n`;
        code += `endmodule\n`;
        return code;
    };
    const handleExportZip = async () => {
        const zip = new JSZip();
        // Add truth table JSON
        const tableData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            truthTable: truthTable.map((row, i) => ({
                input: i,
                b3: row.b3,
                b2: row.b2,
                b1: row.b1,
                b0: row.b0,
                seg: row.seg,
                isDontCare: row.isDontCare,
            })),
        };
        zip.file('truth_table.json', JSON.stringify(tableData, null, 2));
        // Add generated Verilog
        const verilogContent = generateVerilog();
        zip.file('generated_ssd_driver.v', verilogContent);
        // Add results JSON
        const resultsData = {
            timestamp: new Date().toISOString(),
            appVersion: '1.0.0',
            validationResults: validationResults,
            summary: {
                totalVectors: 16,
                requiredCorrect: 10,
                completelyCorrect: validationResults.filter((r) => r.pass).length,
            },
        };
        zip.file('results.json', JSON.stringify(resultsData, null, 2));
        // Add README
        const readme = `# Lab 3 Submission - Seven-Segment Display Driver

## Files Included
- **truth_table.json**: Your truth table in machine-readable format
- **generated_ssd_driver.v**: Verilog module generated from your truth table
- **results.json**: Validation results from the simulator

## Next Steps
1. Open the Verilog file in Vivado
2. Verify it compiles without errors
3. Create a constraint file (.xdc) mapping to Basys3 pins:
   - SW[3:0] = Input switches
   - SEG[6:0] = Seven-segment segments
   - AN[3:0] = Display enable (1110 for first display)
   - DP = Decimal point
4. Synthesize, implement, and program the FPGA
5. Test with the physical Basys3 board

## Validation Summary
These inputs must display correctly (0-9):
${validationResults.slice(0, 10).map((r) => `- Input ${r.input}: ${r.pass ? '✓' : '✗'}`).join('\n')}

Inputs 10-15 (don't-cares) show a blank display.
`;
        zip.file('README.txt', readme);
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab3-submission-${new Date().getTime()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs("div", { style: { padding: '20px' }, children: [_jsx("h2", { children: "Verilog Helper & Export" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }, children: [_jsxs("div", { children: [_jsx("h3", { children: "Generated Verilog (from Truth Table)" }), _jsx("textarea", { value: generateVerilog(), readOnly: true, style: {
                                    width: '100%',
                                    height: '400px',
                                    fontFamily: 'monospace',
                                    padding: '10px',
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    fontSize: '12px',
                                } }), _jsx("button", { onClick: () => {
                                    navigator.clipboard.writeText(generateVerilog());
                                    alert('Verilog copied to clipboard!');
                                }, style: {
                                    padding: '8px 16px',
                                    marginTop: '10px',
                                    backgroundColor: '#0066cc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                }, children: "Copy to Clipboard" })] }), _jsxs("div", { children: [_jsx("h3", { children: "Paste Vivado Case Statement" }), _jsx("textarea", { value: pastedVerilog, onChange: (e) => setPastedVerilog(e.target.value), placeholder: "Paste your case statement from Vivado...", style: {
                                    width: '100%',
                                    height: '250px',
                                    fontFamily: 'monospace',
                                    padding: '10px',
                                    border: '1px solid #ccc',
                                    borderRadius: 4,
                                    fontSize: '12px',
                                } }), _jsx("button", { onClick: () => {
                                    parseVerilogCase(pastedVerilog);
                                    setPastedVerilog('');
                                    alert('Verilog parsed! Table updated.');
                                }, style: {
                                    padding: '8px 16px',
                                    marginTop: '10px',
                                    marginRight: '10px',
                                    backgroundColor: '#0066cc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                }, children: "Parse & Update Table" })] })] }), _jsxs("div", { style: { marginTop: '40px' }, children: [_jsx("h3", { children: "Export Submission Package" }), _jsx("button", { onClick: handleExportZip, style: {
                            padding: '12px 24px',
                            backgroundColor: '#ff6600',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                        }, children: "Download ZIP (truth_table.json + generated_ssd_driver.v + results.json + README)" }), _jsx("p", { style: { marginTop: '10px', fontSize: '12px', color: '#666' }, children: "This ZIP contains everything you need to submit for Lab 3." })] })] }));
};
