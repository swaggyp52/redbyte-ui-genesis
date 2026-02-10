import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import JSZip from 'jszip';
import { useLabStore } from './store/labStore';
import { Copy, Download, Upload, Code2 } from 'lucide-react';
import { PdfExporter } from './pdf-exporter';
export const VerilogExporter = () => {
    const truthTable = useLabStore((s) => s.doc.truthTable);
    const parseVerilogCase = useLabStore((s) => s.parseVerilogCase);
    const generateVerilogFromExpr = useLabStore((s) => s.generateVerilogFromExpr);
    const booleanExpressions = useLabStore((s) => s.doc.expressions);
    const validationResults = useLabStore((s) => s.validationResults);
    const [pastedVerilog, setPastedVerilog] = useState('');
    const [modulePrefix, setModulePrefix] = useState('ssd_driver');
    const [exportSuccess, setExportSuccess] = useState(false);
    const generateVerilogCaseStatement = () => {
        let code = `module ${modulePrefix}(
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
        code += `\n// Top-level module for Basys3 integration\n`;
        code += `module lab3_top(\n`;
        code += `  input [3:0] SW,\n`;
        code += `  output [6:0] SEG,\n`;
        code += `  output [3:0] AN,\n`;
        code += `  output DP\n`;
        code += `);\n\n`;
        code += `  assign AN = 4'b1110;  // Enable first display\n`;
        code += `  assign DP = 1'b1;     // Disable decimal point\n\n`;
        code += `  ${modulePrefix} driver(.B(SW), .seg(SEG));\n\n`;
        code += `endmodule\n`;
        return code;
    };
    const generateVerilogAssign = () => {
        let code = `// Boolean assignment style\nmodule ${modulePrefix}(\n`;
        code += `  input [3:0] B,\n`;
        code += `  output [6:0] seg\n`;
        code += `);\n\n`;
        const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        for (let i = 0; i < segNames.length; i++) {
            const expr = booleanExpressions[segNames[i]];
            if (expr) {
                // Convert expression to Verilog
                const verilogExpr = expr
                    .replace(/·/g, ' & ')
                    .replace(/\+/g, ' | ')
                    .replace(/'/g, ' & ~');
                code += `  assign seg[${i}] = ${verilogExpr};\n`;
            }
        }
        code += `\nendmodule\n`;
        return code;
    };
    const handleExportZip = async () => {
        const zip = new JSZip();
        // Add truth table JSON
        const tableData = {
            version: '2.0',
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
            booleanExpressions,
        };
        zip.file('truth_table.json', JSON.stringify(tableData, null, 2));
        // Add case statement Verilog
        zip.file(`${modulePrefix}_case.v`, generateVerilogCaseStatement());
        // Add assign-style Verilog  
        const exprCode = generateVerilogAssign();
        if (exprCode.trim().length > 0) {
            zip.file(`${modulePrefix}_assign.v`, exprCode);
        }
        // Add results JSON
        const resultsData = {
            timestamp: new Date().toISOString(),
            appVersion: '2.0.0',
            validationResults: validationResults,
            summary: {
                totalVectors: 16,
                requiredCorrect: 10,
                completelyCorrect: validationResults.filter((r) => r.pass).length,
                booleanExpressionsUsed: Object.entries(booleanExpressions)
                    .filter(([, expr]) => expr.trim())
                    .reduce((acc, [key]) => {
                    acc[key] = true;
                    return acc;
                }, {}),
            },
        };
        zip.file('results.json', JSON.stringify(resultsData, null, 2));
        // Add README
        const readmeText = `# Lab 3 Submission - Seven-Segment Display Driver

## Files Included
- **truth_table.json**: Complete truth table + boolean expressions
- **${modulePrefix}_case.v**: Case statement style (recommended for simplicity)
- **${modulePrefix}_assign.v**: Boolean assignment style (if expressions provided)
- **results.json**: Validation results

## Implementation Guide
1. Open Vivado and create a new RTL project
2. Choose "${modulePrefix}_case.v" or "${modulePrefix}_assign.v"
3. Create constraints file (.xdc):
   \`\`\`tcl
   set_property PACKAGE_PIN V17 [get_ports {B[0]}];  # SW[0]
   set_property PACKAGE_PIN V16 [get_ports {B[1]}];  # SW[1]
   set_property PACKAGE_PIN W16 [get_ports {B[2]}];  # SW[2]
   set_property PACKAGE_PIN W17 [get_ports {B[3]}];  # SW[3]

   set_property PACKAGE_PIN W7 [get_ports {seg[0]}];  # CA (a)
   set_property PACKAGE_PIN W6 [get_ports {seg[1]}];  # CB (b)
   set_property PACKAGE_PIN U8 [get_ports {seg[2]}];  # CC (c)
   set_property PACKAGE_PIN V8 [get_ports {seg[3]}];  # CD (d)
   set_property PACKAGE_PIN U5 [get_ports {seg[4]}];  # CE (e)
   set_property PACKAGE_PIN V5 [get_ports {seg[5]}];  # CF (f)
   set_property PACKAGE_PIN U7 [get_ports {seg[6]}];  # CG (g)

   set_property PACKAGE_PIN U2 [get_ports {AN[0]}];   # AN[0]
   set_property PACKAGE_PIN U4 [get_ports {AN[1]}];   # AN[1]
   set_property PACKAGE_PIN V4 [get_ports {AN[2]}];   # AN[2]
   set_property PACKAGE_PIN W4 [get_ports {AN[3]}];   # AN[3]

   set_property PACKAGE_PIN V7 [get_ports DP];        # Decimal point
   \`\`\`
4. Synthesize & Implement
5. Generate bitstream
6. Program Basys3 board

## Validation Results
Below: Verification that truth table values match all digits 0-9

${validationResults
            .slice(0, 10)
            .map((r) => `- Input ${r.input} (${r.input.toString(16).toUpperCase()}): ${r.pass ? '✓ PASS' : '✗ FAIL'}`)
            .join('\n')}

Inputs 10-15 (Don't-care): Display blank (0x7F)

## Technical Notes
- Active-low logic: 0 = segment ON (lit), 1 = segment OFF (dark)
- Basys3 uses multiplexed 7-segment display (only first display enabled)
- Decimal point disabled (tied high)

Generated with Lab 3 Webapp v2.0
Timestamp: ${new Date().toLocaleString()}
`;
        zip.file('README.md', readmeText);
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lab3-submission-${new Date().getTime()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        // Show success feedback
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-blue-400 mb-4 flex items-center gap-2", children: [_jsx(Code2, { size: 24 }), "Verilog Code Generation"] }), _jsx("div", { className: "space-y-4 mb-6", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-2", children: "Module Name:" }), _jsx("input", { type: "text", value: modulePrefix, onChange: (e) => setModulePrefix(e.target.value), className: "w-full max-w-xs bg-slate-800 text-slate-50 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500", placeholder: "ssd_driver" })] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-blue-300 mb-3", children: "Case Statement Style" }), _jsx("textarea", { value: generateVerilogCaseStatement(), readOnly: true, className: "w-full h-80 bg-slate-900 text-slate-50 border border-slate-700 rounded p-3 font-mono text-xs focus:outline-none overflow-auto color-scheme-dark" }), _jsxs("button", { onClick: () => copyToClipboard(generateVerilogCaseStatement()), className: "mt-3 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded flex items-center gap-2 text-sm font-medium transition-colors", children: [_jsx(Copy, { size: 16 }), "Copy to Clipboard"] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-green-300 mb-3", children: "Boolean Assignment Style" }), _jsx("textarea", { value: generateVerilogAssign(), readOnly: true, className: "w-full h-80 bg-slate-900 text-slate-50 border border-slate-700 rounded p-3 font-mono text-xs focus:outline-none overflow-auto color-scheme-dark" }), _jsxs("button", { onClick: () => copyToClipboard(generateVerilogAssign()), className: "mt-3 px-4 py-2 bg-green-700 hover:bg-green-600 rounded flex items-center gap-2 text-sm font-medium transition-colors", children: [_jsx(Copy, { size: 16 }), "Copy to Clipboard"] })] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-purple-400 mb-4 flex items-center gap-2", children: [_jsx(Upload, { size: 24 }), "Import from Vivado"] }), _jsx("p", { className: "text-slate-300 text-sm mb-4", children: "Paste a case statement from your Vivado implementation to import and verify against your truth table." }), _jsx("textarea", { value: pastedVerilog, onChange: (e) => setPastedVerilog(e.target.value), placeholder: "Paste your case, endcase block here...", className: "w-full h-40 bg-slate-900 text-slate-50 border border-slate-700 rounded p-3 font-mono text-sm focus:outline-none focus:border-purple-500" }), _jsx("button", { onClick: () => {
                            parseVerilogCase(pastedVerilog);
                            setPastedVerilog('');
                            alert('Verilog parsed! Truth table updated.');
                        }, className: "mt-3 px-6 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium transition-colors", children: "Parse & Update Table" })] }), _jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-orange-400 mb-4 flex items-center gap-2", children: [_jsx(Download, { size: 24 }), "Export Submission Package"] }), _jsx("p", { className: "text-slate-300 text-sm mb-4", children: "Download a complete ZIP archive containing truth table, Verilog code, validation results, and documentation." }), _jsxs("button", { onClick: handleExportZip, className: "px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-lg font-bold text-lg transition-all flex items-center gap-2", children: [_jsx(Download, { size: 20 }), "Download ZIP Archive"] }), exportSuccess && (_jsxs("div", { className: "mt-4 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm flex items-center gap-2", children: [_jsx(Download, { size: 16 }), _jsx("span", { children: "ZIP file exported successfully!" })] }))] }), _jsx(PdfExporter, {})] }));
};
