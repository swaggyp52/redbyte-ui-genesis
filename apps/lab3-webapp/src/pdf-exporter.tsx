import React, { useRef, useState } from 'react';
import { useLabStore } from './store';
import { FileText, Download, Loader } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const PdfExporter: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const truthTable = useLabStore((s) => s.truthTable);
  const booleanExpressions = useLabStore((s) => s.booleanExpressions);
  const validationResults = useLabStore((s) => s.validationResults);
  const kMaps = useLabStore((s) => s.kMaps);

  const handleGeneratePDF = async () => {
    setIsGenerating(true);
    try {
      if (!reportRef.current) return;

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
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. See console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PDF Generation Button */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-pink-400 flex items-center gap-2">
            <FileText size={24} />
            Export Lab Report as PDF
          </h3>
          <button
            onClick={handleGeneratePDF}
            disabled={isGenerating}
            className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-700 rounded-lg flex items-center gap-2 font-medium transition-all"
          >
            {isGenerating ? (
              <>
                <Loader size={18} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download size={18} />
                Generate & Download PDF
              </>
            )}
          </button>
        </div>

        <p className="text-slate-300 text-sm mb-4">
          Your report includes the truth table, K-maps, boolean expressions, validation results, and all evidence
          needed for lab submission.
        </p>

        {validationResults.length > 0 && (
          <div className="bg-slate-800 rounded p-3 text-sm">
            <div className="flex gap-4">
              <div>
                <div className="text-emerald-400 font-bold">
                  {validationResults.filter((r) => r.pass).length}/{validationResults.length}
                </div>
                <div className="text-xs text-slate-400">Vectors Passed</div>
              </div>
              {validationResults.filter((r) => !r.pass).length > 0 && (
                <div>
                  <div className="text-red-400 font-bold">
                    {validationResults.filter((r) => !r.pass).length}
                  </div>
                  <div className="text-xs text-slate-400">Failed</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Report Preview */}
      <div
        ref={reportRef}
        className="bg-slate-900 rounded-lg border border-slate-700 p-8 text-slate-50 hidden-for-pdf"
        style={{ pageBreakInside: 'avoid' }}
      >
        <h2 className="text-3xl font-bold text-center mb-8 text-cyan-400">Lab 3 Report</h2>
        <p className="text-center text-slate-400 mb-8">Seven-Segment Display Driver Design</p>

        {/* Meta Info */}
        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
          <div>
            <div className="text-slate-400">Generated</div>
            <div className="font-mono text-slate-200">{new Date().toLocaleString()}</div>
          </div>
          <div>
            <div className="text-slate-400">Version</div>
            <div className="font-mono text-slate-200">v2.0</div>
          </div>
        </div>

        {/* Validation Summary */}
        {validationResults.length > 0 && (
          <div className="mb-8 bg-slate-800 rounded p-4 border border-slate-700">
            <h3 className="font-bold mb-4 text-cyan-400">Validation Results</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-emerald-400 text-2xl font-bold">
                  {validationResults.filter((r) => r.pass).length}/{validationResults.length}
                </div>
                <div className="text-sm text-slate-400">Vectors Validated</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {(
                    (validationResults.filter((r) => r.pass).length / validationResults.length) *
                    100
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-sm text-slate-400">Success Rate</div>
              </div>
            </div>

            {/* Validation Table */}
            <div className="overflow-x-auto text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left p-2 text-slate-300">Input</th>
                    <th className="text-left p-2 text-slate-300">Expected</th>
                    <th className="text-left p-2 text-slate-300">Actual</th>
                    <th className="text-left p-2 text-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResults.map((result) => (
                    <tr key={result.input} className="border-b border-slate-700">
                      <td className="p-2 font-mono text-slate-200">{result.input.toString(2).padStart(4, '0')}</td>
                      <td className="p-2 font-mono text-slate-200">
                        {result.expected.toString(2).padStart(7, '0')}
                      </td>
                      <td className="p-2 font-mono text-slate-200">
                        {result.actual.toString(2).padStart(7, '0')}
                      </td>
                      <td className={`p-2 font-bold ${result.pass ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.pass ? '✓' : '✗'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Boolean Expressions */}
        <div className="mb-8">
          <h3 className="font-bold mb-4 text-cyan-400">Simplified Boolean Expressions</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(booleanExpressions).map(([seg, expr]) => (
              <div key={seg} className="bg-slate-800 rounded p-3 border border-slate-700">
                <div className="text-emerald-400 font-bold mb-2">seg_{seg}</div>
                <div className="font-mono text-sm text-slate-200 break-words">{expr || '(empty)'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Truth Table */}
        <div className="mb-8">
          <h3 className="font-bold mb-4 text-cyan-400">Truth Table</h3>
          <div className="overflow-x-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left p-2 text-slate-300">Input</th>
                  <th className="text-center p-2 text-slate-300">a</th>
                  <th className="text-center p-2 text-slate-300">b</th>
                  <th className="text-center p-2 text-slate-300">c</th>
                  <th className="text-center p-2 text-slate-300">d</th>
                  <th className="text-center p-2 text-slate-300">e</th>
                  <th className="text-center p-2 text-slate-300">f</th>
                  <th className="text-center p-2 text-slate-300">g</th>
                </tr>
              </thead>
              <tbody>
                {truthTable.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-700">
                    <td className="p-2 font-mono text-slate-200">{idx}</td>
                    {row.seg.map((val, segIdx) => (
                      <td key={segIdx} className="text-center p-2 font-mono text-slate-200">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center text-slate-500 text-xs mt-8 pt-4 border-t border-slate-700">
          Lab 3 Webapp v2.0 | Generated with automated design tooling
        </div>
      </div>
    </div>
  );
};
