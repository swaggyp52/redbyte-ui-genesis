import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useLabStore } from './store/labStore';
import { FileText, Download, Loader2, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
export const PdfExporter = () => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState('');
    const [complete, setComplete] = useState(false);
    const truthTable = useLabStore((s) => s.doc.truthTable);
    const docMeta = useLabStore((s) => s.doc.meta);
    const booleanExpressions = useLabStore((s) => s.doc.expressions);
    const verilogCode = useLabStore((s) => s.verilogCode);
    const kMaps = useLabStore((s) => s.doc.kMaps);
    const validationResults = useLabStore((s) => s.validationResults);
    const emitEvent = useLabStore((s) => s.emitEvent);
    const handleGeneratePDF = async () => {
        setIsGenerating(true);
        setComplete(false);
        setProgress('Initializing PDF generator...');
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = margin;
            // Helper to add new page if needed
            const checkPageBreak = (requiredHeight) => {
                if (yPos + requiredHeight > pageHeight - margin) {
                    pdf.addPage();
                    yPos = margin;
                    return true;
                }
                return false;
            };
            // Cover Page
            setProgress('Creating cover page...');
            pdf.setFillColor(8, 21, 39);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(32);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Lab 3 Report', pageWidth / 2, 80, { align: 'center' });
            pdf.setFontSize(18);
            pdf.text('Seven-Segment Display Decoder', pageWidth / 2, 95, { align: 'center' });
            pdf.setTextColor(148, 163, 184);
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 110, { align: 'center' });
            // Student info
            const studentName = docMeta.studentName || 'Unknown';
            const section = docMeta.section || '';
            const studentId = docMeta.studentId || '';
            pdf.setFontSize(11);
            pdf.text(`Student: ${studentName}`, pageWidth / 2, 122, { align: 'center' });
            if (section)
                pdf.text(`Section: ${section}`, pageWidth / 2, 130, { align: 'center' });
            if (studentId)
                pdf.text(`ID: ${studentId}`, pageWidth / 2, 138, { align: 'center' });
            pdf.setTextColor(16, 185, 129);
            pdf.setFontSize(14);
            pdf.text('RedByte FPGA Laboratory', pageWidth / 2, pageHeight - 30, { align: 'center' });
            pdf.addPage();
            yPos = margin;
            // Page 1: Truth Table
            setProgress('Formatting truth table...');
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('1. Truth Table', margin, yPos);
            yPos += 10;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const colWidth = 12;
            const headerY = yPos;
            pdf.setFont('helvetica', 'bold');
            pdf.text('B3', margin + colWidth * 0.5, headerY, { align: 'center' });
            pdf.text('B2', margin + colWidth * 1.5, headerY, { align: 'center' });
            pdf.text('B1', margin + colWidth * 2.5, headerY, { align: 'center' });
            pdf.text('B0', margin + colWidth * 3.5, headerY, { align: 'center' });
            pdf.text('a', margin + colWidth * 5, headerY, { align: 'center' });
            pdf.text('b', margin + colWidth * 6, headerY, { align: 'center' });
            pdf.text('c', margin + colWidth * 7, headerY, { align: 'center' });
            pdf.text('d', margin + colWidth * 8, headerY, { align: 'center' });
            pdf.text('e', margin + colWidth * 9, headerY, { align: 'center' });
            pdf.text('f', margin + colWidth * 10, headerY, { align: 'center' });
            pdf.text('g', margin + colWidth * 11, headerY, { align: 'center' });
            yPos += 5;
            pdf.line(margin, yPos, margin + colWidth * 12, yPos);
            yPos += 5;
            pdf.setFont('helvetica', 'normal');
            truthTable.forEach((row, idx) => {
                const b3 = row.b3;
                const b2 = row.b2;
                const b1 = row.b1;
                const b0 = row.b0;
                pdf.text(b3.toString(), margin + colWidth * 0.5, yPos, { align: 'center' });
                pdf.text(b2.toString(), margin + colWidth * 1.5, yPos, { align: 'center' });
                pdf.text(b1.toString(), margin + colWidth * 2.5, yPos, { align: 'center' });
                pdf.text(b0.toString(), margin + colWidth * 3.5, yPos, { align: 'center' });
                row.seg.forEach((val, segIdx) => {
                    pdf.text(val.toString(), margin + colWidth * (5 + segIdx), yPos, { align: 'center' });
                });
                yPos += 5;
            });
            // Page 2: Boolean Expressions
            checkPageBreak(80);
            yPos += 10;
            setProgress('Adding Boolean expressions...');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('2. Boolean Expressions', margin, yPos);
            yPos += 10;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(11);
            ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((seg) => {
                const expr = booleanExpressions[seg] || 'Not defined';
                pdf.setFont('helvetica', 'bold');
                pdf.text(`seg_${seg} =`, margin, yPos);
                pdf.setFont('courier', 'normal');
                const wrappedText = pdf.splitTextToSize(expr, pageWidth - margin * 2 - 20);
                pdf.text(wrappedText, margin + 20, yPos);
                yPos += 7 * wrappedText.length;
                checkPageBreak(10);
            });
            // Page 3: K-Maps
            yPos += 10;
            checkPageBreak(120);
            setProgress('Drawing Karnaugh maps...');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('3. Karnaugh Maps', margin, yPos);
            yPos += 10;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(10);
            ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((seg) => {
                checkPageBreak(35);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Segment ${seg.toUpperCase()}:`, margin, yPos);
                yPos += 6;
                const kmap = kMaps[seg];
                if (kmap) {
                    pdf.setFont('courier', 'normal');
                    pdf.setFontSize(8);
                    const cellSize = 10;
                    const startX = margin + 15;
                    pdf.text('B1B0', startX - 12, yPos - 1);
                    pdf.text('00', startX + cellSize * 0.3, yPos);
                    pdf.text('01', startX + cellSize * 1.3, yPos);
                    pdf.text('11', startX + cellSize * 2.3, yPos);
                    pdf.text('10', startX + cellSize * 3.3, yPos);
                    yPos += 4;
                    ['00', '01', '11', '10'].forEach((rowLabel, rowIdx) => {
                        pdf.text(rowLabel, startX - 10, yPos + cellSize * 0.6);
                        ['00', '01', '11', '10'].forEach((colLabel, colIdx) => {
                            const idx = rowIdx * 4 + colIdx;
                            const value = kmap[idx] !== undefined ? kmap[idx] : 0;
                            const x = startX + colIdx * cellSize;
                            pdf.rect(x, yPos, cellSize, cellSize);
                            pdf.setFontSize(9);
                            pdf.text(value.toString(), x + cellSize * 0.4, yPos + cellSize * 0.7);
                            pdf.setFontSize(8);
                        });
                        if (rowIdx === 0) {
                            pdf.text('B3B2', startX - 12, yPos + cellSize * 1.5);
                        }
                        yPos += cellSize;
                    });
                }
                yPos += 10;
            });
            // Page 4: Circuit Diagram
            pdf.addPage();
            yPos = margin;
            setProgress('Capturing circuit diagram...');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('4. Circuit Diagram', margin, yPos);
            yPos += 10;
            const allCanvases = document.querySelectorAll('canvas');
            const targetCanvas = Array.from(allCanvases).find(c => c.width === 1200 && c.height === 700);
            if (targetCanvas) {
                try {
                    const canvasImg = targetCanvas.toDataURL('image/png');
                    const imgWidth = pageWidth - 2 * margin;
                    const imgHeight = (targetCanvas.height / targetCanvas.width) * imgWidth;
                    if (yPos + imgHeight > pageHeight - margin) {
                        pdf.addPage();
                        yPos = margin;
                    }
                    pdf.addImage(canvasImg, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, pageHeight - margin - yPos - 10));
                    yPos += Math.min(imgHeight, pageHeight - margin - yPos - 10) + 10;
                }
                catch (err) {
                    pdf.setTextColor(100, 100, 100);
                    pdf.setFontSize(10);
                    pdf.text('Circuit diagram capture not available', margin, yPos);
                    yPos += 10;
                }
            }
            else {
                pdf.setTextColor(100, 100, 100);
                pdf.setFontSize(10);
                pdf.text('No circuit diagram to capture', margin, yPos);
                yPos += 10;
            }
            // Page 5: Verilog Code
            pdf.addPage();
            yPos = margin;
            setProgress('Adding Verilog code...');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('5. Verilog Implementation', margin, yPos);
            yPos += 10;
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(7);
            pdf.setFont('courier', 'normal');
            const codeLines = verilogCode.split('\n');
            codeLines.forEach((line) => {
                if (checkPageBreak(4)) {
                    pdf.setFont('courier', 'normal');
                    pdf.setFontSize(7);
                }
                pdf.text(line.substring(0, 90), margin, yPos);
                yPos += 3.5;
            });
            // Page 6: Validation Results
            pdf.addPage();
            yPos = margin;
            setProgress('Adding validation results...');
            pdf.setTextColor(6, 182, 212);
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('6. Validation Results', margin, yPos);
            yPos += 10;
            if (validationResults.length > 0) {
                const passCount = validationResults.filter(r => r.pass).length;
                const totalCount = validationResults.length;
                pdf.setFontSize(14);
                if (passCount === totalCount) {
                    pdf.setTextColor(16, 185, 129);
                    pdf.text(`✓ All tests passed (${passCount}/${totalCount})`, margin, yPos);
                }
                else {
                    pdf.setTextColor(239, 68, 68);
                    pdf.text(`✗ ${totalCount - passCount} tests failed (${passCount}/${totalCount} passed)`, margin, yPos);
                }
                yPos += 10;
                pdf.setTextColor(0, 0, 0);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'normal');
                validationResults.forEach((result) => {
                    checkPageBreak(8);
                    const icon = result.pass ? '✓' : '✗';
                    const color = result.pass ? [16, 185, 129] : [239, 68, 68];
                    pdf.setTextColor(...color);
                    pdf.text(`${icon} Input ${result.input}: Expected ${result.expected}, Got ${result.actual}`, margin, yPos);
                    yPos += 6;
                });
            }
            else {
                pdf.setTextColor(148, 163, 184);
                pdf.setFontSize(11);
                pdf.text('No validation results available.', margin, yPos);
                yPos += 6;
                pdf.text('Run validation in the Live Validation tab before generating report.', margin, yPos);
            }
            // Save PDF
            setProgress('Generating PDF file...');
            pdf.save(`Lab3_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            // Emit export.pdf event with page count (use getPages() length if available, else 6)
            const pageCount = pdf.getPages?.().length ?? 6;
            emitEvent('export.pdf', {
                pages: pageCount,
            });
            setProgress('Complete!');
            setComplete(true);
            setTimeout(() => {
                setIsGenerating(false);
                setComplete(false);
            }, 2000);
        }
        catch (error) {
            console.error('PDF generation error:', error);
            setProgress(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setTimeout(() => setIsGenerating(false), 3000);
        }
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsxs("h2", { className: "font-tech-display text-2xl font-bold text-pink-400 mb-2 flex items-center gap-2", children: [_jsx(FileText, { size: 28 }), "PDF Report Generator"] }), _jsx("p", { className: "font-digital text-sm text-slate-400", children: "Export your complete lab work as a professional PDF document" })] }), _jsxs("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: [_jsx("h3", { className: "font-tech font-semibold text-emerald-400 mb-4", children: "Report Contents" }), _jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2 font-digital text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-cyan-400" }), "Cover page with lab title and date"] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-cyan-400" }), "Complete truth table (16 rows)"] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-cyan-400" }), "Boolean expressions for all segments"] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-cyan-400" }), "Karnaugh maps with values"] })] }), _jsxs("div", { className: "space-y-2 font-digital text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-emerald-400" }), "Circuit diagram capture"] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-emerald-400" }), "Complete Verilog source code"] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-emerald-400" }), "Validation test results"] }), _jsxs("div", { className: "flex items-center gap-2 text-slate-300", children: [_jsx("div", { className: "w-2 h-2 rounded-full bg-emerald-400" }), "RedByte branding"] })] })] }), validationResults.length > 0 && (_jsx("div", { className: "mt-4 bg-slate-800/50 rounded-lg p-4", children: _jsxs("div", { className: "flex gap-6", children: [_jsxs("div", { children: [_jsxs("div", { className: `text-2xl font-bold ${validationResults.filter((r) => r.pass).length === validationResults.length ? 'text-emerald-400' : 'text-amber-400'}`, children: [validationResults.filter((r) => r.pass).length, "/", validationResults.length] }), _jsx("div", { className: "text-xs text-slate-400 font-digital", children: "Tests Passed" })] }), validationResults.filter((r) => !r.pass).length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-red-400", children: validationResults.filter((r) => !r.pass).length }), _jsx("div", { className: "text-xs text-slate-400 font-digital", children: "Failed" })] }))] }) }))] }), _jsx("div", { className: "bg-slate-900/50 border border-slate-700 rounded-xl p-6", children: _jsx("button", { onClick: handleGeneratePDF, disabled: isGenerating, className: `w-full py-4 px-6 rounded-lg font-tech font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${complete
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white glow-box-emerald'
                        : isGenerating
                            ? 'bg-slate-700 text-slate-400 cursor-wait'
                            : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white'}`, children: complete ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { size: 24 }), "PDF Generated Successfully!"] })) : isGenerating ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 24, className: "animate-spin" }), progress] })) : (_jsxs(_Fragment, { children: [_jsx(Download, { size: 24 }), "Generate & Download PDF"] })) }) }), _jsx("div", { className: "bg-slate-900/30 border border-slate-700/50 rounded-lg p-4", children: _jsxs("div", { className: "font-digital text-xs text-slate-400 space-y-2", children: [_jsx("p", { children: "\uD83D\uDCC4 Report includes all lab components: truth table, K-maps, Boolean expressions, circuit diagram, Verilog code, and validation results" }), _jsx("p", { children: "\uD83C\uDFA8 Professional formatting with RedByte branding and technical aesthetics" }), _jsx("p", { children: "\uD83D\uDCCA Automatic page breaks and layout optimization for print/digital submission" }), _jsx("p", { children: "\uD83D\uDCBE PDF file saved with date stamp: Lab3_Report_YYYY-MM-DD.pdf" })] }) })] }));
};
