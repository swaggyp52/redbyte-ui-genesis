/**
 * Lab 3 Export & Reporting Module
 * Provides JSON export, ZIP archive creation, and PDF report generation
 */

import type { LabDocV2 } from '../plugins/LabDoc';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Export complete Lab3 work as JSON file
 */
export async function exportAsJSON(doc: LabDocV2): Promise<Blob> {
  const json = JSON.stringify(doc, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Export as CSV files (one per segment for truth table data)
 */
export async function exportAsCSV(doc: LabDocV2): Promise<Record<string, Blob>> {
  const csvFiles: Record<string, Blob> = {};

  // Truth table CSV (B3, B2, B1, B0, a, b, c, d, e, f, g, isDontCare)
  const truthTableRows = ['input_decimal,B3,B2,B1,B0,seg_a,seg_b,seg_c,seg_d,seg_e,seg_f,seg_g,isDontCare'];
  doc.truthTable.forEach((row, i) => {
    const csvRow = [
      i,
      row.b3, row.b2, row.b1, row.b0,
      row.seg[0], row.seg[1], row.seg[2], row.seg[3], row.seg[4], row.seg[5], row.seg[6],
      row.isDontCare ? 'true' : 'false',
    ].join(',');
    truthTableRows.push(csvRow);
  });
  csvFiles['truth-table.csv'] = new Blob([truthTableRows.join('\n')], { type: 'text/csv' });

  // Expression CSV (segment, expression)
  const expressionRows = ['segment,boolean_expression'];
  const segments = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  segments.forEach(seg => {
    const expr = (doc.expressions as Record<string, string>)[seg] || '';
    expressionRows.push(`${seg},"${expr}"`);
  });
  csvFiles['expressions.csv'] = new Blob([expressionRows.join('\n')], { type: 'text/csv' });

  return csvFiles;
}

/**
 * Export as ZIP archive containing JSON, CSVs, and metadata
 */
export async function exportAsZip(doc: LabDocV2): Promise<Blob> {
  const zip = new JSZip();

  // Add JSON document
  zip.file('lab3-doc.json', JSON.stringify(doc, null, 2));

  // Add CSV exports
  const csvFiles = await exportAsCSV(doc);
  Object.entries(csvFiles).forEach(([filename, blob]) => {
    zip.file(`data/${filename}`, blob);
  });

  // Add metadata
  const metadata = {
    exportDate: new Date().toISOString(),
    labName: doc.meta.name,
    studentName: doc.meta?.['studentName'] || 'Unknown',
    docId: doc.meta.id,
    schemaVersion: doc.schemaVersion,
    fileCount: 1 + Object.keys(csvFiles).length + 1, // doc + csvs + metadata
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Generate archive
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

/**
 * Generate PDF report of complete lab work
 * Returns base64 data URL suitable for download or embedding
 */
export async function generatePDFReport(
  doc: LabDocV2,
  options?: {
    includeCircuitImage?: string; // Base64 PNG of circuit
    includeScreenshots?: Record<string, string>; // Named screenshots
    includeNotes?: string; // Student notes
  }
): Promise<string> {
  const pdf = new jsPDF({ format: 'a4', unit: 'mm' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;

  let yPos = margin;

  // Helper function to add text with wrapping
  const addText = (text: string, fontSize: number = 12, lineHeight: number = 7, color: [number, number, number] = [0, 0, 0]) => {
    pdf.setTextColor(color[0], color[1], color[2]);
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, contentWidth);
    lines.forEach((line) => {
      if (yPos + lineHeight > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
      pdf.text(line, margin, yPos);
      yPos += lineHeight;
    });
    yPos += 2; // Extra spacing after text block
  };

  const addHeading = (text: string) => {
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(0, 100, 150);
    pdf.text(text, margin, yPos);
    yPos += 15;
  };

  const addSubheading = (text: string) => {
    pdf.setFontSize(13);
    pdf.setFont(undefined, 'bold');
    pdf.setTextColor(50, 50, 50);
    pdf.text(text, margin, yPos);
    yPos += 10;
  };

  // Title Page
  addHeading('Lab 3: Seven-Segment Display Driver');
  addText(`Student: ${doc.meta?.['studentName'] || 'Unknown'}`, 12);
  addText(`Project: ${doc.meta.name}`, 12);
  addText(`Date: ${new Date(doc.meta.updatedAt).toLocaleDateString()}`, 12);
  yPos += 5;

  if (options?.includeNotes) {
    addSubheading('Student Notes');
    addText(options.includeNotes, 10, 6);
  }

  // Truth Table Section
  addSubheading('Truth Table');
  pdf.setFontSize(9);
  pdf.setFont(undefined, 'normal');
  const truthTableHeaders = ['Input', 'B3', 'B2', 'B1', 'B0', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'DC'];
  const truthTableData = doc.truthTable.map((row, i) => [
    String(i),
    String(row.b3), String(row.b2), String(row.b1), String(row.b0),
    String(row.seg[0]), String(row.seg[1]), String(row.seg[2]), String(row.seg[3]),
    String(row.seg[4]), String(row.seg[5]), String(row.seg[6]),
    row.isDontCare ? 'X' : '',
  ]);

  // Use autoTable if available, otherwise simple text output
  // For now, just summarize
  addText(`Total rows: ${doc.truthTable.length} (inputs 0-15, rows 10-15 marked as don't-care)`, 10, 5);

  // Boolean Expressions Section
  addSubheading('Boolean Expressions');
  const segments = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  segments.forEach(seg => {
    const expr = (doc.expressions as Record<string, string>)[seg] || '(not defined)';
    pdf.setFontSize(10);
    pdf.text(`${seg}: `, margin + 2, yPos);
    pdf.setFont(undefined, 'italic');
    addText(expr, 10, 5);
  });

  // Validation Summary
  const validation = (doc.results as any)?.validation;
  if (validation) {
    addSubheading('Validation Summary');
    const color = validation.canAdvance ? [0, 150, 0] as [number, number, number] : [200, 0, 0] as [number, number, number];
    addText(validation.message, 10, 5, color);
  }

  // Circuit Image (if provided)
  if (options?.includeCircuitImage) {
    addSubheading('Circuit Design');
    // Add image at max 100mm width
    try {
      pdf.addImage(options.includeCircuitImage, 'PNG', margin, yPos, 100, 60);
      yPos += 65;
    } catch (e) {
      addText('(Circuit image failed to embed)', 10, 5, [200, 0, 0]);
    }
  }

  // Screenshots (if provided)
  if (options?.includeScreenshots && Object.keys(options.includeScreenshots).length > 0) {
    Object.entries(options.includeScreenshots).forEach(([name, base64]) => {
      if (yPos + 70 > pageHeight - margin) {
        pdf.addPage();
        yPos = margin;
      }
      addSubheading(`Screenshot: ${name}`);
      try {
        pdf.addImage(base64, 'PNG', margin, yPos, 100, 60);
        yPos += 65;
      } catch (e) {
        addText(`(Screenshot '${name}' failed to embed)`, 10, 5, [200, 0, 0]);
      }
    });
  }

  // Export Info
  if (yPos + 20 > pageHeight - margin) {
    pdf.addPage();
    yPos = margin;
  }
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generated: ${new Date().toISOString()}`, margin, pageHeight - 5);

  // Return as data URL for download or preview
  return pdf.output('dataurlstring') as string;
}

/**
 * Capture circuit canvas as PNG and return base64
 */
export async function captureCanvasImage(canvasElement: HTMLCanvasElement): Promise<string> {
  const canvas = await html2canvas(canvasElement, {
    backgroundColor: '#1a1a1a', // Dark background
    scale: 2, // 2x resolution for clarity
  });
  return canvas.toDataURL('image/png');
}

/**
 * Capture 7-segment display as PNG
 */
export async function captureSegmentDisplay(displayElement: HTMLElement): Promise<string> {
  const canvas = await html2canvas(displayElement, {
    backgroundColor: null,
    scale: 2,
  });
  return canvas.toDataURL('image/png');
}

/**
 * Download blob with filename
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generic file download helper (base64 or Blob)
 */
export function downloadFile(data: string | Blob, filename: string, mimeType: string): void {
  if (typeof data === 'string') {
    const blob = new Blob([data], { type: mimeType });
    downloadBlob(blob, filename);
  } else {
    downloadBlob(data, filename);
  }
}
