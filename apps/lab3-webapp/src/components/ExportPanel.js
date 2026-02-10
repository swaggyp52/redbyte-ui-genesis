import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ExportPanel Component
 * Provides buttons and UI for exporting Lab3 work in multiple formats
 */
import { useRef, useState } from 'react';
import { exportAsJSON, exportAsCSV, exportAsZip, generatePDFReport, downloadBlob, } from '../export';
import { useLabStore } from '../store/labStore';
/**
 * ExportPanel - unified export interface
 */
export const ExportPanel = ({ className = '', onExportStart, onExportComplete, }) => {
    const doc = useLabStore((s) => s.doc);
    const setLastExportAt = useLabStore((s) => s.setLastExportAt);
    const [isExporting, setIsExporting] = useState(null);
    const [lastExportTime, setLastExportTime] = useState(null);
    const circuitCanvasRef = useRef(null);
    const handleExport = async (format) => {
        try {
            onExportStart?.(format);
            setIsExporting(format);
            const timestamp = new Date().toLocaleString().replace(/[/:\s]/g, '-');
            const projectName = doc.meta.name || 'Lab3-Export';
            switch (format) {
                case 'json': {
                    const blob = await exportAsJSON(doc);
                    downloadBlob(blob, `${projectName}-${timestamp}.json`);
                    break;
                }
                case 'csv': {
                    // Export as ZIP containing CSVs (more convenient than individual files)
                    const csvFiles = await exportAsCSV(doc);
                    const zip = new (await import('jszip')).default();
                    Object.entries(csvFiles).forEach(([name, blob]) => {
                        zip.file(name, blob);
                    });
                    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
                    downloadBlob(zipBlob, `${projectName}-csv-${timestamp}.zip`);
                    break;
                }
                case 'zip': {
                    const zipBlob = await exportAsZip(doc);
                    downloadBlob(zipBlob, `${projectName}-${timestamp}.zip`);
                    break;
                }
                case 'pdf': {
                    // Generate PDF with current state
                    const pdfDataUrl = await generatePDFReport(doc, {
                        includeNotes: doc.meta?.['studentNotes'] || undefined,
                    });
                    // Create download link
                    const link = document.createElement('a');
                    link.href = pdfDataUrl;
                    link.download = `${projectName}-report-${timestamp}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    break;
                }
            }
            setLastExportTime(Date.now());
            setLastExportAt(Date.now());
            onExportComplete?.(format, true);
        }
        catch (error) {
            console.error(`Export failed for format ${format}:`, error);
            onExportComplete?.(format, false);
        }
        finally {
            setIsExporting(null);
        }
    };
    const exportButtons = [
        {
            format: 'json',
            label: 'JSON',
            icon: '📄',
            description: 'Complete lab state (all data)',
            color: 'bg-blue-600 hover:bg-blue-700',
        },
        {
            format: 'csv',
            label: 'CSV',
            icon: '📊',
            description: 'Spreadsheet format (truth table, expressions)',
            color: 'bg-green-600 hover:bg-green-700',
        },
        {
            format: 'zip',
            label: 'ZIP',
            icon: '📦',
            description: 'Complete archive (all formats)',
            color: 'bg-purple-600 hover:bg-purple-700',
        },
        {
            format: 'pdf',
            label: 'PDF Report',
            icon: '📋',
            description: 'Formatted report for printing',
            color: 'bg-red-600 hover:bg-red-700',
        },
    ];
    return (_jsxs("div", { className: `space-y-4 ${className}`, children: [_jsxs("div", { className: "border-b border-cyan-500/30 pb-3", children: [_jsxs("h3", { className: "text-lg font-semibold text-cyan-300 flex items-center gap-2", children: [_jsx("span", { children: "\uD83D\uDCE4" }), " Export & Report"] }), _jsx("p", { className: "text-sm text-gray-400 mt-1", children: "Save your work in multiple formats for backup, submission, or sharing" })] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: exportButtons.map(({ format, label, icon, description, color }) => (_jsxs("button", { onClick: () => handleExport(format), disabled: isExporting !== null, className: `p-3 rounded border border-gray-600 transition-all text-left group ${isExporting === format ? 'opacity-50 cursor-wait' : ''} ${isExporting !== null && isExporting !== format ? 'opacity-50' : ''}`, children: [_jsxs("div", { className: `p-2 rounded ${color} text-white font-semibold text-sm mb-1`, children: [isExporting === format ? (_jsx("span", { className: "inline-block animate-spin", children: "\u23F3" })) : (_jsx("span", { children: icon })), ' ', label] }), _jsx("p", { className: "text-xs text-gray-400", children: description })] }, format))) }), lastExportTime && (_jsxs("div", { className: "p-2 bg-green-900/20 border border-green-500/30 rounded text-sm text-green-400", children: ["\u2705 Export successful (", Math.round((Date.now() - lastExportTime) / 1000), "s ago)"] })), _jsxs("details", { className: "text-sm text-gray-400 cursor-pointer", children: [_jsx("summary", { className: "hover:text-gray-300 font-semibold", children: "Format Guides" }), _jsxs("div", { className: "mt-2 pl-4 space-y-2 text-xs", children: [_jsxs("div", { children: [_jsx("strong", { className: "text-cyan-300", children: "JSON:" }), " Complete lab document with all state (truth table, K-maps, expressions, circuit design, validation status). Best for re-opening in Lab3 later."] }), _jsxs("div", { children: [_jsx("strong", { className: "text-cyan-300", children: "CSV:" }), " Spreadsheet format with truth table and Boolean expressions. Import into Excel/LibreOffice for analysis."] }), _jsxs("div", { children: [_jsx("strong", { className: "text-cyan-300", children: "ZIP:" }), " Archive containing JSON, CSVs, and metadata. Ideal for backup and multi-format access."] }), _jsxs("div", { children: [_jsx("strong", { className: "text-cyan-300", children: "PDF Report:" }), " Formatted, printable report showing truth table, expressions, and validation results. Suitable for submission or printing."] })] })] }), _jsxs("div", { className: "p-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300", children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "Tip:" }), " Save your JSON export regularly. You can load it back by importing via File menu to resume work anytime."] })] }));
};
