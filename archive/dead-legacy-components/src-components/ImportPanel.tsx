// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// ImportPanel — paste or upload VHDL/Verilog and render onto the canvas.

import React, { useCallback, useRef, useState, useId } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { parseVhdl } from '../import/vhdlImport';
import { parseVerilog } from '../import/verilogImport';
import { importToRbProject } from '../import/importToRbProject';
import { parseXdcPins } from '../import/xdcImport';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportPanelProps {
  onImportCircuit: (circuit: Circuit) => void;
}

type Lang = 'auto' | 'vhdl' | 'verilog';

interface ImportState {
  status: 'idle' | 'success' | 'error';
  warnings: string[];
  unmappedComponents: string[];
  errorMessage?: string;
}

// ─── Detect language from content ─────────────────────────────────────────────

function detectLang(src: string): 'vhdl' | 'verilog' {
  const lower = src.toLowerCase();
  if (lower.includes('entity') && lower.includes('architecture')) return 'vhdl';
  if (lower.includes('module') && lower.includes('endmodule')) return 'verilog';
  if (lower.includes('entity') || lower.includes('architecture')) return 'vhdl';
  return 'verilog';
}

// ─── Styles (inline for self-containment) ─────────────────────────────────────

const S = {
  root: {
    display: 'flex', flexDirection: 'column' as const, height: '100%',
    background: '#080b10', color: 'rgba(236,244,255,0.85)',
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace", fontSize: '11px',
  },
  header: {
    padding: '12px 14px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title: {
    fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase' as const, color: 'rgba(236,244,255,0.45)',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '11px', color: 'rgba(236,244,255,0.55)', lineHeight: 1.5,
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column' as const, padding: '12px', gap: '10px', overflowY: 'auto' as const },
  langRow: { display: 'flex', gap: '6px', alignItems: 'center' },
  langLabel: { color: 'rgba(236,244,255,0.35)', marginRight: '4px' },
  langBtn: (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer',
    border: '1px solid',
    borderColor: active ? 'rgba(239,35,60,0.6)' : 'rgba(255,255,255,0.1)',
    background: active ? 'rgba(239,35,60,0.1)' : 'transparent',
    color: active ? '#EF233C' : 'rgba(236,244,255,0.45)',
    fontFamily: 'inherit',
  }),
  textarea: {
    flex: 1, minHeight: '200px', resize: 'vertical' as const,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px', color: 'rgba(236,244,255,0.85)', fontFamily: 'inherit',
    fontSize: '11px', padding: '10px', lineHeight: 1.5, outline: 'none',
  },
  dropZone: (dragging: boolean): React.CSSProperties => ({
    border: `1.5px dashed ${dragging ? 'rgba(239,35,60,0.7)' : 'rgba(255,255,255,0.12)'}`,
    borderRadius: '4px', padding: '14px',
    textAlign: 'center' as const, cursor: 'pointer',
    background: dragging ? 'rgba(239,35,60,0.06)' : 'rgba(255,255,255,0.02)',
    color: 'rgba(236,244,255,0.35)', transition: 'all 120ms ease',
    fontSize: '11px',
  }),
  importBtn: {
    padding: '8px 14px', background: '#EF233C', border: 'none', borderRadius: '4px',
    color: '#fff', fontFamily: 'inherit', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase' as const,
    transition: 'background 120ms',
  },
  warningBox: {
    background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.25)',
    borderRadius: '4px', padding: '8px 10px', fontSize: '10px',
    color: 'rgba(255,220,100,0.85)', lineHeight: 1.5,
  },
  errorBox: {
    background: 'rgba(239,35,60,0.08)', border: '1px solid rgba(239,35,60,0.3)',
    borderRadius: '4px', padding: '8px 10px', fontSize: '10px',
    color: 'rgba(255,120,120,0.9)', lineHeight: 1.5,
  },
  successBox: {
    background: 'rgba(40,220,100,0.08)', border: '1px solid rgba(40,220,100,0.25)',
    borderRadius: '4px', padding: '8px 10px', fontSize: '10px',
    color: 'rgba(100,255,150,0.85)', lineHeight: 1.5,
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportPanel({ onImportCircuit }: ImportPanelProps) {
  const [code, setCode] = useState('');
  const [xdcCode, setXdcCode] = useState('');
  const [lang, setLang] = useState<Lang>('auto');
  const [dragging, setDragging] = useState(false);
  const [xdcDragging, setXdcDragging] = useState(false);
  const [importState, setImportState] = useState<ImportState>({ status: 'idle', warnings: [], unmappedComponents: [] });
  const fileInputId = useId();
  const xdcInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const xdcRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(() => {
    const src = code.trim();
    if (!src) {
      setImportState({ status: 'error', errorMessage: 'Paste or upload a VHDL or Verilog file first.', warnings: [], unmappedComponents: [] });
      return;
    }
    try {
      const effectiveLang = lang === 'auto' ? detectLang(src) : lang;
      const parsed = effectiveLang === 'vhdl' ? parseVhdl(src) : parseVerilog(src);
      
      // Parse XDC if provided
      const xdcResult = xdcCode.trim() ? parseXdcPins(xdcCode) : undefined;
      
      // Convert to RBProject (which includes circuit + ioMapping)
      const project = importToRbProject(parsed, xdcResult);

      if (project.circuit.nodes.length === 0) {
        setImportState({
          status: 'error',
          errorMessage: 'No nodes could be extracted. Make sure you paste a structural HDL file with component instantiations.',
          warnings: project.circuit.nodes.length === 0 ? [] : [],
          unmappedComponents: [],
        });
        return;
      }

      // For now, pass only the circuit (RBProject.ioMapping will be used in future versions)
      onImportCircuit(project.circuit);
      
      const allWarnings = [...(parsed.warnings || [])];
      if (xdcResult) {
        allWarnings.push(...xdcResult.warnings);
      }
      
      setImportState({
        status: 'success',
        warnings: allWarnings,
        unmappedComponents: [],
      });
    } catch (err) {
      setImportState({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Parse failed — check console for details.',
        warnings: [],
        unmappedComponents: [],
      });
    }
  }, [code, xdcCode, lang, onImportCircuit]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCode(text ?? '');
      setImportState({ status: 'idle', warnings: [], unmappedComponents: [] });
      // Auto-detect language from filename
      if (file.name.endsWith('.vhd') || file.name.endsWith('.vhdl')) setLang('vhdl');
      else if (file.name.endsWith('.v') || file.name.endsWith('.sv')) setLang('verilog');
    };
    reader.readAsText(file);
  }, []);

  const handleXdcFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setXdcCode(text ?? '');
      setImportState({ status: 'idle', warnings: [], unmappedComponents: [] });
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile],
  );

  const handleXdcDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setXdcDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleXdcFile(file);
    },
    [handleXdcFile],
  );

  const handleXdcInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleXdcFile(file);
      e.target.value = '';
    },
    [handleXdcFile],
  );

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.title}>Import from Vivado</div>
        <div style={S.subtitle}>
          Paste VHDL or Verilog from Vivado — RedByte will render it on the canvas.
        </div>
      </div>

      <div style={S.body}>
        {/* Language selector */}
        <div style={S.langRow}>
          <span style={S.langLabel}>Language:</span>
          {(['auto', 'vhdl', 'verilog'] as Lang[]).map((l) => (
            <button key={l} type="button" style={S.langBtn(lang === l)} onClick={() => setLang(l)}>
              {l === 'auto' ? 'Auto-detect' : l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* File drop zone */}
        <div
          style={S.dropZone(dragging)}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          aria-label="Drop VHDL or Verilog file here"
        >
          Drop .vhd / .v file here or click to browse
          <input
            id={fileInputId}
            ref={fileRef}
            type="file"
            accept=".vhd,.vhdl,.v,.sv"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {/* Code textarea */}
        <textarea
          style={S.textarea}
          value={code}
          onChange={(e) => { setCode(e.target.value); setImportState({ status: 'idle', warnings: [], unmappedComponents: [] }); }}
          placeholder={`-- Paste your VHDL here, e.g.:\nentity top is\n  port (\n    A : in STD_LOGIC;\n    B : in STD_LOGIC;\n    F : out STD_LOGIC\n  );\nend entity top;\n\narchitecture rtl of top is\nbegin\n  u0 : AND2 port map (A => A, B => B, Y => F);\nend architecture rtl;`}
          spellCheck={false}
          aria-label="HDL source code"
        />

        {/* XDC input section (optional) */}
        <div>
          <div style={{ fontSize: '10px', color: 'rgba(236,244,255,0.45)', marginBottom: '6px' }}>
            XDC constraints <span style={{ color: 'rgba(236,244,255,0.25)' }}>(optional)</span>
          </div>
          <div
            style={S.dropZone(xdcDragging)}
            onDragOver={(e) => { e.preventDefault(); setXdcDragging(true); }}
            onDragLeave={() => setXdcDragging(false)}
            onDrop={handleXdcDrop}
            onClick={() => xdcRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && xdcRef.current?.click()}
            aria-label="Drop XDC file here"
          >
            Drop .xdc file here or click to browse
            <input
              id={xdcInputId}
              ref={xdcRef}
              type="file"
              accept=".xdc"
              style={{ display: 'none' }}
              onChange={handleXdcInput}
            />
          </div>
          {xdcCode.trim() && (
            <textarea
              style={{ ...S.textarea, minHeight: '80px', marginTop: '6px' }}
              value={xdcCode}
              onChange={(e) => { setXdcCode(e.target.value); setImportState({ status: 'idle', warnings: [], unmappedComponents: [] }); }}
              placeholder="set_property PACKAGE_PIN V17 [get_ports {SW0}]"
              spellCheck={false}
              aria-label="XDC constraints"
            />
          )}
        </div>        {/* Import button */}
        <button
          type="button"
          style={S.importBtn}
          onClick={handleImport}
          disabled={!code.trim()}
        >
          Import → Render on Canvas
        </button>

        {/* Result feedback */}
        {importState.status === 'success' && (
          <div style={S.successBox}>
            Circuit imported successfully.
            {importState.warnings.length > 0 && (
              <>
                <br />Warnings:
                <ul style={{ margin: '4px 0 0 12px', padding: 0 }}>
                  {importState.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </>
            )}
            {importState.unmappedComponents.length > 0 && (
              <>
                <br />Unrecognised components (skipped):{' '}
                {importState.unmappedComponents.join(', ')}
              </>
            )}
          </div>
        )}

        {importState.status === 'error' && (
          <div style={S.errorBox}>
            {importState.errorMessage}
            {importState.warnings.length > 0 && (
              <>
                <br />
                <ul style={{ margin: '4px 0 0 12px', padding: 0 }}>
                  {importState.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        {importState.status === 'idle' && importState.warnings.length > 0 && (
          <div style={S.warningBox}>
            {importState.warnings.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}

        {/* Quick reference */}
        <details style={{ marginTop: '4px' }}>
          <summary style={{ cursor: 'pointer', color: 'rgba(236,244,255,0.35)', fontSize: '10px', userSelect: 'none' }}>
            Supported constructs
          </summary>
          <div style={{ marginTop: '8px', color: 'rgba(236,244,255,0.45)', lineHeight: 1.7, fontSize: '10px' }}>
            <strong style={{ color: 'rgba(236,244,255,0.65)' }}>VHDL:</strong><br />
            entity … port (…); end entity;<br />
            architecture … begin<br />
            &nbsp;&nbsp;label : ComponentName port map (…);<br />
            end architecture;<br /><br />
            <strong style={{ color: 'rgba(236,244,255,0.65)' }}>Verilog:</strong><br />
            module top(input A, output F);<br />
            &nbsp;&nbsp;and u0 (F, A, B);<br />
            &nbsp;&nbsp;AND2 u1 (.A(A), .B(B), .Y(F));<br />
            endmodule<br /><br />
            <strong style={{ color: 'rgba(236,244,255,0.65)' }}>Mapped gates:</strong><br />
            AND, OR, NOT, NAND, NOR, XOR, XNOR, FullAdder, DFlipFlop<br />
            (plus common synonyms: AND2, INV, FDRE, etc.)
          </div>
        </details>
      </div>
    </div>
  );
}
