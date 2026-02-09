import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { useLabStore } from './store';
import { FileText, Download, Loader } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
export const PdfExporter = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const reportRef = useRef(null);
    const truthTable = useLabStore((s) => s.truthTable);
    const booleanExpressions = useLabStore((s) => s.booleanExpressions);
    const validationResults = useLabStore((s) => s.validationResults);
    const kMaps = useLabStore((s) => s.kMaps);
    const handleGeneratePDF = async () => {
        setIsGenerating(true);
        try {
            if (!reportRef.current)
                return;
            // Capture the report element as an image
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#0f172a',
                scale: 2,
                logging: false,
            });
            // Create PDF
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210 - 20; // A4 width minus margins
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let yPos = 10;
            let pageHeight = pdf.internal.pageSize.height;
            // Add images (might span multiple pages)
            pdf.addImage(imgData, 'PNG', 10, yPos, imgWidth, imgHeight);
            let currentHeight = imgHeight;
            while (currentHeight > pageHeight - 20) {
                pdf.addPage();
                yPos = 0;
                currentHeight -= pageHeight;
                if (currentHeight > 0) {
                    pdf.addImage(imgData, 'PNG', 10, yPos - (imgHeight - (pageHeight - 20)), imgWidth, imgHeight);
                }
            }
            // Add metadata page
            pdf.addPage();
            pdf.setFontSize(16);
            pdf.text('Lab 3 Report - Metadata', 10, 10);
            pdf.setFontSize(10);
            let y = 30;
            pdf.text(`Generated: ${new Date().toLocaleString()}`, 10, y);
            y += 10;
            const passedVectors = validationResults.filter((r) => r.pass).length;
            pdf.text(`Validation: ${passedVectors}/${validationResults.length} vectors passed`, 10, y);
            y += 15;
            pdf.text('Boolean Expressions:', 10, y);
            y += 8;
            Object.entries(booleanExpressions).forEach(([seg, expr]) => {
                if (expr) {
                    pdf.text(`seg_${seg}: ${expr}`, 15, y);
                    y += 6;
                }
            });
            // Download
            pdf.save(`lab3-report-${new Date().getTime()}.pdf`);
        }
        catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('Failed to generate PDF. See console for details.');
        }
        finally {
            setIsGenerating(false);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h3", { className: "text-xl font-bold text-pink-400 flex items-center gap-2", children: [_jsx(FileText, { size: 24 }), "Export Lab Report as PDF"] }), _jsx("button", { onClick: handleGeneratePDF, disabled: isGenerating, className: "px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-700 rounded-lg flex items-center gap-2 font-medium transition-all", children: isGenerating ? (_jsxs(_Fragment, { children: [_jsx(Loader, { size: 18, className: "animate-spin" }), "Generating..."] })) : (_jsxs(_Fragment, { children: [_jsx(Download, { size: 18 }), "Generate & Download PDF"] })) })] }), _jsx("p", { className: "text-slate-300 text-sm mb-4", children: "Your report includes the truth table, K-maps, boolean expressions, validation results, and all evidence needed for lab submission." }), validationResults.length > 0 && (_jsx("div", { className: "bg-slate-800 rounded p-3 text-sm", children: _jsxs("div", { className: "flex gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-emerald-400 font-bold", children: [validationResults.filter((r) => r.pass).length, "/", validationResults.length] }), _jsx("div", { className: "text-xs text-slate-400", children: "Vectors Passed" })] }), validationResults.filter((r) => !r.pass).length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-red-400 font-bold", children: validationResults.filter((r) => !r.pass).length }), _jsx("div", { className: "text-xs text-slate-400", children: "Failed" })] }))] }) }))] }), _jsxs("div", { ref: reportRef, className: "bg-slate-900 rounded-lg border border-slate-700 p-8 text-slate-50 hidden-for-pdf", style: { pageBreakInside: 'avoid' }, children: [_jsx("h2", { className: "text-3xl font-bold text-center mb-8 text-cyan-400", children: "Lab 3 Report" }), _jsx("p", { className: "text-center text-slate-400 mb-8", children: "Seven-Segment Display Driver Design" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-8 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-slate-400", children: "Generated" }), _jsx("div", { className: "font-mono text-slate-200", children: new Date().toLocaleString() })] }), _jsxs("div", { children: [_jsx("div", { className: "text-slate-400", children: "Version" }), _jsx("div", { className: "font-mono text-slate-200", children: "v2.0" })] })] }), validationResults.length > 0 && (_jsxs("div", { className: "mb-8 bg-slate-800 rounded p-4 border border-slate-700", children: [_jsx("h3", { className: "font-bold mb-4 text-cyan-400", children: "Validation Results" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 mb-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-emerald-400 text-2xl font-bold", children: [validationResults.filter((r) => r.pass).length, "/", validationResults.length] }), _jsx("div", { className: "text-sm text-slate-400", children: "Vectors Validated" })] }), _jsxs("div", { children: [_jsxs("div", { className: "text-2xl font-bold", children: [((validationResults.filter((r) => r.pass).length / validationResults.length) *
                                                        100).toFixed(1), "%"] }), _jsx("div", { className: "text-sm text-slate-400", children: "Success Rate" })] })] }), _jsx("div", { className: "overflow-x-auto text-xs", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-600", children: [_jsx("th", { className: "text-left p-2 text-slate-300", children: "Input" }), _jsx("th", { className: "text-left p-2 text-slate-300", children: "Expected" }), _jsx("th", { className: "text-left p-2 text-slate-300", children: "Actual" }), _jsx("th", { className: "text-left p-2 text-slate-300", children: "Status" })] }) }), _jsx("tbody", { children: validationResults.map((result) => (_jsxs("tr", { className: "border-b border-slate-700", children: [_jsx("td", { className: "p-2 font-mono text-slate-200", children: result.input.toString(2).padStart(4, '0') }), _jsx("td", { className: "p-2 font-mono text-slate-200", children: result.expected.toString(2).padStart(7, '0') }), _jsx("td", { className: "p-2 font-mono text-slate-200", children: result.actual.toString(2).padStart(7, '0') }), _jsx("td", { className: `p-2 font-bold ${result.pass ? 'text-emerald-400' : 'text-red-400'}`, children: result.pass ? '✓' : '✗' })] }, result.input))) })] }) })] })), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "font-bold mb-4 text-cyan-400", children: "Simplified Boolean Expressions" }), _jsx("div", { className: "grid grid-cols-2 gap-4", children: Object.entries(booleanExpressions).map(([seg, expr]) => (_jsxs("div", { className: "bg-slate-800 rounded p-3 border border-slate-700", children: [_jsxs("div", { className: "text-emerald-400 font-bold mb-2", children: ["seg_", seg] }), _jsx("div", { className: "font-mono text-sm text-slate-200 break-words", children: expr || '(empty)' })] }, seg))) })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h3", { className: "font-bold mb-4 text-cyan-400", children: "Truth Table" }), _jsx("div", { className: "overflow-x-auto text-xs", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-600", children: [_jsx("th", { className: "text-left p-2 text-slate-300", children: "Input" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "a" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "b" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "c" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "d" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "e" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "f" }), _jsx("th", { className: "text-center p-2 text-slate-300", children: "g" })] }) }), _jsx("tbody", { children: truthTable.slice(0, 10).map((row, idx) => (_jsxs("tr", { className: "border-b border-slate-700", children: [_jsx("td", { className: "p-2 font-mono text-slate-200", children: idx }), row.seg.map((val, segIdx) => (_jsx("td", { className: "text-center p-2 font-mono text-slate-200", children: val }, segIdx)))] }, idx))) })] }) })] }), _jsx("div", { className: "text-center text-slate-500 text-xs mt-8 pt-4 border-t border-slate-700", children: "Lab 3 Webapp v2.0 | Generated with automated design tooling" })] })] }));
};
