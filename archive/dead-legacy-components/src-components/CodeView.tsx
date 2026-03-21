// Copyright (c) 2025 Connor Angiel
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo, useState, useCallback } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { netlistFromCircuit } from '../export/netlistExport';
import { verilogFromNetlist, synthesizableVerilogFromNetlist } from '../export/verilogExport';

interface CodeViewProps {
  circuit: Circuit;
  width?: number;
  height?: number;
  showHints?: boolean;
  onDismissHints?: () => void;
  onHelp?: () => void;
}

type CodeFormat = 'verilog-structural' | 'verilog-synthesizable' | 'netlist-json';

const FORMAT_OPTIONS: { value: CodeFormat; label: string; description: string }[] = [
  { value: 'verilog-structural', label: 'Verilog (Structural)', description: 'Basic structural export' },
  { value: 'verilog-synthesizable', label: 'Verilog (Synthesizable)', description: 'For FPGA synthesis' },
  { value: 'netlist-json', label: 'Netlist JSON', description: 'Raw netlist data' },
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const CodeView: React.FC<CodeViewProps> = ({
  circuit,
  width = 800,
  height = 600,
  showHints = true,
  onDismissHints,
  onHelp,
}) => {
  const [format, setFormat] = useState<CodeFormat>('verilog-synthesizable');
  const [copied, setCopied] = useState(false);
  const [showPrimitives, setShowPrimitives] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);

  // Generate code based on format
  const { code, primitivesCode, constraintsCode } = useMemo(() => {
    if (circuit.nodes.length === 0) {
      return { code: '// Empty circuit - add components to generate HDL code', primitivesCode: '', constraintsCode: '' };
    }

    const netlist = netlistFromCircuit(circuit);

    switch (format) {
      case 'verilog-structural':
        return { code: verilogFromNetlist(netlist), primitivesCode: '', constraintsCode: '' };

      case 'verilog-synthesizable': {
        const result = synthesizableVerilogFromNetlist(netlist, { board: 'basys3', includeClock: true });
        return {
          code: result.topModule,
          primitivesCode: result.primitivesLibrary,
          constraintsCode: result.constraintsXdc,
        };
      }

      case 'netlist-json':
        return { code: JSON.stringify(netlist, null, 2), primitivesCode: '', constraintsCode: '' };

      default:
        return { code: '// Unknown format', primitivesCode: '', constraintsCode: '' };
    }
  }, [circuit, format]);

  const displayCode = useMemo(() => {
    let text = code;
    if (showPrimitives && primitivesCode) {
      text += '\n\n// === PRIMITIVES LIBRARY ===\n\n' + primitivesCode;
    }
    if (showConstraints && constraintsCode) {
      text += '\n\n// === CONSTRAINTS (XDC) ===\n\n' + constraintsCode;
    }
    return text;
  }, [code, primitivesCode, constraintsCode, showPrimitives, showConstraints]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some environments
    }
  }, [displayCode]);

  const handleDownload = useCallback(() => {
    const extension = format === 'netlist-json' ? 'json' : 'v';
    const filename = `circuit.${extension}`;
    const blob = new Blob([displayCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayCode, format]);

  // Simple syntax highlighting for Verilog/JSON
  const highlightedCode = useMemo(() => {
    const escaped = escapeHtml(displayCode);

    if (format === 'netlist-json') {
      const jsonToken = /(".*?")|\b(true|false|null)\b|\b(\d+)\b/g;
      return escaped.replace(jsonToken, (match, stringLit, boolLit, numberLit) => {
        if (stringLit) return `<span class="text-green-400">${stringLit}</span>`;
        if (boolLit) return `<span class="text-purple-400">${boolLit}</span>`;
        if (numberLit) return `<span class="text-cyan-400">${numberLit}</span>`;
        return match;
      });
    }

    const verilogToken =
      /(\/\/.*)|\b(module|endmodule|input|output|wire|reg|assign|always|begin|end|posedge|negedge)\b|\b(if|else|case|endcase|for|while)\b|(`timescale|`define|`include)|\b(\d+'[bdh]\w+|\d+)\b/g;
    return escaped.replace(
      verilogToken,
      (match, comment, keyword, flow, directive, numberLit) => {
        if (comment) return `<span class="text-gray-500">${comment}</span>`;
        if (keyword) return `<span class="text-purple-400">${keyword}</span>`;
        if (flow) return `<span class="text-pink-400">${flow}</span>`;
        if (directive) return `<span class="text-cyan-400">${directive}</span>`;
        if (numberLit) return `<span class="text-orange-400">${numberLit}</span>`;
        return match;
      }
    );
  }, [displayCode, format]);

  return (
    <div className="w-full h-full bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-700 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">HDL Code View</h2>
          <div className="text-[10px] text-gray-500">Export circuit as Verilog/HDL</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Format selector */}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as CodeFormat)}
            className="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-200 focus:outline-none focus:border-cyan-500"
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Toolbar buttons */}
          <div className="flex items-center gap-1.5">
            {format === 'verilog-synthesizable' && (
              <>
                <button
                  onClick={() => setShowPrimitives(!showPrimitives)}
                  className={`px-2 py-1 rounded text-[10px] border ${
                    showPrimitives
                      ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'
                  }`}
                  title="Show primitives library"
                  type="button"
                >
                  LIB
                </button>
                <button
                  onClick={() => setShowConstraints(!showConstraints)}
                  className={`px-2 py-1 rounded text-[10px] border ${
                    showConstraints
                      ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30'
                      : 'border-gray-600 text-gray-300 hover:bg-gray-800/60'
                  }`}
                  title="Show XDC constraints"
                  type="button"
                >
                  XDC
                </button>
              </>
            )}
            <button
              onClick={handleCopy}
              className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
              title="Copy to clipboard"
              type="button"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
              title="Download file"
              type="button"
            >
              DL
            </button>
            {onHelp && (
              <button
                onClick={onHelp}
                className="px-2 py-1 rounded text-[10px] border border-gray-600 text-gray-300 hover:bg-gray-800/60"
                title="Code view help"
                type="button"
              >
                ?
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Code display */}
      <div className="flex-1 relative overflow-hidden">
        {/* Hints overlay */}
        {circuit.nodes.length === 0 && showHints && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-gray-800/90 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 space-y-2 max-w-sm pointer-events-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-white">HDL Code View</div>
                {onDismissHints && (
                  <button
                    onClick={onDismissHints}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                    title="Dismiss hints"
                    type="button"
                  >
                    x
                  </button>
                )}
              </div>
              <div><span className="text-cyan-400">Verilog Export:</span> Auto-generates HDL from circuit</div>
              <div><span className="text-cyan-400">Synthesizable:</span> Ready for FPGA toolchains</div>
              <div><span className="text-cyan-400">Copy/Download:</span> Export to files</div>
              <div className="pt-2 border-t border-gray-700 text-gray-500">
                Add components in Circuit view to see generated code!
              </div>
            </div>
          </div>
        )}

        {/* Code editor area */}
        <div className="absolute inset-0 overflow-auto py-4 pr-4 pl-12 font-mono text-xs">
          <pre
            className="text-gray-200 whitespace-pre leading-5"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </div>

        {/* Line numbers gutter */}
        <div className="absolute top-0 left-0 w-10 h-full bg-gray-850 border-r border-gray-700 overflow-hidden pointer-events-none">
          <div className="p-4 font-mono text-xs text-gray-600 select-none leading-5">
            {displayCode.split('\n').map((_, i) => (
              <div key={i} className="text-right pr-2">{i + 1}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 shrink-0">
        <div className="text-xs text-gray-400 flex items-center justify-between">
          <span>
            {FORMAT_OPTIONS.find(o => o.value === format)?.description}
          </span>
          <span className="text-gray-500">
            {circuit.nodes.length} nodes | {circuit.connections.length} wires | {displayCode.split('\n').length} lines
          </span>
        </div>
      </div>
    </div>
  );
};
