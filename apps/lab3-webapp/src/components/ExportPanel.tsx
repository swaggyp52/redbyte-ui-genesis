/**
 * ExportPanel Component
 * Provides buttons and UI for exporting Lab3 work in multiple formats
 */

import React, { useRef, useState } from 'react';
import {
  exportAsJSON,
  exportAsCSV,
  exportAsZip,
  generatePDFReport,
  captureCanvasImage,
  captureSegmentDisplay,
  downloadFile,
  downloadBlob,
} from '../export';
import { useLabStore } from '../store/labStore';

type ExportFormat = 'json' | 'csv' | 'zip' | 'pdf';

interface ExportPanelProps {
  className?: string;
  onExportStart?: (format: ExportFormat) => void;
  onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

/**
 * ExportPanel - unified export interface
 */
export const ExportPanel: React.FC<ExportPanelProps> = ({
  className = '',
  onExportStart,
  onExportComplete,
}) => {
  const doc = useLabStore((s) => s.doc);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [lastExportTime, setLastExportTime] = useState<number | null>(null);
  const circuitCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleExport = async (format: ExportFormat) => {
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
            includeNotes: (doc.meta as any)?.['studentNotes'] || undefined,
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
      onExportComplete?.(format, true);
    } catch (error) {
      console.error(`Export failed for format ${format}:`, error);
      onExportComplete?.(format, false);
    } finally {
      setIsExporting(null);
    }
  };

  const exportButtons: Array<{
    format: ExportFormat;
    label: string;
    icon: string;
    description: string;
    color: string;
  }> = [
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Export Header */}
      <div className="border-b border-cyan-500/30 pb-3">
        <h3 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
          <span>📤</span> Export & Report
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Save your work in multiple formats for backup, submission, or sharing
        </p>
      </div>

      {/* Export Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {exportButtons.map(({ format, label, icon, description, color }) => (
          <button
            key={format}
            onClick={() => handleExport(format)}
            disabled={isExporting !== null}
            className={`p-3 rounded border border-gray-600 transition-all text-left group ${
              isExporting === format ? 'opacity-50 cursor-wait' : ''
            } ${isExporting !== null && isExporting !== format ? 'opacity-50' : ''}`}
          >
            <div className={`p-2 rounded ${color} text-white font-semibold text-sm mb-1`}>
              {isExporting === format ? (
                <span className="inline-block animate-spin">⏳</span>
              ) : (
                <span>{icon}</span>
              )}{' '}
              {label}
            </div>
            <p className="text-xs text-gray-400">{description}</p>
          </button>
        ))}
      </div>

      {/* Export Feedback */}
      {lastExportTime && (
        <div className="p-2 bg-green-900/20 border border-green-500/30 rounded text-sm text-green-400">
          ✅ Export successful ({Math.round((Date.now() - lastExportTime) / 1000)}s ago)
        </div>
      )}

      {/* Format Descriptions */}
      <details className="text-sm text-gray-400 cursor-pointer">
        <summary className="hover:text-gray-300 font-semibold">Format Guides</summary>
        <div className="mt-2 pl-4 space-y-2 text-xs">
          <div>
            <strong className="text-cyan-300">JSON:</strong> Complete lab document with all state
            (truth table, K-maps, expressions, circuit design, validation status). Best for
            re-opening in Lab3 later.
          </div>
          <div>
            <strong className="text-cyan-300">CSV:</strong> Spreadsheet format with truth table
            and Boolean expressions. Import into Excel/LibreOffice for analysis.
          </div>
          <div>
            <strong className="text-cyan-300">ZIP:</strong> Archive containing JSON, CSVs, and
            metadata. Ideal for backup and multi-format access.
          </div>
          <div>
            <strong className="text-cyan-300">PDF Report:</strong> Formatted, printable report
            showing truth table, expressions, and validation results. Suitable for submission or
            printing.
          </div>
        </div>
      </details>

      {/* Import Hint */}
      <div className="p-2 bg-amber-900/20 border border-amber-500/30 rounded text-xs text-amber-300">
        💡 <strong>Tip:</strong> Save your JSON export regularly. You can load it back by importing
        via File menu to resume work anytime.
      </div>
    </div>
  );
};
