import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import JSZip from 'jszip';
import { useLabStore } from './store/labStore';
import { Copy, Download, Upload, Code2, ChevronDown } from 'lucide-react';
import { PdfExporter } from './pdf-exporter';
import { generateXdcString } from './xdcPins';
import { parseVhdlEntity } from './circuit-designer-pro/circuitToVhdl';
export const VerilogExporter = () => {
    const truthTable = useLabStore((s) => s.doc.truthTable);
    const parseVerilogCase = useLabStore((s) => s.parseVerilogCase);
    const parseVhdlCase = useLabStore((s) => s.parseVhdlCaseStatement);
    const generateVerilogFromExpr = useLabStore((s) => s.generateVerilogFromExpr);
    const booleanExpressions = useLabStore((s) => s.doc.expressions);
    const validationResults = useLabStore((s) => s.validationResults);
    const [pastedVerilog, setPastedVerilog] = useState('');
    const [modulePrefix, setModulePrefix] = useState('ssd_driver');
    const [exportSuccess, setExportSuccess] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [parsedEntity, setParsedEntity] = useState(null);
    const [detectedLang, setDetectedLang] = useState('unknown');
    const [showExamples, setShowExamples] = useState(false);
    // ─── HDL auto-detect and port preview ────────────────────────────────────
    function detectLang(code) {
        if (/entity\s+\w+\s+is/i.test(code))
            return 'vhdl';
        if (/module\s+\w+|4'b[01]{4}/.test(code))
            return 'verilog';
        return 'unknown';
    }
    function handlePasteChange(code) {
        setPastedVerilog(code);
        setImportResult(null);
        const lang = detectLang(code);
        setDetectedLang(lang);
        if (lang === 'vhdl') {
            setParsedEntity(parseVhdlEntity(code));
        }
        else {
            setParsedEntity(null);
        }
    }
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
            const segVal = [...row.seg].reverse().join('');
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
                // Convert expression to Verilog (handle NOT first: B0' → ~B0)
                const verilogExpr = expr
                    .replace(/([A-Za-z][A-Za-z0-9]*)\'/g, '~$1')
                    .replace(/·/g, ' & ')
                    .replace(/\+/g, ' | ');
                code += `  assign seg[${i}] = ${verilogExpr};\n`;
            }
        }
        code += `\nendmodule\n`;
        return code;
    };
    // Delegates to shared xdcPins.ts — single source of truth for Basys3 pins
    const generateXdcContent = () => generateXdcString();
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
        // Add XDC constraints file
        zip.file('basys3_constraints.xdc', generateXdcContent());
        // Add README
        const readmeText = `# Lab 3 Submission - Seven-Segment Display Driver

## Files Included
- **truth_table.json**: Complete truth table + boolean expressions
- **${modulePrefix}_case.v**: Case statement style (recommended for simplicity)
- **${modulePrefix}_assign.v**: Boolean assignment style (if expressions provided)
- **results.json**: Validation results
- **basys3_constraints.xdc**: Vivado constraint file (add directly to your Vivado project)

## Implementation Guide
1. Open Vivado and create a new RTL project
2. Add "${modulePrefix}_case.v" or "${modulePrefix}_assign.v" as a design source
3. Add **basys3_constraints.xdc** as a constraints source (no manual editing needed)
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
    // ─── Import examples ──────────────────────────────────────────────────────
    const IMPORT_EXAMPLES = [
        {
            label: 'Verilog — AND gate',
            lang: 'verilog',
            code: `module and_gate(\n  input [3:0] B,\n  output reg [6:0] seg\n);\nalways @(*) begin\n  case (B)\n    4'b0000: seg = 7'b1111110; // 0\n    4'b0001: seg = 7'b0110000; // 1\n    4'b0010: seg = 7'b1101101; // 2\n    4'b0011: seg = 7'b1111001; // 3\n    default: seg = 7'b1111111;\n  endcase\nend\nendmodule`,
        },
        {
            label: 'Verilog — 7-Seg case',
            lang: 'verilog',
            code: `always @(*) begin\n  case (B)\n    4'b0000: seg = 7'b1000000;\n    4'b0001: seg = 7'b1111001;\n    4'b0010: seg = 7'b0100100;\n    4'b0011: seg = 7'b0110000;\n    4'b0100: seg = 7'b0011001;\n    4'b0101: seg = 7'b0010010;\n    4'b0110: seg = 7'b0000010;\n    4'b0111: seg = 7'b1111000;\n    4'b1000: seg = 7'b0000000;\n    4'b1001: seg = 7'b0010000;\n    default: seg = 7'b1111111;\n  endcase\nend`,
        },
        {
            label: 'VHDL — AND gate',
            lang: 'vhdl',
            code: `library IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\n\nentity and_gate is\n  port (\n    A : in  STD_LOGIC;\n    B : in  STD_LOGIC;\n    Y : out STD_LOGIC\n  );\nend and_gate;\n\narchitecture Behavioral of and_gate is\nbegin\n  Y <= A AND B;\nend Behavioral;`,
        },
        {
            label: 'VHDL — 7-Seg',
            lang: 'vhdl',
            code: `library IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\n\nentity ssd_driver is\n  port (\n    B   : in  STD_LOGIC_VECTOR(3 downto 0);\n    seg : out STD_LOGIC_VECTOR(6 downto 0)\n  );\nend ssd_driver;\n\narchitecture Behavioral of ssd_driver is\nbegin\n  process(B)\n  begin\n    case B is\n      when "0000" => seg <= "1000000";\n      when "0001" => seg <= "1111001";\n      when "0010" => seg <= "0100100";\n      when "0011" => seg <= "0110000";\n      when "0100" => seg <= "0011001";\n      when "0101" => seg <= "0010010";\n      when "0110" => seg <= "0000010";\n      when "0111" => seg <= "1111000";\n      when "1000" => seg <= "0000000";\n      when "1001" => seg <= "0010000";\n      when others => seg <= "1111111";\n    end case;\n  end process;\nend Behavioral;`,
        },
        {
            label: 'VHDL — Passthrough',
            lang: 'vhdl',
            code: `library IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\n\nentity passthrough is\n  port (\n    SW  : in  STD_LOGIC_VECTOR(3 downto 0);\n    LED : out STD_LOGIC_VECTOR(3 downto 0)\n  );\nend passthrough;\n\narchitecture Behavioral of passthrough is\nbegin\n  LED <= SW;\nend Behavioral;`,
        },
    ];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-blue-400 mb-4 flex items-center gap-2", children: [_jsx(Code2, { size: 24 }), "Verilog Code Generation"] }), _jsx("div", { className: "space-y-4 mb-6", children: _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-2", children: "Module Name:" }), _jsx("input", { type: "text", value: modulePrefix, onChange: (e) => setModulePrefix(e.target.value), className: "w-full max-w-xs bg-slate-800 text-slate-50 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500", placeholder: "ssd_driver" })] }) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-blue-300 mb-3", children: "Case Statement Style" }), _jsx("textarea", { value: generateVerilogCaseStatement(), readOnly: true, className: "w-full h-80 bg-slate-900 text-slate-50 border border-slate-700 rounded p-3 font-mono text-xs focus:outline-none overflow-auto color-scheme-dark" }), _jsxs("button", { onClick: () => copyToClipboard(generateVerilogCaseStatement()), className: "mt-3 px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded flex items-center gap-2 text-sm font-medium transition-colors", children: [_jsx(Copy, { size: 16 }), "Copy to Clipboard"] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-green-300 mb-3", children: "Boolean Assignment Style" }), _jsx("textarea", { value: generateVerilogAssign(), readOnly: true, className: "w-full h-80 bg-slate-900 text-slate-50 border border-slate-700 rounded p-3 font-mono text-xs focus:outline-none overflow-auto color-scheme-dark" }), _jsxs("button", { onClick: () => copyToClipboard(generateVerilogAssign()), className: "mt-3 px-4 py-2 bg-green-700 hover:bg-green-600 rounded flex items-center gap-2 text-sm font-medium transition-colors", children: [_jsx(Copy, { size: 16 }), "Copy to Clipboard"] })] })] })] }), _jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h3", { className: "text-xl font-bold text-purple-400 flex items-center gap-2", children: [_jsx(Upload, { size: 24 }), "Import from Vivado"] }), _jsxs("div", { className: "relative", children: [_jsxs("button", { onClick: () => setShowExamples(v => !v), className: "flex items-center gap-1.5 text-sm px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded border border-slate-600 text-slate-300 transition-colors", children: ["Examples", _jsx(ChevronDown, { size: 14, className: showExamples ? 'rotate-180 transition-transform' : 'transition-transform' })] }), showExamples && (_jsx("div", { className: "absolute right-0 top-full mt-1 z-10 bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-52 py-1", children: IMPORT_EXAMPLES.map((ex) => (_jsxs("button", { onClick: () => { handlePasteChange(ex.code); setShowExamples(false); }, className: "w-full text-left px-3 py-2 text-sm hover:bg-slate-700 text-slate-300 flex items-center justify-between gap-2", children: [_jsx("span", { children: ex.label }), _jsx("span", { className: `text-xs px-1.5 py-0.5 rounded font-mono ${ex.lang === 'vhdl' ? 'bg-cyan-900/60 text-cyan-400' : 'bg-green-900/60 text-green-400'}`, children: ex.lang })] }, ex.label))) }))] })] }), _jsx("p", { className: "text-slate-300 text-sm mb-3", children: "Paste Verilog or VHDL from your Vivado implementation \u2014 auto-detected, then imported into your truth table." }), detectedLang !== 'unknown' && (_jsxs("div", { className: `mb-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono ${detectedLang === 'vhdl'
                            ? 'bg-cyan-900/40 border-cyan-500/50 text-cyan-300'
                            : 'bg-green-900/40 border-green-500/50 text-green-300'}`, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-current" }), detectedLang.toUpperCase(), " detected"] })), _jsx("textarea", { value: pastedVerilog, onChange: (e) => handlePasteChange(e.target.value), placeholder: "Paste Verilog case/endcase or VHDL case architecture here...", className: "w-full h-40 bg-slate-900 text-slate-50 border border-slate-700 rounded p-3 font-mono text-sm focus:outline-none focus:border-purple-500" }), parsedEntity && (_jsxs("div", { className: "mt-3 flex items-center gap-4 p-4 bg-slate-950/60 rounded-lg border border-slate-700", children: [_jsx("div", { className: "space-y-1.5 min-w-[60px]", children: parsedEntity.inputs.map(p => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono text-xs text-cyan-300", children: p }), _jsx("div", { className: "flex-1 h-px bg-cyan-500/60 min-w-[12px]" })] }, p))) }), _jsxs("div", { className: "border border-cyan-500/40 rounded px-4 py-3 text-center min-w-[120px] bg-slate-900/60", children: [_jsx("div", { className: "text-cyan-400 text-sm font-semibold", children: parsedEntity.entityName }), _jsx("div", { className: "text-slate-500 text-xs uppercase mt-0.5", children: detectedLang })] }), _jsx("div", { className: "space-y-1.5 min-w-[60px]", children: parsedEntity.outputs.map(p => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-px bg-emerald-500/60 min-w-[12px]" }), _jsx("span", { className: "font-mono text-xs text-emerald-300", children: p })] }, p))) })] })), _jsxs("div", { className: "mt-3 flex items-center gap-3", children: [_jsx("button", { onClick: () => {
                                    const matched = detectedLang === 'vhdl'
                                        ? parseVhdlCase(pastedVerilog)
                                        : parseVerilogCase(pastedVerilog);
                                    if (matched === 0) {
                                        setImportResult({
                                            ok: false,
                                            message: detectedLang === 'vhdl'
                                                ? `No rows matched. Expected VHDL: when "0110" => seg <= "1010101";`
                                                : `No rows matched. Expected Verilog: 4'b0110: seg = 7'b1010101;`,
                                        });
                                    }
                                    else {
                                        setImportResult({ ok: true, message: `Imported ${matched} row${matched !== 1 ? 's' : ''} from ${detectedLang.toUpperCase()}. Truth table updated.` });
                                        setPastedVerilog('');
                                        setParsedEntity(null);
                                        setDetectedLang('unknown');
                                    }
                                }, className: "px-6 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium transition-colors", children: "Parse & Update Table" }), pastedVerilog && (_jsx("button", { onClick: () => { handlePasteChange(''); setShowExamples(false); }, className: "px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors", children: "Clear" }))] }), importResult && (_jsxs("div", { className: `mt-3 p-3 rounded text-sm flex items-start gap-2 ${importResult.ok ? 'bg-emerald-900/40 border border-emerald-500/50 text-emerald-300' : 'bg-red-900/40 border border-red-500/50 text-red-300'}`, children: [_jsx("span", { children: importResult.ok ? '✓' : '✗' }), _jsx("span", { children: importResult.message })] }))] }), _jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("h3", { className: "text-xl font-bold text-orange-400 mb-4 flex items-center gap-2", children: [_jsx(Download, { size: 24 }), "Export Submission Package"] }), _jsx("p", { className: "text-slate-300 text-sm mb-4", children: "Download a complete ZIP archive containing truth table, Verilog code, validation results, and documentation." }), _jsxs("button", { onClick: handleExportZip, className: "px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 rounded-lg font-bold text-lg transition-all flex items-center gap-2", children: [_jsx(Download, { size: 20 }), "Download ZIP Archive"] }), exportSuccess && (_jsxs("div", { className: "mt-4 p-3 bg-emerald-900/30 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm flex items-center gap-2", children: [_jsx(Download, { size: 16 }), _jsx("span", { children: "ZIP file exported successfully!" })] }))] }), _jsx(PdfExporter, {})] }));
};
