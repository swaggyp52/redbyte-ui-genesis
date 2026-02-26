import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseVhdl, scanVhdlEntities } from '../../../import/vhdlImport';
import { parseVerilog, scanVerilogModules } from '../../../import/verilogImport';
import { parseXdcPins, type XdcParseResult } from '../../../import/xdcImport';
import type { ParsedHDL, ReconstructionLevel } from '../../../import/hdlToCircuit';
import type { ParsedHdlWarning } from '../../../import/hdlToCircuit';
import type { RBProject } from '../../../export/projectFormat';
import type { IdeExampleIoRow } from '../examplesCatalog';
import {
  parseIdeSubmissionZip,
  NotASubmissionZipError,
  SubmissionIntegrityError,
  type ParsedIdeSubmission,
} from '../../../export/parseIdeSubmission';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  buildImportedProject,
  importVivadoZipFile,
  reimportZipWithCandidates,
  type ZipImportInspection,
} from '../zipImport';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeGrid,
  IdeInspectorSection,
  IdePanel,
  IdeSectionHeader,
  IdeStatusPill,
} from '../components/IdePrimitives';

type ImportTab = 'hdl' | 'xdc' | 'upload';
type HdlLanguage = 'auto' | 'vhdl' | 'verilog';

export interface ImportSurfaceProps {
  onImportProject?: (project: RBProject) => void;
  projectIoRows?: IdeExampleIoRow[];
  onApplySuggestions?: (items: Array<{ rowId: string; pin: string }>) => void;
  onGoToProject?: () => void;
  onGoToVerify?: () => void;
  onImportSubmission?: (submission: ParsedIdeSubmission) => void;
}

const BASYS3_QUICK_PINS = [
  'SW0', 'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7',
  'LD0', 'LD1', 'LD2', 'LD3', 'LD4', 'LD5', 'LD6', 'LD7',
  'BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR',
  'CLK100MHZ',
] as const;

/** Common Basys3 physical pin IDs for quick assignment override. */
const BASYS3_PHYSICAL_QUICK_PINS = ['V17', 'W16', 'W15', 'V15', 'U16', 'E19', 'U19', 'V19', 'J15', 'W5'] as const;

const SAMPLE_AND_GATE_VHDL = [
  'library IEEE;',
  'use IEEE.STD_LOGIC_1164.ALL;',
  'entity top is',
  '  Port ( in_a : in STD_LOGIC;',
  '         in_b : in STD_LOGIC;',
  '         out_y : out STD_LOGIC);',
  'end top;',
  'architecture Structural of top is',
  '  component AND2',
  '    port (A : in STD_LOGIC; B : in STD_LOGIC; Y : out STD_LOGIC);',
  '  end component;',
  'begin',
  '  U1 : AND2 port map (A => in_a, B => in_b, Y => out_y);',
  'end Structural;',
].join('\n');

const SAMPLE_AND_GATE_XDC = [
  '## Basys3 Constraints — AND Gate sample',
  '## clock',
  'set_property PACKAGE_PIN W5 [get_ports clk]',
  '  set_property IOSTANDARD LVCMOS33 [get_ports clk]',
  '## Switches',
  'set_property PACKAGE_PIN V17 [get_ports in_a]',
  '  set_property IOSTANDARD LVCMOS33 [get_ports in_a]',
  'set_property PACKAGE_PIN W16 [get_ports in_b]',
  '  set_property IOSTANDARD LVCMOS33 [get_ports in_b]',
  '## LEDs',
  'set_property PACKAGE_PIN U16 [get_ports out_y]',
  '  set_property IOSTANDARD LVCMOS33 [get_ports out_y]',
].join('\n');

const SAMPLE_PASSTHROUGH_VHDL = `library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
entity top is
  Port ( sw : in  STD_LOGIC_VECTOR(3 downto 0);
         ld : out STD_LOGIC_VECTOR(3 downto 0));
end top;
architecture Behavioral of top is
begin
  ld <= sw;
end Behavioral;`;

const SAMPLE_PASSTHROUGH_XDC = `## Basys3 — Switches -> LEDs passthrough
set_property PACKAGE_PIN V17 [get_ports {sw[0]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {sw[0]}]
set_property PACKAGE_PIN W16 [get_ports {sw[1]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {sw[1]}]
set_property PACKAGE_PIN W15 [get_ports {sw[2]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {sw[2]}]
set_property PACKAGE_PIN V15 [get_ports {sw[3]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {sw[3]}]
set_property PACKAGE_PIN U16 [get_ports {ld[0]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {ld[0]}]
set_property PACKAGE_PIN E19 [get_ports {ld[1]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {ld[1]}]
set_property PACKAGE_PIN U19 [get_ports {ld[2]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {ld[2]}]
set_property PACKAGE_PIN V19 [get_ports {ld[3]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {ld[3]}]`;

const SAMPLE_EDGEDETECT_VHDL = `library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
entity top is
  Port ( clk  : in  STD_LOGIC;
         btn  : in  STD_LOGIC;
         pulse: out STD_LOGIC);
end top;
architecture Behavioral of top is
  signal prev : STD_LOGIC := '0';
begin
  process(clk)
  begin
    if rising_edge(clk) then
      pulse <= btn AND NOT prev;
      prev  <= btn;
    end if;
  end process;
end Behavioral;`;

const SAMPLE_EDGEDETECT_XDC = `## Basys3 — Edge Detector
set_property PACKAGE_PIN W5  [get_ports clk]
  set_property IOSTANDARD LVCMOS33 [get_ports clk]
  create_clock -add -name sys_clk_pin -period 10.00 [get_ports clk]
set_property PACKAGE_PIN U18 [get_ports btn]
  set_property IOSTANDARD LVCMOS33 [get_ports btn]
set_property PACKAGE_PIN U16 [get_ports pulse]
  set_property IOSTANDARD LVCMOS33 [get_ports pulse]`;

const SAMPLE_SEVENSEG_VHDL = `library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
entity ssd_driver is
  Port ( B   : in  STD_LOGIC_VECTOR(3 downto 0);
         seg : out STD_LOGIC_VECTOR(6 downto 0));
end ssd_driver;
architecture Behavioral of ssd_driver is
begin
  process(B)
  begin
    case B is
      when "0000" => seg <= "1000000";
      when "0001" => seg <= "1111001";
      when "0010" => seg <= "0100100";
      when "0011" => seg <= "0110000";
      when "0100" => seg <= "0011001";
      when "0101" => seg <= "0010010";
      when "0110" => seg <= "0000010";
      when "0111" => seg <= "1111000";
      when "1000" => seg <= "0000000";
      when "1001" => seg <= "0010000";
      when others => seg <= "1111111";
    end case;
  end process;
end Behavioral;`;

const SAMPLE_SEVENSEG_XDC = `## Basys3 — Seven-Segment Display Driver (BCD 0-9)
## 4-bit switch inputs (SW3=MSB, SW0=LSB)
set_property PACKAGE_PIN V17 [get_ports {B[0]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {B[0]}]
set_property PACKAGE_PIN V16 [get_ports {B[1]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {B[1]}]
set_property PACKAGE_PIN W16 [get_ports {B[2]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {B[2]}]
set_property PACKAGE_PIN W17 [get_ports {B[3]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {B[3]}]
## 7-segment outputs (active-low: 0 = segment ON)
set_property PACKAGE_PIN W7 [get_ports {seg[0]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[0]}]
set_property PACKAGE_PIN W6 [get_ports {seg[1]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[1]}]
set_property PACKAGE_PIN U8 [get_ports {seg[2]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[2]}]
set_property PACKAGE_PIN V8 [get_ports {seg[3]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[3]}]
set_property PACKAGE_PIN U5 [get_ports {seg[4]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[4]}]
set_property PACKAGE_PIN V5 [get_ports {seg[5]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[5]}]
set_property PACKAGE_PIN U7 [get_ports {seg[6]}]
  set_property IOSTANDARD LVCMOS33 [get_ports {seg[6]}]`;

const IMPORT_SAMPLES = [
  { id: 'and-gate',    name: 'AND Gate',          desc: 'Structural VHDL + Basys3 constraints', learn: 'Entity/port syntax, combinational gates',    hdl: SAMPLE_AND_GATE_VHDL,    xdc: SAMPLE_AND_GATE_XDC,    behavioral: false },
  { id: 'passthrough', name: 'Switches → LEDs', desc: 'Structural 4-bit passthrough',         learn: 'Port vectors, direct signal assignment',        hdl: SAMPLE_PASSTHROUGH_VHDL, xdc: SAMPLE_PASSTHROUGH_XDC, behavioral: false },
  { id: 'edge-detect', name: 'Edge Detector (behavioral — import blocked)', desc: 'Sequential VHDL — demonstrates blocker', learn: 'Shows what happens with process/rising_edge: import is blocked', hdl: SAMPLE_EDGEDETECT_VHDL,  xdc: SAMPLE_EDGEDETECT_XDC,  behavioral: true  },
  { id: 'seven-seg',   name: '7-Seg Driver (behavioral — import blocked)', desc: 'Case-statement VHDL — demonstrates blocker', learn: 'Shows what happens with process/case: import is blocked', hdl: SAMPLE_SEVENSEG_VHDL,   xdc: SAMPLE_SEVENSEG_XDC,    behavioral: true  },
] as const;

type SuggestionKind = 'SW' | 'LD' | 'BTN' | 'CLK' | 'OTHER';

interface PinSuggestion {
  portName: string;
  direction: 'in' | 'out';
  rowId: string | null;       // null if no matching project row
  pin: string | null;         // from XDC, or null
  kind: SuggestionKind;
  signalLabel: string;        // e.g. "SW0", "LD3", "CLK"
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  locked: boolean;            // true if project row already has a pin
}

function classifyPort(name: string): { kind: SuggestionKind; signalLabel: string; confidence: 'high' | 'medium' | 'low' } {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const swM = /^(sw|switch)(\d+)$/.exec(n);
  if (swM) return { kind: 'SW', signalLabel: `SW${swM[2]}`, confidence: 'high' };
  const ldM = /^(ld|led)(\d+)$/.exec(n);
  if (ldM) return { kind: 'LD', signalLabel: `LD${ldM[2]}`, confidence: 'high' };
  const btnM = /^btn(c|u|d|l|r|center|up|down|left|right)$/.exec(n);
  if (btnM) {
    const suffix = btnM[1][0].toUpperCase();
    const label = suffix === 'C' ? 'BTNC' : suffix === 'U' ? 'BTNU' : suffix === 'D' ? 'BTND' : suffix === 'L' ? 'BTNL' : 'BTNR';
    return { kind: 'BTN', signalLabel: label, confidence: 'high' };
  }
  if (/^(clk|clock)$/.test(n)) return { kind: 'CLK', signalLabel: 'CLK', confidence: 'high' };
  // Weak matches
  if (n.startsWith('sw') || n.startsWith('switch')) return { kind: 'SW', signalLabel: name.toUpperCase(), confidence: 'medium' };
  if (n.startsWith('ld') || n.startsWith('led')) return { kind: 'LD', signalLabel: name.toUpperCase(), confidence: 'medium' };
  if (n.startsWith('btn')) return { kind: 'BTN', signalLabel: name.toUpperCase(), confidence: 'medium' };
  return { kind: 'OTHER', signalLabel: name.toUpperCase(), confidence: 'low' };
}

// ─── Behavioral HDL detection ─────────────────────────────────────────────────
// STOP-SHIP: Any process/always/rising_edge construct must produce a hard blocker,
// not a quiet warning, before the import is committed.

/** Scans HDL source text for behavioral/sequential constructs that RedByte cannot import. */
function scanBehavioralConstructs(source: string): string[] {
  const found: string[] = [];
  if (/\bprocess\b/i.test(source)) found.push('process (VHDL sequential)');
  if (/\balways\b/i.test(source)) found.push('always (Verilog behavioral)');
  if (/\binitial\b/i.test(source)) found.push('initial (Verilog test-bench/sequential init)');
  if (/\brising_edge\b/i.test(source)) found.push('rising_edge (clocked logic)');
  if (/\bposedge\b/i.test(source)) found.push('posedge (clock edge sensitivity)');
  if (/\bnegedge\b/i.test(source)) found.push('negedge (clock edge sensitivity)');
  if (/\bgenerate\b/i.test(source)) found.push('generate (structural generate — unsupported)');
  return found;
}

/**
 * Computes the reconstruction level for a paste-import (no ZIP inspection).
 * Uses parsedHdl.instances to detect whether gate instances were parsed.
 * NOTE: This is a pre-circuit estimate; the actual circuit may still be ports-only
 * if all instances failed component-map lookup.
 */
function computeReconstructionLevelFromParsed(parsedHdl: ParsedHDL | null): ReconstructionLevel {
  if (!parsedHdl || parsedHdl.ports.length === 0) return 'empty';
  const hasGateInstances = parsedHdl.instances.some(i => i.componentType !== 'Wire');
  if (hasGateInstances) return 'full';
  return 'ports-only';
}

// ─── Phase 33: Import Pipeline Step Types ─────────────────────────────────
type ImportPipelineStepId = 'load' | 'parse-hdl' | 'parse-xdc' | 'validate' | 'build';
type ImportPipelineStepState = 'idle' | 'running' | 'done' | 'skipped' | 'error';

interface ImportPipelineStep {
  id: ImportPipelineStepId;
  label: string;
  state: ImportPipelineStepState;
  detail?: string;
}

const IMPORT_PIPELINE: Array<{ id: ImportPipelineStepId; label: string }> = [
  { id: 'load',      label: 'Load inputs' },
  { id: 'parse-hdl', label: 'Parse HDL' },
  { id: 'parse-xdc', label: 'Parse XDC' },
  { id: 'validate',  label: 'Validate ports' },
  { id: 'build',     label: 'Build project model' },
];

function makePipelineSteps(): ImportPipelineStep[] {
  return IMPORT_PIPELINE.map((s) => ({ id: s.id, label: s.label, state: 'idle' as const }));
}

/** Yield control to React for a short duration between async pipeline steps. */
function importTick(ms = 40): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export const ImportSurface: React.FC<ImportSurfaceProps> = ({
  onImportProject,
  projectIoRows,
  onApplySuggestions,
  onGoToProject,
  onGoToVerify,
  onImportSubmission,
}) => {
  const [tab, setTab] = useState<ImportTab>('hdl');
  const [language, setLanguage] = useState<HdlLanguage>('auto');
  const [hdlText, setHdlText] = useState('');
  const [xdcText, setXdcText] = useState('');
  const [parsedHdl, setParsedHdl] = useState<ParsedHDL | null>(null);
  const [xdcResult, setXdcResult] = useState<XdcParseResult | null>(null);
  const [zipInspection, setZipInspection] = useState<ZipImportInspection | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [pendingApplyProject, setPendingApplyProject] = useState<RBProject | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string>('Paste HDL to begin import.');
  const [submissionImportFeedback, setSubmissionImportFeedback] = useState<{
    tone: 'success' | 'error';
    title: string;
    detail: string;
  } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const zipFileRef = useRef<File | null>(null);
  const [selectedZipHdl, setSelectedZipHdl] = useState<string | null>(null);
  const [selectedZipXdc, setSelectedZipXdc] = useState<string | null>(null);
  const hdlTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hdlGutterRef = useRef<HTMLDivElement | null>(null);
  const xdcTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const xdcGutterRef = useRef<HTMLDivElement | null>(null);
  const [activeXdcWarningLine, setActiveXdcWarningLine] = useState<number | null>(null);

  // --- Suggestion model state ---
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [activeWarningLine, setActiveWarningLine] = useState<number | null>(null);

  // Phase 34: entity chooser
  const [selectedEntityName, setSelectedEntityName] = useState<string | null>(null);

  // Phase 33: pipeline state
  const [pipelineSteps, setPipelineSteps] = useState<ImportPipelineStep[]>(() => makePipelineSteps());
  const [pipelineActive, setPipelineActive] = useState(false);
  const [showBehavioralSamples, setShowBehavioralSamples] = useState(false);

  const lineCount = useMemo(() => Math.max(1, hdlText.split('\n').length), [hdlText]);
  const xdcLineCount = useMemo(() => Math.max(1, xdcText.split('\n').length), [xdcText]);

  const detectedEntityNames = useMemo((): string[] => {
    const source = hdlText.trim();
    if (!source) return [];
    const effectiveLang = language === 'auto' ? detectHdlLanguage(source) : language;
    return effectiveLang === 'vhdl' ? scanVhdlEntities(source) : scanVerilogModules(source);
  }, [hdlText, language]);

  const rowIdByPortName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of (projectIoRows ?? [])) {
      if (r.port) m.set(r.port.toLowerCase(), r.id);
      if (r.label) m.set(r.label.toLowerCase(), r.id);
    }
    return m;
  }, [projectIoRows]);

  const pinByRowId = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of (projectIoRows ?? [])) {
      m.set(r.id, r.pin ?? '');
    }
    return m;
  }, [projectIoRows]);

  const suggestions = useMemo((): PinSuggestion[] => {
    if (!parsedHdl?.ports) return [];
    const xdcPins: Record<string, string> = xdcResult?.pinMap ?? {};
    return parsedHdl.ports.map((p): PinSuggestion => {
      const portKey = p.name.toLowerCase();
      const rowId = rowIdByPortName.get(portKey) ?? null;
      const pin = xdcPins[p.name] ?? xdcPins[p.name.toLowerCase()] ?? null;
      const classified = classifyPort(p.name);
      const locked = rowId ? Boolean((pinByRowId.get(rowId) ?? '').trim()) : false;
      return {
        portName: p.name,
        direction: p.direction,
        rowId,
        pin,
        ...classified,
        reason: pin
          ? `Pin ${pin} from XDC constraints`
          : `No XDC pin — matched by name only`,
        locked,
      };
    });
  }, [parsedHdl, rowIdByPortName, pinByRowId, xdcResult]);

  const resolvedPin = useCallback(
    (s: PinSuggestion): string | null => {
      if (s.portName in overrides) return overrides[s.portName];
      return s.pin;
    },
    [overrides]
  );

  const parseHdl = useCallback((sourceOverride?: string) => {
    const source = (sourceOverride ?? hdlText).trim();
    if (!source) {
      setStatusMessage('Paste HDL before parsing.');
      return;
    }
    try {
      setZipInspection(null);
      setPendingApplyProject(null);
      const effectiveLang =
        language === 'auto' ? detectHdlLanguage(source) : (language as 'vhdl' | 'verilog');

      // If multiple entities detected and the user selected a specific one, slice the source.
      // parseVhdl/parseVerilog always take the first entity — so we extract just the chosen block.
      let parseSource = source;
      if (selectedEntityName && detectedEntityNames.length > 1) {
        const sliceRx =
          effectiveLang === 'vhdl'
            ? new RegExp(
                `entity\\s+${selectedEntityName}\\s+is[\\s\\S]*?end\\s+(?:entity\\s+)?(?:${selectedEntityName}\\s*)?;`,
                'i'
              )
            : new RegExp(
                `\\bmodule\\s+${selectedEntityName}\\b[\\s\\S]*?endmodule`,
                'i'
              );
        const sliceMatch = source.match(sliceRx);
        if (sliceMatch) parseSource = sliceMatch[0];
      }
      const parsed = effectiveLang === 'vhdl' ? parseVhdl(parseSource) : parseVerilog(parseSource);
      setParsedHdl(parsed);
      setMapping((previous) => {
        const next: Record<string, string> = {};
        for (const port of parsed.ports) {
          next[port.name] = previous[port.name] ?? '';
        }
        return next;
      });
      setStatusMessage(`HDL parsed: ${parsed.entityName} (${parsed.ports.length} ports).`);
    } catch (error) {
      setParsedHdl(null);
      setStatusMessage(`HDL parse failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }, [hdlText, language, selectedEntityName, detectedEntityNames]);

  const handleHdlScroll = useCallback(() => {
    const ta = hdlTextareaRef.current;
    const gutter = hdlGutterRef.current;
    if (!ta || !gutter) return;
    gutter.scrollTop = ta.scrollTop;
  }, []);

  const scrollToLine = useCallback((line: number) => {
    const ta = hdlTextareaRef.current;
    if (!ta) return;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    ta.scrollTop = Math.max(0, (line - 1) * lineHeight - ta.clientHeight / 3);
    setActiveWarningLine(line);
  }, []);

  const handleXdcScroll = useCallback(() => {
    const ta = xdcTextareaRef.current;
    const gutter = xdcGutterRef.current;
    if (!ta || !gutter) return;
    gutter.scrollTop = ta.scrollTop;
  }, []);

  const scrollToXdcLine = useCallback((line: number) => {
    const ta = xdcTextareaRef.current;
    if (!ta) return;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    ta.scrollTop = Math.max(0, (line - 1) * lineHeight - ta.clientHeight / 3);
    setActiveXdcWarningLine(line);
  }, []);

  const handleHdlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const isSave = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
      if (isSave) {
        e.preventDefault();
        e.stopPropagation();
        parseHdl();
        return;
      }

      if (e.key !== 'Tab') return;

      e.preventDefault();
      const ta = e.currentTarget;
      const value = ta.value;
      const start = ta.selectionStart ?? 0;
      const end = ta.selectionEnd ?? 0;

      const indent = '  '; // 2 spaces

      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      const sliceEnd = lineEnd === -1 ? value.length : lineEnd;
      const block = value.slice(lineStart, sliceEnd);
      const lines = block.split('\n');

      if (e.shiftKey) {
        const newLines = lines.map((ln) => {
          if (ln.startsWith(indent)) return ln.slice(indent.length);
          if (ln.startsWith('\t')) return ln.slice(1);
          if (ln.startsWith(' ')) return ln.slice(1);
          return ln;
        });
        const next = value.slice(0, lineStart) + newLines.join('\n') + value.slice(sliceEnd);
        setHdlText(next);
        queueMicrotask(() => {
          const removed =
            lines[0].startsWith(indent)
              ? indent.length
              : lines[0].startsWith('\t') || lines[0].startsWith(' ')
                ? 1
                : 0;
          ta.selectionStart = Math.max(lineStart, start - removed);
          ta.selectionEnd = Math.max(lineStart, end - removed);
        });
        return;
      }

      const newLines = lines.map((ln) => indent + ln);
      const next = value.slice(0, lineStart) + newLines.join('\n') + value.slice(sliceEnd);
      setHdlText(next);
      queueMicrotask(() => {
        ta.selectionStart = start + indent.length;
        ta.selectionEnd = end + indent.length * newLines.length;
      });
    },
    [parseHdl, setHdlText]
  );

  useEffect(() => {
    if (!activeWarningLine) return;
    const t = window.setTimeout(() => setActiveWarningLine(null), 1200);
    return () => window.clearTimeout(t);
  }, [activeWarningLine]);

  useEffect(() => {
    if (!activeXdcWarningLine) return;
    const t = window.setTimeout(() => setActiveXdcWarningLine(null), 1200);
    return () => window.clearTimeout(t);
  }, [activeXdcWarningLine]);

  const applicableItems = useMemo(
    () =>
      suggestions
        .filter(s => s.rowId !== null && !s.locked && resolvedPin(s) !== null)
        .map(s => ({ rowId: s.rowId!, pin: resolvedPin(s)! })),
    [suggestions, resolvedPin]
  );

  const handleApplyAll = () => {
    if (applicableItems.length === 0) return;
    onApplySuggestions?.(applicableItems);
  };

  const ports = parsedHdl?.ports ?? [];
  const parsedEntityName = parsedHdl?.entityName ?? 'unparsed';

  const invalidNameErrors = useMemo(
    () =>
      ports
        .filter((port) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(port.name))
        .map((port) => `Illegal port name "${port.name}" (expected HDL identifier).`),
    [ports]
  );

  const unmappedPorts = useMemo(
    () =>
      ports.filter((port) => {
        const mappedPin = (mapping[port.name] ?? '').trim();
        return mappedPin.length === 0;
      }),
    [mapping, ports]
  );

  const blockingErrors = useMemo(() => {
    const errors: string[] = [];
    if (parsedHdl && ports.length === 0) {
      errors.push('No ports found in parsed HDL.');
    }
    errors.push(...invalidNameErrors);
    for (const port of unmappedPorts) {
      errors.push(`Unmapped required port "${port.name}".`);
    }
    return errors;
  }, [invalidNameErrors, parsedHdl, ports.length, unmappedPorts]);

  const warnings = useMemo(() => {
    const warningRows: string[] = [];
    if (parsedHdl?.warnings?.length) warningRows.push(...parsedHdl.warnings.map((w) => w.message));
    if (xdcResult?.warnings?.length) warningRows.push(...xdcResult.warnings);
    if (zipInspection?.warnings?.length) warningRows.push(...zipInspection.warnings);
    return warningRows;
  }, [parsedHdl, xdcResult, zipInspection]);

  const hasParsedHdl = parsedHdl !== null;
  const hdlLooksValid =
    hasParsedHdl && parsedHdl?.entityName !== 'unknown' && (parsedHdl?.ports.length ?? 0) > 0;
  const hdlParseWarnings = parsedHdl?.warnings ?? [];
  const hdlWarningCount = hdlParseWarnings.length;
  const hasParsedXdc = xdcResult !== null;
  const hasZipInspection = zipInspection !== null;
  const canApplySuggestions = useMemo(
    () => unmappedPorts.some((port) => Boolean(suggestBasys3Alias(port.name, port.direction))),
    [unmappedPorts]
  );
  const canImport = hasParsedHdl && blockingErrors.length === 0;

  // ── STOP-SHIP: Behavioral construct pre-scan ───────────────────────────────
  // Detect process/always/rising_edge BEFORE the commit is applied.
  // These constructs are dropped silently; we must block the commit, not warn.
  const detectedBehavioralConstructs = useMemo(
    () => (hdlText.trim() ? scanBehavioralConstructs(hdlText) : []),
    [hdlText]
  );

  // Compute reconstruction level for paste imports (where there's no zipInspection).
  const effectiveReconstructionLevel = useMemo((): ReconstructionLevel => {
    if (zipInspection?.reconstructionLevel) return zipInspection.reconstructionLevel;
    return computeReconstructionLevelFromParsed(parsedHdl);
  }, [zipInspection, parsedHdl]);

  // Block commit when behavioral constructs detected or no gates were reconstructed.
  // STOP-SHIP item 1: No silent dropping. STOP-SHIP item 5: No fake success.
  const importBlockerReasons = useMemo((): string[] => {
    if (!pendingApplyProject) return [];
    const reasons: string[] = [];
    if (detectedBehavioralConstructs.length > 0) {
      reasons.push(
        `This design uses behavioral/sequential HDL constructs that RedByte cannot import: ${detectedBehavioralConstructs.join(', ')}.`
      );
    }
    if (effectiveReconstructionLevel === 'empty') {
      reasons.push('No circuit was reconstructed — the schematic is empty. Check entity/module syntax.');
    } else if (effectiveReconstructionLevel === 'ports-only') {
      reasons.push('Only I/O ports were reconstructed — no gate logic found. RedByte supports structural HDL only.');
    }
    return reasons;
  }, [pendingApplyProject, detectedBehavioralConstructs, effectiveReconstructionLevel]);

  const hasImportBlocker = importBlockerReasons.length > 0;

  const commitPreview = useMemo(() => {
    if (!pendingApplyProject || !parsedHdl) return null;
    const inPorts = parsedHdl.ports.filter((p) => p.direction === 'in');
    const outPorts = parsedHdl.ports.filter((p) => p.direction === 'out');
    const mappedCount = parsedHdl.ports.filter((p) => (mapping[p.name] ?? '').trim()).length;
    const reconstructionLevel = effectiveReconstructionLevel;

    // diff vs current project
    const currentPortNames = new Set((projectIoRows ?? []).map((r) => (r.port ?? r.label ?? '').toLowerCase()));
    const incomingPortNames = new Set(parsedHdl.ports.map((p) => p.name.toLowerCase()));
    const addedPorts = parsedHdl.ports.filter((p) => !currentPortNames.has(p.name.toLowerCase()));
    const removedPortNames = (projectIoRows ?? [])
      .filter((r) => {
        const key = (r.port ?? r.label ?? '').toLowerCase();
        return key.length > 0 && !incomingPortNames.has(key);
      })
      .map((r) => r.port ?? r.label ?? r.id);

    return {
      entityName: parsedHdl.entityName,
      lang: parsedHdl.lang,
      inCount: inPorts.length,
      outCount: outPorts.length,
      totalPorts: parsedHdl.ports.length,
      mappedCount,
      reconstructionLevel,
      addedPorts,
      removedPortNames,
      nodeCount: pendingApplyProject.circuit.nodes.length,
      connectionCount: pendingApplyProject.circuit.connections.length,
    };
  }, [pendingApplyProject, parsedHdl, mapping, zipInspection, projectIoRows]);

  const orphanXdcKeys = useMemo(() => {
    if (!xdcResult || !parsedHdl) return [] as string[];
    const portKeySet = new Set(parsedHdl.ports.map((p) => p.name.toLowerCase()));
    return Object.keys(xdcResult.pinMap).filter(
      (k) => !portKeySet.has(k.toLowerCase())
    );
  }, [xdcResult, parsedHdl]);

  const clockCandidatePort = useMemo(() => {
    if (!parsedHdl) return null;
    return parsedHdl.ports.find((p) =>
      /^(clk|clock|clk\d+|sys_clk|clk100mhz)$/i.test(p.name)
    ) ?? null;
  }, [parsedHdl]);

  const portRows = useMemo(
    () =>
      ports.map((port) => {
        const mapped = (mapping[port.name] ?? '').trim();
        const suggestion = suggestBasys3Alias(port.name, port.direction);
        return [
          <code key={`${port.name}-name`}>{port.name}</code>,
          port.direction.toUpperCase(),
          inferPortWidth(port.typeName),
          <input
            key={`${port.name}-mapping`}
            className="ide-export-pin-input"
            value={mapped}
            onChange={(event) =>
              setMapping((previous) => ({
                ...previous,
                [port.name]: event.target.value.toUpperCase().trim(),
              }))
            }
            placeholder={suggestion?.pin ?? 'PIN / ALIAS'}
            aria-label={`import-map-${port.name}`}
          />,
          <IdeStatusPill key={`${port.name}-status`} tone={mapped.length > 0 ? 'ok' : 'warn'}>
            {mapped.length > 0 ? 'Mapped' : 'Missing'}
          </IdeStatusPill>,
        ];
      }),
    [mapping, ports]
  );

  const parseXdc = (sourceOverride?: string) => {
    const source = (sourceOverride ?? xdcText).trim();
    if (!source) {
      setStatusMessage('Paste XDC before parsing.');
      return;
    }
    try {
      setZipInspection(null);
      setPendingApplyProject(null);
      const parsed = parseXdcPins(source);
      setXdcResult(parsed);
      setMapping((previous) => {
        if (!parsedHdl) return previous;
        const next = { ...previous };
        for (const port of parsedHdl.ports) {
          const mappedPin = parsed.pinMap[port.name];
          if (mappedPin && !(next[port.name] ?? '').trim()) {
            next[port.name] = mappedPin.toUpperCase();
          }
        }
        return next;
      });
      setStatusMessage(`XDC parsed: ${Object.keys(parsed.pinMap).length} pin assignments found.`);
    } catch (error) {
      setXdcResult(null);
      setStatusMessage(`XDC parse failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  const markPipelineStep = useCallback(
    (id: ImportPipelineStepId, state: ImportPipelineStepState, detail?: string) => {
      setPipelineSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, state, detail } : s))
      );
    },
    []
  );

  const applySuggestions = () => {
    if (!parsedHdl) return;
    setMapping((previous) => {
      const next = { ...previous };
      for (const port of parsedHdl.ports) {
        const hasExistingPin = (next[port.name] ?? '').trim().length > 0;
        if (hasExistingPin) continue;
        const suggestion = suggestBasys3Alias(port.name, port.direction);
        if (suggestion) next[port.name] = suggestion.pin;
      }
      return next;
    });
    setStatusMessage('Applied Basys3 mapping suggestions for eligible ports.');
  };

  const buildCurrentProject = (): RBProject | null => {
    if (!parsedHdl) return null;
    const sourceName =
      zipInspection?.sourceName ??
      `${parsedHdl.entityName.trim() || 'imported-design'}.${parsedHdl.lang === 'vhdl' ? 'vhd' : 'v'}`;
    const topPath =
      zipInspection?.detectedTopPath ?? `top.${parsedHdl.lang === 'vhdl' ? 'vhd' : 'v'}`;
    const topText = hdlText.trim();
    const normalizedXdcText = xdcText.trim();
    // Merge user's pin selections from mapping state into XDC result
    const userPins = Object.fromEntries(
      Object.entries(mapping).filter(([, pin]) => pin.trim().length > 0)
    );
    const mergedXdcResult: XdcParseResult | undefined =
      xdcResult
        ? { ...xdcResult, pinMap: { ...xdcResult.pinMap, ...userPins } }
        : Object.keys(userPins).length > 0
          ? { pinMap: userPins, pinEntries: {}, warnings: [] }
          : undefined;
    return buildImportedProject({
      sourceName,
      topPath,
      topText,
      parsedHdl,
      xdcPath: zipInspection?.detectedXdcPath ?? (normalizedXdcText ? 'top.xdc' : undefined),
      xdcText: normalizedXdcText.length > 0 ? normalizedXdcText : undefined,
      xdcResult: mergedXdcResult,
    });
  };

  const handleProcessDesign = useCallback(async () => {
    setPipelineActive(true);
    setPipelineSteps(makePipelineSteps());
    setPendingApplyProject(null);
    setStatusMessage('Processing design…');

    try {
      // STEP: load — check inputs present
      markPipelineStep('load', 'running');
      await importTick();
      if (!hdlText.trim() && !zipInspection) {
        markPipelineStep('load', 'error', 'No HDL source — paste HDL or upload a ZIP first');
        setStatusMessage('Process failed: no HDL source.');
        setPipelineActive(false);
        return;
      }
      markPipelineStep('load', 'done');

      // STEP: parse-hdl
      markPipelineStep('parse-hdl', 'running');
      await importTick();
      const source = hdlText.trim();
      if (!source) {
        markPipelineStep('parse-hdl', 'skipped', 'No HDL pasted — using ZIP parse result');
      } else {
        try {
          const effectiveLang =
            language === 'auto' ? detectHdlLanguage(source) : (language as 'vhdl' | 'verilog');

          // If multiple entities detected and user selected one, slice to that block.
          let parseSource = source;
          if (selectedEntityName && detectedEntityNames.length > 1) {
            const sliceRx =
              effectiveLang === 'vhdl'
                ? new RegExp(
                    `entity\\s+${selectedEntityName}\\s+is[\\s\\S]*?end\\s+(?:entity\\s+)?(?:${selectedEntityName}\\s*)?;`,
                    'i'
                  )
                : new RegExp(
                    `\\bmodule\\s+${selectedEntityName}\\b[\\s\\S]*?endmodule`,
                    'i'
                  );
            const sliceMatch = source.match(sliceRx);
            if (sliceMatch) parseSource = sliceMatch[0];
          }
          const parsed = effectiveLang === 'vhdl' ? parseVhdl(parseSource) : parseVerilog(parseSource);
          setParsedHdl(parsed);
          setMapping((prev) => {
            const next: Record<string, string> = {};
            for (const port of parsed.ports) next[port.name] = prev[port.name] ?? '';
            return next;
          });
          markPipelineStep(
            'parse-hdl',
            parsed.ports.length > 0 ? 'done' : 'error',
            parsed.ports.length > 0
              ? `${parsed.entityName} · ${parsed.ports.length} ports`
              : 'No ports detected — check entity/module syntax'
          );
          if (parsed.ports.length === 0) {
            setStatusMessage('HDL parse found no ports.');
            setPipelineActive(false);
            return;
          }
        } catch (err) {
          markPipelineStep('parse-hdl', 'error', err instanceof Error ? err.message : 'parse failed');
          setStatusMessage(`HDL parse failed.`);
          setPipelineActive(false);
          return;
        }
      }

      // STEP: parse-xdc
      const xdcSource = xdcText.trim();
      if (!xdcSource && !xdcResult) {
        markPipelineStep('parse-xdc', 'skipped', 'No XDC — pins will need manual assignment');
      } else {
        markPipelineStep('parse-xdc', 'running');
        await importTick();
        if (xdcSource && !xdcResult) {
          try {
            const parsed = parseXdcPins(xdcSource);
            setXdcResult(parsed);
            setMapping((prev) => {
              const next = { ...prev };
              const activeParsedHdl = parsedHdl;
              if (activeParsedHdl) {
                for (const port of activeParsedHdl.ports) {
                  const mappedPin = parsed.pinMap[port.name] ?? parsed.pinMap[port.name.toLowerCase()];
                  if (mappedPin && !(next[port.name] ?? '').trim()) {
                    next[port.name] = mappedPin.toUpperCase();
                  }
                }
              }
              return next;
            });
            markPipelineStep('parse-xdc', 'done', `${Object.keys(parsed.pinMap).length} pin assignments`);
          } catch (err) {
            markPipelineStep('parse-xdc', 'error', err instanceof Error ? err.message : 'XDC parse failed');
            // non-fatal — continue
          }
        } else {
          markPipelineStep('parse-xdc', 'done', `${Object.keys(xdcResult!.pinMap).length} pins already parsed`);
        }
      }

      // STEP: validate
      markPipelineStep('validate', 'running');
      await importTick();
      const activePorts = parsedHdl?.ports ?? [];
      const activeMapping = mapping;
      const unmapped = activePorts.filter((p) => !(activeMapping[p.name] ?? '').trim());
      if (unmapped.length > 0) {
        markPipelineStep('validate', 'error', `${unmapped.length} unmapped port${unmapped.length !== 1 ? 's' : ''}`);
        setStatusMessage(`Validation: ${unmapped.length} unmapped ports.`);
        setPipelineActive(false);
        return;
      }
      markPipelineStep('validate', 'done', `${activePorts.length} ports valid`);

      // STEP: build
      markPipelineStep('build', 'running');
      await importTick(60);
      const built = buildCurrentProject();
      if (!built) {
        markPipelineStep('build', 'error', 'buildCurrentProject returned null');
        setStatusMessage('Build failed.');
        setPipelineActive(false);
        return;
      }
      const baselineVectors = generateBaselineVectors(built);
      const builtWithVectors: RBProject = baselineVectors.length > 0
        ? { ...built, vectors: baselineVectors }
        : built;
      setPendingApplyProject(builtWithVectors);
      markPipelineStep(
        'build',
        'done',
        baselineVectors.length > 0
          ? `${built.circuit.nodes.length} nodes · ${baselineVectors.length} baseline vectors`
          : `${built.circuit.nodes.length} nodes · ${built.circuit.connections.length} connections`
      );
      setStatusMessage('Design processed. Review commit preview below.');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown error';
      setStatusMessage(`Process failed: ${reason}`);
      setPipelineSteps((prev) =>
        prev.map((s) => (s.state === 'running' ? { ...s, state: 'error', detail: reason } : s))
      );
    } finally {
      setPipelineActive(false);
    }
  }, [
    hdlText, xdcText, language, zipInspection, xdcResult, parsedHdl, mapping,
    markPipelineStep, buildCurrentProject, selectedEntityName, detectedEntityNames,
  ]);

  const requestApplyProject = () => {
    if (!canImport) return;
    const nextProject = buildCurrentProject();
    if (!nextProject) return;
    setPendingApplyProject(nextProject);
    setStatusMessage('Confirm applying import to replace the active project.');
  };

  const confirmApplyProject = () => {
    if (!pendingApplyProject) return;
    onImportProject?.(pendingApplyProject);
    setPendingApplyProject(null);
    setStatusMessage(
      `RBProject ready: ${pendingApplyProject.circuit.nodes.length} nodes, ${pendingApplyProject.circuit.connections.length} connections.`
    );
  };

  const cancelApplyProject = () => {
    setPendingApplyProject(null);
    setStatusMessage('Import apply canceled.');
  };

  const confirmAndVerify = () => {
    if (!pendingApplyProject) return;
    onImportProject?.(pendingApplyProject);
    setPendingApplyProject(null);
    setStatusMessage('Project imported. Opening Verify…');
    onGoToVerify?.();
  };

  const handleOpenZipPicker = () => {
    zipInputRef.current?.click();
  };

  const handleZipInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleZipFile(file);
  };

  const handleZipDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleZipFile(file);
  };

  const handleZipFile = async (file: File) => {
    const fileName = file.name.trim().toLowerCase();
    if (!fileName.endsWith('.zip')) {
      setSubmissionImportFeedback(null);
      setStatusMessage('ZIP import requires a .zip archive.');
      return;
    }
    zipFileRef.current = file;
    setZipBusy(true);
    setPendingApplyProject(null);
    setSubmissionImportFeedback(null);

    // First: try parsing as a submission ZIP
    if (onImportSubmission) {
      try {
        const bytes = await file.arrayBuffer();
        const submission = await parseIdeSubmissionZip(bytes);
        setSubmissionImportFeedback({
          tone: 'success',
          title: 'Student submission detected',
          detail: 'Integrity check passed. Opening read-only submission viewer.',
        });
        setStatusMessage('Submission ZIP detected. Opening read-only submission viewer.');
        setZipBusy(false);
        onImportSubmission(submission);
        return;
      } catch (err) {
        if (err instanceof NotASubmissionZipError) {
          // NotASubmissionZipError → fall through to Vivado ZIP path
          setSubmissionImportFeedback(null);
        } else {
          // Integrity or parser errors are hard failures for submission imports.
          setZipBusy(false);
          if (err instanceof SubmissionIntegrityError) {
            setStatusMessage(err.message);
            setSubmissionImportFeedback({
              tone: 'error',
              title: 'Submission integrity check failed',
              detail: err.message,
            });
          } else {
            setStatusMessage(`Submission parse failed: ${err instanceof Error ? err.message : String(err)}`);
            setSubmissionImportFeedback({
              tone: 'error',
              title: 'Submission parse failed',
              detail: err instanceof Error ? err.message : String(err),
            });
          }
          return;
        }
      }
    }

    try {
      const inspection = await importVivadoZipFile(file);
      setZipInspection(inspection);
      setSelectedZipHdl(inspection.detectedTopPath);
      setSelectedZipXdc(inspection.detectedXdcPath ?? null);
      setTab('upload');
      setParsedHdl(inspection.parsedHdl);
      const topSource = inspection.project.hdl?.sources?.[0]?.text ?? '';
      setHdlText(topSource);
      const constraintsText = inspection.project.fpga?.constraints?.text ?? '';
      setXdcText(constraintsText);
      setXdcResult(inspection.xdcResult ?? null);
      setMapping(buildMappingRecord(inspection.project));
      const mappedPins = Object.values(buildMappingRecord(inspection.project)).filter(
        (pin) => pin.trim().length > 0
      ).length;
      setStatusMessage(
        `ZIP parsed: ${inspection.detectedTopPath}${inspection.detectedXdcPath ? ` + ${inspection.detectedXdcPath}` : ''} (${mappedPins}/${inspection.parsedHdl.ports.length} mapped).`
      );
      setSubmissionImportFeedback(null);
    } catch (error) {
      setZipInspection(null);
      setParsedHdl(null);
      setXdcResult(null);
      setStatusMessage(
        `ZIP import failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
      setSubmissionImportFeedback(null);
    } finally {
      setZipBusy(false);
    }
  };

  const handleReextractZip = async (hdlPath: string, xdcPath: string | null) => {
    const file = zipFileRef.current;
    if (!file) return;
    setZipBusy(true);
    setPendingApplyProject(null);
    try {
      const inspection = await reimportZipWithCandidates(file, hdlPath, xdcPath);
      setZipInspection(inspection);
      setSelectedZipHdl(hdlPath);
      setSelectedZipXdc(xdcPath);
      setParsedHdl(inspection.parsedHdl);
      const topSource = inspection.project.hdl?.sources?.[0]?.text ?? '';
      setHdlText(topSource);
      const constraintsText = inspection.project.fpga?.constraints?.text ?? '';
      setXdcText(constraintsText);
      setXdcResult(inspection.xdcResult ?? null);
      setMapping(buildMappingRecord(inspection.project));
      const mappedPins = Object.values(buildMappingRecord(inspection.project)).filter(
        (pin) => pin.trim().length > 0
      ).length;
      setStatusMessage(
        `Re-extracted: ${hdlPath}${xdcPath ? ` + ${xdcPath}` : ''} (${mappedPins}/${inspection.parsedHdl.ports.length} mapped).`
      );
    } catch (error) {
      setStatusMessage(`Re-extract failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setZipBusy(false);
    }
  };

  const copyDiagnostics = async () => {
    const report = buildDiagnosticsReport({
      parsedEntityName,
      ports,
      mapping,
      warnings,
      blockingErrors,
    });
    try {
      await navigator.clipboard.writeText(report);
      setCopyFeedback('copied');
      setStatusMessage('Diagnostics copied to clipboard.');
    } catch {
      setCopyFeedback('failed');
      setStatusMessage('Copy failed. Browser clipboard permission denied.');
    }
  };

  return (
    <IdeSurfaceLayout
      mode="import"
      consoleHasBlocking={blockingErrors.length > 0}
      consoleHasEntries={blockingErrors.length > 0 || warnings.length > 0}
      dock={
        <section className="ide-workbench-placeholder" data-testid="ide-import-dock">
          <header className="ide-workbench-placeholder-header">
            <h3>Import</h3>
          </header>
          <div className="ide-kv-list">
            <div className="ide-kv-row">
              <span>HDL</span>
              <IdeStatusPill tone={hasParsedHdl ? 'ok' : 'idle'}>
                {hasParsedHdl ? 'Parsed' : 'Pending'}
              </IdeStatusPill>
            </div>
            <div className="ide-kv-row">
              <span>XDC</span>
              <IdeStatusPill tone={hasParsedXdc ? 'ok' : 'idle'}>
                {hasParsedXdc ? 'Parsed' : 'Pending'}
              </IdeStatusPill>
            </div>
          </div>
          {submissionImportFeedback && (
            <IdeCallout
              tone={submissionImportFeedback.tone}
              title={submissionImportFeedback.title}
              testId={
                submissionImportFeedback.tone === 'success'
                  ? 'ide-import-submission-detected'
                  : 'ide-import-submission-integrity-failed'
              }
            >
              {submissionImportFeedback.detail}
            </IdeCallout>
          )}
          <section className="ide-import-feedback" data-testid="ide-import-parse-feedback">
            <header className="ide-workbench-placeholder-header" style={{ marginTop: 'var(--ide-space-2)' }}>
              <h3>Parse Feedback</h3>
              {hasParsedHdl && (
                <IdeStatusPill tone={hdlLooksValid ? 'ok' : hdlWarningCount > 0 ? 'warn' : 'idle'}>
                  {hdlLooksValid
                    ? 'OK'
                    : hdlWarningCount > 0
                      ? `${hdlWarningCount} warning${hdlWarningCount === 1 ? '' : 's'}`
                      : 'Needs review'}
                </IdeStatusPill>
              )}
            </header>

            {!hasParsedHdl ? (
              <p className="ide-copy">Parse HDL to see feedback.</p>
            ) : hdlLooksValid && hdlWarningCount === 0 ? (
              <>
                <div className="ide-import-parse-summary" data-testid="ide-import-stage-summary">
                  <span data-testid="ide-import-entity-summary">
                    Entity: <strong>{parsedEntityName}</strong>
                  </span>
                  <span data-testid="ide-import-port-summary">
                    {parsedHdl!.ports.length} port{parsedHdl!.ports.length !== 1 ? 's' : ''}{' '}
                    ({parsedHdl!.ports.filter((p) => p.direction === 'in').length} in
                    {' / '}{parsedHdl!.ports.filter((p) => p.direction === 'out').length} out)
                  </span>
                  {hasParsedXdc ? (
                    <span data-testid="ide-import-xdc-ok">XDC ✓</span>
                  ) : (
                    <span style={{ color: 'var(--rb-warning)', fontSize: 10 }} data-testid="ide-import-xdc-missing">
                      No XDC — pins auto-guessed
                    </span>
                  )}
                </div>
                {clockCandidatePort && (
                  <div
                    className="ide-import-clock-candidate"
                    data-testid="ide-import-clock-candidate"
                  >
                    <IdeStatusPill tone="ok">CLK</IdeStatusPill>
                    <code>{clockCandidatePort.name}</code>
                    <span>
                      {xdcResult?.pinMap[clockCandidatePort.name]
                        ? `→ ${xdcResult.pinMap[clockCandidatePort.name]}`
                        : 'no pin constraint yet'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                {!hdlLooksValid && (
                  <IdeCallout
                    tone="warn"
                    title="Ports not detected"
                    testId="ide-import-hdl-ports-not-detected"
                  >
                    The parser couldn&apos;t confidently detect your top entity and ports. Check warnings below and verify your entity/module syntax.
                  </IdeCallout>
                )}
                {hdlWarningCount > 0 ? (
                  <ol className="ide-warning-list" data-testid="ide-import-parse-warnings">
                    {hdlParseWarnings.slice(0, 10).map((w, idx) => (
                      <li
                        key={`${idx}-${w.message.slice(0, 20)}`}
                        className="ide-warning-row"
                        data-testid="ide-import-parse-warning-row"
                      >
                        <span className="ide-warning-index">{idx + 1}.</span>
                        <span className="ide-warning-text">
                          {w.line != null ? (
                            <button
                              type="button"
                              className="ide-warning-jump"
                              onClick={() => scrollToLine(w.line!)}
                              data-testid="ide-import-parse-warning-line"
                              title={`Jump to line ${w.line}`}
                            >
                              Ln {w.line}
                            </button>
                          ) : null}
                          {w.message}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="ide-copy">No warnings were emitted, but ports still weren&apos;t detected.</p>
                )}
                {hdlWarningCount > 10 && (
                  <p className="ide-copy" data-testid="ide-import-warning-truncation">
                    Showing first 10 warnings.
                  </p>
                )}
              </>
            )}
          </section>
          <section className="ide-mini-guide" data-testid="ide-import-expectations">
            <h4>What happens when you import</h4>
            <ul className="ide-bullets">
              <li><b>Apply Pins Only</b> fills missing pin assignments on your current project.</li>
              <li><b>Replace Project…</b> swaps in the imported design (can overwrite your work).</li>
            </ul>
          </section>
          <div className="ide-import-samples-grid">
            {IMPORT_SAMPLES.filter((s) => !s.behavioral).map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="ide-import-sample-card"
                onClick={() => {
                  setHdlText(sample.hdl);
                  setXdcText(sample.xdc);
                  setTab('hdl');
                  parseHdl(sample.hdl);
                  if (sample.xdc.trim()) parseXdc(sample.xdc);
                }}
                data-testid={`ide-import-load-sample-${sample.id}`}
              >
                <span className="ide-import-sample-card-name">{sample.name}</span>
                <span className="ide-import-sample-card-desc">{sample.desc}</span>
                <span className="ide-import-sample-card-learn">🎓 {sample.learn}</span>
              </button>
            ))}
            {showBehavioralSamples && IMPORT_SAMPLES.filter((s) => s.behavioral).map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="ide-import-sample-card ide-import-sample-card--behavioral"
                onClick={() => {
                  setHdlText(sample.hdl);
                  setXdcText(sample.xdc);
                  setTab('hdl');
                  parseHdl(sample.hdl);
                  if (sample.xdc.trim()) parseXdc(sample.xdc);
                }}
                data-testid={`ide-import-load-sample-${sample.id}`}
                style={{ opacity: 0.7, borderStyle: 'dashed' }}
              >
                <span className="ide-import-sample-card-name">{sample.name}</span>
                <span className="ide-import-sample-card-desc">{sample.desc}</span>
                <span className="ide-import-sample-card-learn">⚠️ {sample.learn}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="ide-import-behavioral-toggle"
            data-testid="ide-import-toggle-behavioral-samples"
            onClick={() => setShowBehavioralSamples((prev) => !prev)}
          >
            {showBehavioralSamples ? '▲ Hide unsupported examples' : '▼ Show unsupported examples (will be blocked)'}
          </button>
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Port Suggestions" defaultOpen testId="ide-import-port-suggestions">
            {!parsedHdl ? (
              <p className="ide-copy" data-testid="ide-import-port-suggestions-empty">Parse HDL to see port suggestions.</p>
            ) : !hdlLooksValid ? (
              <p className="ide-copy" data-testid="ide-import-port-suggestions-empty">
                Ports not detected — see Parse Feedback in the left dock for warnings.
              </p>
            ) : suggestions.length === 0 ? (
              <p className="ide-copy">No ports found in parsed HDL.</p>
            ) : (
              <>
                {/* Summary counts */}
                <div className="ide-kv-list" style={{ marginBottom: 'var(--ide-space-2)' }}>
                  <div className="ide-kv-row">
                    <span>Ready to apply</span>
                    <IdeStatusPill tone="ok">{applicableItems.length}</IdeStatusPill>
                  </div>
                  <div className="ide-kv-row">
                    <span>Already pinned</span>
                    <IdeStatusPill tone="idle">{suggestions.filter(s => s.locked).length}</IdeStatusPill>
                  </div>
                  <div className="ide-kv-row">
                    <span>No project row</span>
                    <IdeStatusPill tone="idle">{suggestions.filter(s => !s.rowId).length}</IdeStatusPill>
                  </div>
                </div>

                {/* Suggestion rows */}
                {suggestions.map((s) => {
                  const confidenceTone = s.confidence === 'high' ? 'ok' : s.confidence === 'medium' ? 'warn' : 'idle';
                  return (
                    <div
                      key={s.portName}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 'var(--ide-space-1)',
                        alignItems: 'start',
                        padding: 'var(--ide-space-1) 0',
                        borderBottom: '1px solid color-mix(in srgb, var(--ide-border) 40%, transparent)',
                        opacity: s.locked || !s.rowId ? 0.5 : 1,
                      }}
                      data-testid={`ide-import-suggestion-${s.portName}`}
                    >
                      <div>
                        <code style={{ fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>
                          {s.portName}
                        </code>
                        <span style={{ marginLeft: 'var(--ide-space-1)', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                          {s.direction === 'in' ? '→' : '←'}
                        </span>
                      </div>
                      <IdeStatusPill tone={confidenceTone}>{s.confidence === 'high' ? 'HIGH' : s.confidence === 'medium' ? 'MED' : 'LOW'}</IdeStatusPill>

                      {/* Pin control */}
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 'var(--ide-space-1)' }}>
                        <select
                          disabled={s.locked || !s.rowId}
                          value={overrides[s.portName] !== undefined ? (overrides[s.portName] ?? '') : (s.pin ?? '')}
                          onChange={(e) => setOverrides(prev => ({ ...prev, [s.portName]: e.target.value || null }))}
                          style={{
                            flex: 1,
                            fontFamily: 'var(--rb-font-mono)',
                            fontSize: 'var(--rb-font-size-1)',
                            background: 'var(--ide-bg-input, #0e1e2e)',
                            color: 'var(--ide-text)',
                            border: '1px solid var(--ide-border)',
                            borderRadius: 'var(--ide-radius-s)',
                            padding: '2px 4px',
                          }}
                          aria-label={`Pin for ${s.portName}`}
                        >
                          {s.pin && <option value={s.pin}>{s.pin} (XDC)</option>}
                          <option value="">— (skip)</option>
                          {/* Common Basys pins as convenience */}
                          {BASYS3_PHYSICAL_QUICK_PINS.map(p =>
                            p !== s.pin ? <option key={p} value={p}>{p}</option> : null
                          )}
                        </select>
                        {s.locked && (
                          <span style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>locked</span>
                        )}
                        {!s.rowId && (
                          <span style={{ fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>not in project</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Apply all */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ide-space-2)', marginTop: 'var(--ide-space-3)' }}>
                  <IdeButton
                    tone="primary"
                    onClick={handleApplyAll}
                    testId="ide-import-apply-all"
                    disabled={applicableItems.length === 0}
                  >
                    Apply {applicableItems.length} suggestion{applicableItems.length !== 1 ? 's' : ''} to project
                  </IdeButton>
                  {onGoToProject && (
                    <IdeButton
                      tone="secondary"
                      onClick={onGoToProject}
                      testId="ide-import-go-project"
                    >
                      Review in Project
                    </IdeButton>
                  )}
                </div>
              </>
            )}
          </IdeInspectorSection>
          <IdeInspectorSection title="Import Status" defaultOpen>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>HDL</span>
                <IdeStatusPill tone={hasParsedHdl ? 'ok' : 'idle'}>
                  {hasParsedHdl ? 'Parsed' : 'Pending'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>XDC</span>
                <IdeStatusPill tone={hasParsedXdc ? 'ok' : 'idle'}>
                  {hasParsedXdc ? 'Parsed' : 'Optional'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Ports mapped</span>
                <span>
                  {ports.length - unmappedPorts.length}/{ports.length}
                </span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Next Step" defaultOpen={false}>
            {canImport ? (
              <IdeCallout tone="success" title="Ready to Import">
                Mapping is complete. Import this design to the project graph.
              </IdeCallout>
            ) : (
              <IdeCallout tone="warn" title="Resolve Blockers">
                Parse HDL, parse XDC, then map required ports before importing.
              </IdeCallout>
            )}
          </IdeInspectorSection>
        </>
      }
    >
      <IdePanel
        title="Import HDL"
        description="Paste or upload VHDL/Verilog and XDC constraints to load a design into the circuit editor."
        actions={
          <>
            <IdeButton tone="secondary" onClick={parseHdl} testId="ide-import-parse">
              Parse HDL
            </IdeButton>
            <IdeButton tone="secondary" onClick={parseXdc} testId="ide-import-parse-xdc">
              Parse XDC
            </IdeButton>
            <IdeButton
              tone="secondary"
              onClick={applySuggestions}
              disabled={!canApplySuggestions}
              testId="ide-import-apply-pins-only"
            >
              Apply Pins Only
            </IdeButton>
            <IdeButton tone="ghost" onClick={copyDiagnostics} testId="ide-import-copy-diagnostics">
              Copy report
            </IdeButton>
            <IdeButton
              tone="secondary"
              onClick={() => void handleProcessDesign()}
              disabled={pipelineActive || (!hdlText.trim() && !zipInspection)}
              testId="ide-import-process-design"
            >
              {pipelineActive ? 'Processing…' : 'Process Design'}
            </IdeButton>
            <span data-testid="ide-primary-cta">
              <IdeButton
                tone="primary"
                onClick={requestApplyProject}
                disabled={!canImport}
                testId="ide-import-replace-project"
              >
                Replace Project…
              </IdeButton>
            </span>
            {!canImport && hasParsedHdl && (
              <span className="ide-import-apply-reason" data-testid="ide-import-apply-disabled-reason">
                {unmappedPorts.length > 0
                  ? `${unmappedPorts.length} unmapped port${unmappedPorts.length > 1 ? 's' : ''}`
                  : `${blockingErrors.length} blocking error${blockingErrors.length > 1 ? 's' : ''}`}
              </span>
            )}
          </>
        }
        right={
          canImport ? (
            <IdeStatusPill tone="ok">Ready</IdeStatusPill>
          ) : (
            <IdeStatusPill tone="warn">Needs Mapping</IdeStatusPill>
          )
        }
        testId="ide-import-panel"
      >
        <p
          className="ide-copy"
          style={{ color: 'var(--ide-text-soft)', marginBottom: 'var(--ide-space-2)' }}
          data-testid="ide-import-mode-hint"
        >
          Import can fill pins on your current project, or replace the whole project.
        </p>
        {pendingApplyProject && commitPreview ? (
          <div className="ide-import-commitPreview" data-testid="ide-import-commit-preview">
            <div className="ide-import-commitPreview-header">
              <span className="ide-import-commitPreview-title">COMMIT PREVIEW</span>
              <IdeStatusPill tone="warn">Pending</IdeStatusPill>
            </div>

            <div className="ide-import-commitPreview-rows">
              <div className="ide-import-commitPreview-row">
                <span className="ide-import-commitPreview-key">ENTITY</span>
                <span className="ide-import-commitPreview-val">
                  {commitPreview.entityName}
                  <span className="ide-import-commitPreview-lang"> ({commitPreview.lang.toUpperCase()})</span>
                </span>
              </div>
              <div className="ide-import-commitPreview-row">
                <span className="ide-import-commitPreview-key">PORTS</span>
                <span className="ide-import-commitPreview-val">
                  {commitPreview.totalPorts} total · {commitPreview.inCount} in / {commitPreview.outCount} out
                </span>
              </div>
              <div className="ide-import-commitPreview-row">
                <span className="ide-import-commitPreview-key">PINS</span>
                <span className="ide-import-commitPreview-val">
                  {commitPreview.mappedCount}/{commitPreview.totalPorts} mapped
                </span>
              </div>
              <div className="ide-import-commitPreview-row">
                <span className="ide-import-commitPreview-key">GRAPH</span>
                <span className="ide-import-commitPreview-val">
                  {commitPreview.reconstructionLevel === 'full'
                    ? `full · ${commitPreview.nodeCount} nodes`
                    : commitPreview.reconstructionLevel === 'ports-only'
                      ? `ports only (behavioral) · ${commitPreview.nodeCount} nodes`
                      : `empty`}
                </span>
              </div>
              {commitPreview.addedPorts.length > 0 && (
                <div className="ide-import-commitPreview-row ide-import-commitPreview-row--add">
                  <span className="ide-import-commitPreview-key">+PORTS</span>
                  <span className="ide-import-commitPreview-val">
                    {commitPreview.addedPorts.slice(0, 6).map((p) => p.name).join(', ')}
                    {commitPreview.addedPorts.length > 6 ? ` +${commitPreview.addedPorts.length - 6} more` : ''}
                  </span>
                </div>
              )}
              {commitPreview.removedPortNames.length > 0 && (
                <div className="ide-import-commitPreview-row ide-import-commitPreview-row--remove">
                  <span className="ide-import-commitPreview-key">−PORTS</span>
                  <span className="ide-import-commitPreview-val">
                    {commitPreview.removedPortNames.slice(0, 6).join(', ')}
                    {commitPreview.removedPortNames.length > 6 ? ` +${commitPreview.removedPortNames.length - 6} more` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* ── STOP-SHIP: Behavioral / empty-circuit blocker ── */}
            {hasImportBlocker && (
              <div
                className="ide-import-behavioral-blocker"
                data-testid="ide-import-behavioral-blocker"
                role="alert"
                style={{
                  margin: 'var(--ide-space-2) 0',
                  padding: 'var(--ide-space-2)',
                  border: '2px solid var(--rb-error, #e55)',
                  borderRadius: 'var(--ide-radius-s)',
                  background: 'color-mix(in srgb, var(--rb-error, #e55) 12%, transparent)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 'var(--ide-space-1)', color: 'var(--rb-error, #e55)' }}>
                  BLOCKED — Cannot commit this import
                </strong>
                {importBlockerReasons.map((reason, i) => (
                  <p key={i} style={{ margin: '0 0 var(--ide-space-1)', fontSize: 'var(--rb-font-size-1)' }}>
                    {reason}
                  </p>
                ))}
                {detectedBehavioralConstructs.length > 0 && (
                  <details style={{ marginTop: 'var(--ide-space-1)' }}>
                    <summary
                      style={{ cursor: 'pointer', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}
                      data-testid="ide-import-blocker-dropped-constructs-summary"
                    >
                      Show dropped constructs ({detectedBehavioralConstructs.length})
                    </summary>
                    <ul
                      style={{ margin: 'var(--ide-space-1) 0 0 var(--ide-space-2)', padding: 0, listStyle: 'disc', fontSize: 'var(--rb-font-size-1)' }}
                      data-testid="ide-import-blocker-dropped-constructs"
                    >
                      {detectedBehavioralConstructs.map((c) => (
                        <li key={c}><code>{c}</code></li>
                      ))}
                    </ul>
                    <p style={{ marginTop: 'var(--ide-space-1)', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                      RedByte supports structural/combinational HDL only. Behavioral constructs are detected and reported but their logic is not imported.
                    </p>
                  </details>
                )}
              </div>
            )}

            <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)', flexWrap: 'wrap' }}>
              <IdeButton tone="ghost" onClick={cancelApplyProject} testId="ide-import-apply-cancel">
                Cancel
              </IdeButton>
              <IdeButton
                tone="secondary"
                onClick={confirmApplyProject}
                disabled={hasImportBlocker}
                testId="ide-import-apply-confirm"
              >
                Confirm Replace Project
              </IdeButton>
              {onGoToVerify && (
                <div className="ide-import-verify-cta">
                  <span className="ide-import-verify-cta-label">
                    {hasImportBlocker
                      ? 'Blocked — resolve issues above'
                      : (pendingApplyProject?.vectors?.length ?? 0) > 0
                        ? `${pendingApplyProject!.vectors!.length} baseline vectors ready`
                        : 'Import + open Verify'}
                  </span>
                  <IdeButton
                    tone="primary"
                    onClick={confirmAndVerify}
                    disabled={hasImportBlocker}
                    testId="ide-import-apply-open-verify"
                  >
                    Confirm &amp; Open Verify →
                  </IdeButton>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {tab === 'upload' && (
          <p style={{
            margin: '0 0 var(--ide-space-2)',
            fontSize: 'var(--rb-font-size-1)',
            color: 'var(--ide-text-soft)',
            fontFamily: 'var(--ide-font-mono)',
            letterSpacing: '0.02em',
          }}>
            Try this in 60s: Load sample → Parse HDL → Parse XDC → Apply suggestions → Review
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ide-space-3)', marginBottom: 'var(--ide-space-3)' }}>
          {(['upload', 'hdl', 'xdc'] as ImportTab[]).map((tabId, i) => (
            <button
              key={tabId}
              type="button"
              className={`ide-pipeline-stage ${tab === tabId ? 'ide-pipeline-stage--active' : 'ide-pipeline-stage--pending'}`}
              onClick={() => setTab(tabId)}
              aria-current={tab === tabId ? 'step' : undefined}
            >
              <span className="ide-pipeline-badge">{i + 1}</span>
              <span className="ide-pipeline-label">
                {tabId === 'upload' ? 'Upload ZIP' : tabId === 'hdl' ? 'VHDL / Verilog' : 'XDC Constraints'}
              </span>
            </button>
          ))}
        </div>
        {pipelineSteps.some((s) => s.state !== 'idle') && (
          <ol className="ide-import-pipeline-steps" data-testid="ide-import-pipeline-steps">
            {pipelineSteps.map((s) => (
              <li
                key={s.id}
                className={`ide-import-pipeline-step ide-import-pipeline-step--${s.state}`}
                data-testid={`ide-import-pipeline-step-${s.id}`}
              >
                <span className="ide-import-step-mark">
                  {s.state === 'done'    ? '[✔]'
                 : s.state === 'running' ? '[…]'
                 : s.state === 'error'   ? '[✗]'
                 : s.state === 'skipped' ? '[—]'
                 :                         '[ ]'}
                </span>
                <span className="ide-import-step-label">{s.label}</span>
                {s.detail && <span className="ide-import-step-detail">{s.detail}</span>}
              </li>
            ))}
          </ol>
        )}
        <IdeGrid columns={2} testId="ide-import-pipeline-grid">
          <section className="ide-import-stage-col" data-testid="ide-import-inputs">
            <IdeSectionHeader title="Inputs" meta="Stage 1" />

            <div className="ide-import-target-cards">
              <button
                type="button"
                className={`ide-import-target-card${tab === 'hdl' ? ' is-active' : ''}${hasParsedHdl ? ' is-done' : ''}`}
                onClick={() => setTab('hdl')}
                data-testid="ide-import-card-hdl"
              >
                <span className="ide-import-target-card-icon">&lt;/&gt;</span>
                <span className="ide-import-target-card-title">HDL Source</span>
                <span className="ide-import-target-card-desc">Paste Verilog or VHDL module</span>
                {hasParsedHdl && <span className="ide-import-target-card-badge">&#10003; Parsed</span>}
              </button>
              <button
                type="button"
                className={`ide-import-target-card${tab === 'xdc' ? ' is-active' : ''}${hasParsedXdc ? ' is-done' : ''}`}
                onClick={() => setTab('xdc')}
                data-testid="ide-import-card-xdc"
              >
                <span className="ide-import-target-card-icon">&#x2316;</span>
                <span className="ide-import-target-card-title">XDC Constraints</span>
                <span className="ide-import-target-card-desc">Pin assignments from Vivado</span>
                {hasParsedXdc ? (
                  <span className="ide-import-target-card-badge">&#10003; Parsed</span>
                ) : (
                  <span className="ide-import-target-card-optional">Optional</span>
                )}
              </button>
              <button
                type="button"
                className={`ide-import-target-card ide-import-target-card-zip${tab === 'upload' ? ' is-active' : ''}${hasZipInspection ? ' is-done' : ''}`}
                onClick={() => { setTab('upload'); handleOpenZipPicker(); }}
                disabled={zipBusy}
                data-testid="ide-import-card-zip"
              >
                <span className="ide-import-target-card-icon">&#x25A6;</span>
                <span className="ide-import-target-card-title">Vivado ZIP</span>
                <span className="ide-import-target-card-desc">
                  {zipBusy ? 'Importing...' : 'Auto-extract top module + constraints'}
                </span>
                {hasZipInspection ? (
                  <span className="ide-import-target-card-badge">&#10003; Loaded</span>
                ) : (
                  <span className="ide-import-target-card-optional">Recommended</span>
                )}
              </button>
            </div>

            {hasParsedHdl && (
              <div className="ide-import-parse-summary" data-testid="ide-import-parse-summary">
                <span>Detected:</span>
                <strong>{parsedHdl!.entityName}</strong>
                <span>{ports.length} port{ports.length !== 1 ? 's' : ''}</span>
                <span>XDC: {hasParsedXdc ? `${Object.keys(xdcResult!.pinMap).length} pins` : 'none'}</span>
                {blockingErrors.length > 0 && (
                  <span className="ide-import-summary-issues">{blockingErrors.length} issue{blockingErrors.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}

            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              className="ide-hidden-file-input"
              onChange={(event) => {
                void handleZipInputChange(event);
              }}
              data-testid="ide-import-zip-input"
            />

            {tab === 'hdl' && (
              <div className="ide-import-editor">
                {/* ── Supported HDL subset declaration (Req 6 from audit) ── */}
                <details
                  className="ide-import-hdl-scope-box"
                  data-testid="ide-import-hdl-scope"
                  style={{
                    marginBottom: 'var(--ide-space-2)',
                    border: '1px solid var(--ide-border)',
                    borderRadius: 'var(--ide-radius-s)',
                    padding: 'var(--ide-space-1) var(--ide-space-2)',
                    fontSize: 'var(--rb-font-size-1)',
                  }}
                >
                  <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: 'var(--ide-space-1)' }}>
                    What HDL does RedByte support? (click to expand)
                  </summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--ide-space-2)', marginTop: 'var(--ide-space-1)' }}>
                    <div>
                      <strong style={{ color: 'var(--rb-success, #4a4)' }}>Supported</strong>
                      <ul style={{ margin: 'var(--ide-space-1) 0 0 var(--ide-space-2)', padding: 0, listStyle: 'disc' }}>
                        <li>entity / port declarations (VHDL + Verilog)</li>
                        <li>structural component instantiations</li>
                        <li>concurrent signal assignments</li>
                        <li>Verilog gate primitives (and, or, not, xor …)</li>
                        <li>simple assign statements</li>
                      </ul>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--rb-error, #e55)' }}>Not supported — will be BLOCKED</strong>
                      <ul style={{ margin: 'var(--ide-space-1) 0 0 var(--ide-space-2)', padding: 0, listStyle: 'disc' }}>
                        <li>process / always blocks</li>
                        <li>sequential / clocked logic (rising_edge, posedge)</li>
                        <li>generate statements</li>
                        <li>generics / parameters</li>
                        <li>multiple architectures (first only)</li>
                      </ul>
                    </div>
                  </div>
                </details>

                {/* Live behavioral warning banner — shows immediately as user types */}
                {detectedBehavioralConstructs.length > 0 && (
                  <div
                    className="ide-import-behavioral-warning"
                    data-testid="ide-import-behavioral-warning"
                    role="alert"
                    style={{
                      marginBottom: 'var(--ide-space-2)',
                      padding: 'var(--ide-space-1) var(--ide-space-2)',
                      border: '1px solid var(--rb-warning, #fa0)',
                      borderRadius: 'var(--ide-radius-s)',
                      background: 'color-mix(in srgb, var(--rb-warning, #fa0) 10%, transparent)',
                      fontSize: 'var(--rb-font-size-1)',
                    }}
                  >
                    <strong>Behavioral/sequential constructs detected</strong> — this design uses{' '}
                    {detectedBehavioralConstructs.join(', ')}. RedByte supports structural/combinational
                    HDL only. Importing will block at the commit step.
                  </div>
                )}

                <div className="ide-import-language-row">
                  <span>Language</span>
                  <select
                    className="ide-export-pin-input"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as HdlLanguage)}
                    data-testid="ide-import-language-select"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="vhdl">VHDL</option>
                    <option value="verilog">Verilog</option>
                  </select>
                </div>
                {detectedEntityNames.length >= 2 && (
                  <div className="ide-import-entity-chooser" data-testid="ide-import-entity-chooser">
                    <span className="ide-import-entity-chooser-label">Top Entity</span>
                    <select
                      className="ide-export-pin-input"
                      value={selectedEntityName ?? detectedEntityNames[0]}
                      onChange={(e) => setSelectedEntityName(e.target.value)}
                      data-testid="ide-import-entity-select"
                    >
                      {detectedEntityNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <span className="ide-import-entity-chooser-hint" data-testid="ide-import-entity-hint">
                      {(selectedEntityName ?? detectedEntityNames[0]) === detectedEntityNames[0]
                        ? 'Auto-selected: first entity'
                        : 'User selected'}
                    </span>
                  </div>
                )}
                <div className="ide-code-editor" data-testid="ide-import-hdl-editor">
                  <div
                    className="ide-code-gutter"
                    aria-hidden="true"
                    data-testid="ide-import-hdl-gutter"
                    ref={hdlGutterRef}
                  >
                    {Array.from({ length: lineCount }, (_, i) => {
                      const lineNum = i + 1;
                      return (
                        <span
                          key={lineNum}
                          className={`ide-code-gutter-line${activeWarningLine === lineNum ? ' ide-code-gutter-line--warn' : ''}`}
                        >
                          {lineNum}
                        </span>
                      );
                    })}
                  </div>
                  <textarea
                    ref={hdlTextareaRef}
                    className="ide-code-textarea"
                    data-testid="ide-import-hdl-textarea"
                    value={hdlText}
                    onChange={(e) => setHdlText(e.target.value)}
                    onScroll={handleHdlScroll}
                    onKeyDown={handleHdlKeyDown}
                    placeholder="Paste module/entity source here."
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>
              </div>
            )}

            {tab === 'xdc' && (
              <div className="ide-import-editor">
                <div className="ide-code-editor" data-testid="ide-import-xdc-editor">
                  <div
                    className="ide-code-gutter"
                    aria-hidden="true"
                    ref={xdcGutterRef}
                  >
                    {Array.from({ length: xdcLineCount }, (_, i) => {
                      const lineNum = i + 1;
                      return (
                        <span
                          key={lineNum}
                          className={`ide-code-gutter-line${
                            activeXdcWarningLine === lineNum ? ' ide-code-gutter-line--warn' : ''
                          }`}
                        >
                          {lineNum}
                        </span>
                      );
                    })}
                  </div>
                  <textarea
                    ref={xdcTextareaRef}
                    className="ide-code-textarea"
                    data-testid="ide-import-xdc-input"
                    value={xdcText}
                    onChange={(event) => setXdcText(event.target.value)}
                    onScroll={handleXdcScroll}
                    placeholder="Paste XDC constraints here."
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>
              </div>
            )}

            {tab === 'upload' && (
              <div className="ide-empty-stack ide-import-zip-stage" data-testid="ide-import-zip-stage">
                <div
                  className="ide-empty-illustration ide-empty-illustration-import"
                  aria-hidden="true"
                  data-testid="ide-import-zip-dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    void handleZipDrop(event);
                  }}
                />
                <IdeCallout tone="info" title="Vivado ZIP Import">
                  Drop a Vivado project ZIP, or browse to inspect detected top/module and constraints.
                </IdeCallout>
                <div className="ide-inline-actions">
                  <IdeButton
                    tone="secondary"
                    onClick={handleOpenZipPicker}
                    disabled={zipBusy}
                    testId="ide-import-zip-browse"
                  >
                    {zipBusy ? 'Importing ZIP...' : 'Select ZIP'}
                  </IdeButton>
                </div>

                {zipInspection ? (
                  <section className="ide-export-section" data-testid="ide-import-zip-inspection">
                    <IdeSectionHeader
                      title="ZIP Inspection"
                      meta={`${zipInspection.detectedFiles.length} detected / ${zipInspection.ignoredFiles.length} ignored`}
                    />
                    <div className="ide-import-zip-chooser" data-testid="ide-import-zip-chooser">
                      <div className="ide-import-zip-chooser-col">
                        <div className="ide-import-zip-chooser-label">
                          HDL Top
                          {zipInspection.detectedTopPath === selectedZipHdl && (
                            <span className="ide-import-zip-auto-badge" data-testid="ide-import-zip-hdl-auto">auto</span>
                          )}
                        </div>
                        {zipInspection.hdlCandidates.map((path) => (
                          <label
                            key={path}
                            className={`ide-import-zip-radio-row${selectedZipHdl === path ? ' is-selected' : ''}`}
                            data-testid={`ide-import-zip-hdl-option-${path}`}
                          >
                            <input
                              type="radio"
                              name="zip-hdl"
                              value={path}
                              checked={selectedZipHdl === path}
                              onChange={() => setSelectedZipHdl(path)}
                            />
                            <code className="ide-import-zip-radio-path">{path}</code>
                            {path === zipInspection.detectedTopPath && (
                              <span className="ide-import-zip-score-badge">scored #1</span>
                            )}
                          </label>
                        ))}
                      </div>

                      <div className="ide-import-zip-chooser-col">
                        <div className="ide-import-zip-chooser-label">
                          XDC Constraints
                          {zipInspection.detectedXdcPath === selectedZipXdc && (
                            <span className="ide-import-zip-auto-badge" data-testid="ide-import-zip-xdc-auto">auto</span>
                          )}
                        </div>
                        <label
                          className={`ide-import-zip-radio-row${selectedZipXdc === null ? ' is-selected' : ''}`}
                          data-testid="ide-import-zip-xdc-option-none"
                        >
                          <input
                            type="radio"
                            name="zip-xdc"
                            value=""
                            checked={selectedZipXdc === null}
                            onChange={() => setSelectedZipXdc(null)}
                          />
                          <span className="ide-import-zip-radio-path" style={{ color: 'var(--ide-text-muted)' }}>none</span>
                        </label>
                        {zipInspection.xdcCandidates.map((path) => (
                          <label
                            key={path}
                            className={`ide-import-zip-radio-row${selectedZipXdc === path ? ' is-selected' : ''}`}
                            data-testid={`ide-import-zip-xdc-option-${path}`}
                          >
                            <input
                              type="radio"
                              name="zip-xdc"
                              value={path}
                              checked={selectedZipXdc === path}
                              onChange={() => setSelectedZipXdc(path)}
                            />
                            <code className="ide-import-zip-radio-path">{path}</code>
                            {path === zipInspection.detectedXdcPath && (
                              <span className="ide-import-zip-score-badge">scored #1</span>
                            )}
                          </label>
                        ))}
                      </div>

                      {(selectedZipHdl !== zipInspection.detectedTopPath ||
                        selectedZipXdc !== (zipInspection.detectedXdcPath ?? null)) && selectedZipHdl && (
                        <div className="ide-inline-actions" style={{ gridColumn: '1 / -1', marginTop: 'var(--ide-space-1)' }}>
                          <IdeButton
                            tone="secondary"
                            onClick={() => void handleReextractZip(selectedZipHdl, selectedZipXdc)}
                            disabled={zipBusy}
                            testId="ide-import-zip-reextract"
                          >
                            {zipBusy ? 'Re-extracting…' : 'Re-extract with selection'}
                          </IdeButton>
                        </div>
                      )}
                    </div>

                    <div className="ide-kv-list">
                      <div className="ide-kv-row">
                        <span>Language</span>
                        <span data-testid="ide-import-zip-top-language">
                          {zipInspection.detectedTopLanguage.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ide-import-zip-lists">
                      <div>
                        <h4>Detected</h4>
                        <ul className="ide-list" data-testid="ide-import-zip-detected-list">
                          {zipInspection.detectedFiles.map((path) => (
                            <li key={path}>
                              <code>{path}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4>Ignored</h4>
                        {zipInspection.ignoredFiles.length > 0 ? (
                          <ul className="ide-list" data-testid="ide-import-zip-ignored-list">
                            {zipInspection.ignoredFiles.slice(0, 10).map((path) => (
                              <li key={path}>
                                <code>{path}</code>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ide-copy">No extra files ignored.</p>
                        )}
                      </div>
                    </div>
                    {zipInspection.weakPinPorts.length > 0 && (
                      <div className="ide-import-weak-pins-callout" data-testid="ide-import-weak-pins">
                        <span className="ide-import-weak-pins-label">Weak pin mappings</span>
                        <p>
                          {zipInspection.weakPinPorts.length} port{zipInspection.weakPinPorts.length !== 1 ? 's' : ''} have
                          pins that are not in the Basys3 pin table. They have been mapped as-is; verify they are correct.
                        </p>
                        <ul>
                          {zipInspection.weakPinPorts.map((portName) => (
                            <li key={portName} data-testid={`ide-import-weak-pin-${portName}`}>{portName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {zipInspection?.reconstructionLevel === 'ports-only' && (
                      <div
                        className="ide-import-recon-callout ide-import-recon-callout--partial"
                        data-testid="ide-import-recon-partial"
                      >
                        <strong>Behavioural HDL detected</strong>
                        <p>
                          This module uses process/always blocks. RedByte extracted I/O ports only — gates were
                          not reconstructed. The project will have the correct I/O mapping but an empty circuit.
                          You can wire the circuit manually in Design mode.
                        </p>
                      </div>
                    )}
                    {zipInspection?.reconstructionLevel === 'full' && (
                      <div
                        className="ide-import-recon-callout ide-import-recon-callout--full"
                        data-testid="ide-import-recon-full"
                      >
                        <strong>Structural HDL detected</strong>
                        <p>Circuit reconstructed with gates and connections.</p>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            )}
          </section>

          <section className="ide-import-stage-col" data-testid="ide-import-diagnostics-panel">
            <IdeSectionHeader title="Diagnostics + Preview" meta="Stage 2/3" />
            {!hasParsedHdl && !hdlText.trim() && (
              <IdeCallout tone="info" title="Paste HDL to begin" testId="ide-import-empty-state">
                Paste a VHDL entity or Verilog module in the editor, then click{' '}
                <strong>Parse HDL</strong> — or upload a Vivado project ZIP to auto-extract.
              </IdeCallout>
            )}
            {!hasParsedHdl && hdlText.trim().length > 0 && (
              <IdeCallout tone="warn" title="HDL detected — not yet parsed" testId="ide-import-needs-parse">
                Your HDL is ready. Click <strong>Parse HDL</strong> above to analyse ports and
                reconstruct the circuit.
              </IdeCallout>
            )}
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Parsed Entity</span>
                <code data-testid="ide-import-entity-name">{parsedEntityName}</code>
              </div>
              <div className="ide-kv-row">
                <span>Status</span>
                <span>{statusMessage}</span>
              </div>
              <div className="ide-kv-row">
                <span>Copy</span>
                <span>{copyFeedback === 'idle' ? 'idle' : copyFeedback === 'copied' ? 'copied' : 'failed'}</span>
              </div>
            </div>

            <section className="ide-export-section" data-testid="ide-import-ports-table">
              <IdeSectionHeader title="Ports Table" meta={`${ports.length} ports`} />
              <IdeDataTable
                columns={['Port', 'Direction', 'Width', 'Mapped Pin', 'Status']}
                rows={portRows}
              />
            </section>

            {hasParsedHdl && (hasParsedXdc || unmappedPorts.length > 0) && (
              <section
                className="ide-import-xdc-coverage"
                data-testid="ide-import-xdc-coverage"
              >
                <header className="ide-export-section-header">
                  <h3>XDC Coverage</h3>
                  <span className="ide-export-section-meta">
                    {parsedHdl!.ports.length - unmappedPorts.length}/{parsedHdl!.ports.length} constrained
                  </span>
                </header>

                {unmappedPorts.length > 0 && (
                  <div className="ide-import-xdc-gaps" data-testid="ide-import-unmapped-list">
                    {unmappedPorts.map((port) => (
                      <div key={port.name} className="ide-import-xdc-gap-row ide-import-xdc-gap-row--unmapped">
                        <IdeStatusPill tone="warn">UNMAPPED</IdeStatusPill>
                        <code className="ide-import-xdc-gap-port">{port.name}</code>
                        <span className="ide-import-xdc-gap-dir">{port.direction.toUpperCase()}</span>
                        <span className="ide-import-xdc-gap-hint">No XDC constraint found</span>
                      </div>
                    ))}
                  </div>
                )}

                {orphanXdcKeys.length > 0 && (
                  <div className="ide-import-xdc-orphans" data-testid="ide-import-orphan-list">
                    {orphanXdcKeys.map((key) => (
                      <div key={key} className="ide-import-xdc-gap-row ide-import-xdc-gap-row--orphan">
                        <IdeStatusPill tone="warn">ORPHAN</IdeStatusPill>
                        <code className="ide-import-xdc-gap-port">{key}</code>
                        <span className="ide-import-xdc-gap-dir">→ {xdcResult!.pinMap[key]}</span>
                        {xdcResult!.pinEntries[key]?.line != null ? (
                          <button
                            type="button"
                            className="ide-warning-jump"
                            onClick={() => { setTab('xdc'); scrollToXdcLine(xdcResult!.pinEntries[key]!.line!); }}
                            title={`Jump to XDC line ${xdcResult!.pinEntries[key]!.line}`}
                            data-testid={`ide-import-xdc-jump-${key}`}
                          >
                            Ln {xdcResult!.pinEntries[key]!.line}
                          </button>
                        ) : (
                          <span className="ide-import-xdc-gap-hint">In XDC but not in HDL</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {unmappedPorts.length === 0 && orphanXdcKeys.length === 0 && (
                  <p className="ide-copy" style={{ margin: 0, fontSize: 11, color: 'var(--ide-text-muted)' }}>
                    All HDL ports are constrained. No orphan XDC keys.
                  </p>
                )}
              </section>
            )}

            <section className="ide-export-section" data-testid="ide-import-unmapped-list">
              <IdeSectionHeader title="Unmapped Ports" meta={`${unmappedPorts.length} remaining`} />
              {unmappedPorts.length > 0 ? (
                <div className="ide-import-unmapped-rows">
                  {unmappedPorts.map((port) => (
                    <div key={port.name} className="ide-import-unmapped-row" data-testid={`ide-import-unmapped-row-${port.name}`}>
                      <span className="ide-import-unmapped-port-name">{port.name}</span>
                      <select
                        className="ide-import-unmapped-pin-select"
                        data-testid={`ide-import-unmapped-pin-select-${port.name}`}
                        value={mapping[port.name] ?? ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [port.name]: e.target.value }))}
                      >
                        <option value="">— map to pin —</option>
                        {BASYS3_QUICK_PINS.map((pin) => (
                          <option key={pin} value={pin}>{pin}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : hasParsedHdl ? (
                <IdeCallout tone="success" title="All required ports mapped">
                  Required ports are fully mapped and ready for import.
                </IdeCallout>
              ) : null}
            </section>

            <section className="ide-export-section" data-testid="ide-import-warnings">
              <IdeSectionHeader title="Warnings" meta={`${warnings.length} warnings`} />
              {warnings.length > 0 ? (
                <IdeCallout tone="warn" title="Vivado directives ignored">
                  <ul className="ide-list">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </IdeCallout>
              ) : hasParsedHdl ? (
                <IdeCallout tone="info" title="No warnings">No parser warnings detected yet.</IdeCallout>
              ) : null}
            </section>

            <section className="ide-export-section" data-testid="ide-import-errors">
              <IdeSectionHeader title="Blocking Errors" meta={`${blockingErrors.length} blockers`} />
              {blockingErrors.length > 0 ? (
                <IdeCallout tone="error" title="Import blocked">
                  <ul className="ide-list">
                    {blockingErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </IdeCallout>
              ) : hasParsedHdl ? (
                <IdeCallout tone="success" title="No blocking errors">
                  Import can proceed once you click "Import to Project."
                </IdeCallout>
              ) : null}
            </section>

            <section className="ide-export-section">
              <IdeSectionHeader title="Preview Schematic" meta="v1 preview" />
              <div data-testid="ide-import-schematic-preview">
                {parsedHdl ? (
                  <ImportSchematicPreview parsedHdl={parsedHdl} mapping={mapping} />
                ) : (
                  <p className="ide-copy" style={{ color: 'var(--ide-text-muted)', fontSize: 11 }}>
                    Parse HDL to see a port preview.
                  </p>
                )}
              </div>
            </section>
          </section>
        </IdeGrid>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

// ─── Schematic preview ────────────────────────────────────────────────────────

interface ImportSchematicPreviewProps {
  parsedHdl: ParsedHDL;
  mapping: Record<string, string>;
}

function ImportSchematicPreview({ parsedHdl, mapping }: ImportSchematicPreviewProps) {
  const inPorts = parsedHdl.ports.filter((p) => p.direction === 'in');
  const outPorts = parsedHdl.ports.filter((p) => p.direction === 'out');
  const maxRows = Math.max(inPorts.length, outPorts.length, 1);

  return (
    <div className="ide-import-schematic-preview-wrap" data-testid="ide-import-schematic-preview-inner">
      <div className="ide-import-schematic-entity-header">
        {parsedHdl.lang.toUpperCase()} · {parsedHdl.entityName}
      </div>
      <div className="ide-import-schematic-io-columns" style={{ minHeight: Math.max(maxRows * 20, 60) }}>
        {/* Input ports */}
        <div className="ide-import-schematic-in-col">
          {inPorts.map((port) => {
            const pin = (mapping[port.name] ?? '').trim();
            return (
              <div key={port.name} className="ide-import-schematic-port-row">
                <div className={`ide-import-schematic-port-dot${pin ? ' has-pin' : ''}`} title={pin || 'unmapped'} />
                <span className="ide-import-schematic-port-name">{port.name}</span>
                {pin && <span className="ide-import-schematic-port-pin">{pin}</span>}
              </div>
            );
          })}
        </div>

        {/* Entity box */}
        <div className="ide-import-schematic-entity-box">
          <span className="ide-import-schematic-entity-name">{parsedHdl.entityName}</span>
        </div>

        {/* Output ports */}
        <div className="ide-import-schematic-out-col">
          {outPorts.map((port) => {
            const pin = (mapping[port.name] ?? '').trim();
            return (
              <div key={port.name} className="ide-import-schematic-port-row">
                <div className={`ide-import-schematic-port-dot${pin ? ' has-pin' : ''}`} title={pin || 'unmapped'} />
                <span className="ide-import-schematic-port-name">{port.name}</span>
                {pin && <span className="ide-import-schematic-port-pin">{pin}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {parsedHdl.instances && parsedHdl.instances.length > 0 && (
        <div className="ide-import-schematic-instance-list">
          {parsedHdl.instances.slice(0, 12).map((inst) => (
            <span
              key={inst.id}
              className="ide-import-schematic-instance-chip"
              title={inst.componentType}
            >
              {inst.componentType}
            </span>
          ))}
          {parsedHdl.instances.length > 12 && (
            <span className="ide-import-schematic-instance-chip">
              +{parsedHdl.instances.length - 12}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function detectHdlLanguage(source: string): 'vhdl' | 'verilog' {
  const lowered = source.toLowerCase();
  if (lowered.includes('entity') && lowered.includes('architecture')) return 'vhdl';
  if (lowered.includes('module') && lowered.includes('endmodule')) return 'verilog';
  return lowered.includes('entity') ? 'vhdl' : 'verilog';
}

function inferPortWidth(typeName: string): string {
  const normalized = typeName.trim().toLowerCase();
  // Verilog: logic [7:0], wire [3:0]
  const verilogMatch = normalized.match(/\[(\d+)\s*:\s*(\d+)\]/);
  if (verilogMatch) {
    return String(Math.abs(Number(verilogMatch[1]) - Number(verilogMatch[2])) + 1);
  }
  // VHDL: std_logic_vector(N downto 0) or (N-1 downto 0)
  const vhdlDownto = normalized.match(/\((\d+)\s+downto\s+(\d+)\)/);
  if (vhdlDownto) {
    return String(Math.abs(Number(vhdlDownto[1]) - Number(vhdlDownto[2])) + 1);
  }
  // VHDL: std_logic_vector(0 to N)
  const vhdlTo = normalized.match(/\((\d+)\s+to\s+(\d+)\)/);
  if (vhdlTo) {
    return String(Math.abs(Number(vhdlTo[1]) - Number(vhdlTo[2])) + 1);
  }
  // Catch-all for vector types without extracted width
  if (normalized.includes('vector') || normalized.includes('logic') ||
      normalized.includes('bit_vector')) return 'bus';
  return '1';
}

function suggestBasys3Alias(
  rawName: string,
  direction: 'in' | 'out'
): { pin: string; note?: string } | null {
  const name = rawName.trim().toLowerCase();
  if (name.length === 0) return null;

  if (name === 'clk' || name === 'clock' || name === 'clk100mhz') {
    return { pin: 'CLK100MHZ' };
  }
  if (name === 'rst' || name === 'reset') {
    return { pin: 'BTNC', note: 'Reset button suggestion only; adjust per lab requirements.' };
  }

  const switchMatch = name.match(/^sw(\d{1,2})$/);
  if (switchMatch && direction === 'in') {
    const index = Number(switchMatch[1]);
    if (index >= 0 && index <= 15) return { pin: `SW${index}` };
  }

  const ledMatch = name.match(/^led(\d{1,2})$/);
  if (ledMatch && direction === 'out') {
    const index = Number(ledMatch[1]);
    if (index >= 0 && index <= 15) return { pin: `LD${index}` };
  }

  const buttonMatch = name.match(/^btn([cudlr])$/);
  if (buttonMatch && direction === 'in') {
    return { pin: `BTN${buttonMatch[1].toUpperCase()}` };
  }

  return null;
}

function buildDiagnosticsReport(params: {
  parsedEntityName: string;
  ports: ParsedHDL['ports'];
  mapping: Record<string, string>;
  warnings: string[];
  blockingErrors: string[];
}): string {
  const { parsedEntityName, ports, mapping, warnings, blockingErrors } = params;
  const lines: string[] = [];
  lines.push('RedByte Import Diagnostics');
  lines.push(`Entity: ${parsedEntityName}`);
  lines.push('');
  lines.push('Ports:');
  for (const port of ports) {
    const pin = (mapping[port.name] ?? '').trim();
    lines.push(
      `- ${port.name} (${port.direction}, ${inferPortWidth(port.typeName)}) => ${pin.length > 0 ? pin : 'UNMAPPED'}`
    );
  }
  lines.push('');
  lines.push('Blocking Errors:');
  if (blockingErrors.length === 0) {
    lines.push('- none');
  } else {
    for (const error of blockingErrors) lines.push(`- ${error}`);
  }
  lines.push('');
  lines.push('Warnings:');
  if (warnings.length === 0) {
    lines.push('- none');
  } else {
    for (const warning of warnings) lines.push(`- ${warning}`);
  }
  return lines.join('\n');
}

function buildMappingRecord(project: RBProject): Record<string, string> {
  const rows = [
    ...(project.ioMapping?.inputs ?? []),
    ...(project.ioMapping?.outputs ?? []),
  ];
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const key = (row.label ?? row.id).trim() || row.id;
    mapping[key] = (row.pin ?? '').toUpperCase();
  }
  return mapping;
}

/**
 * Generates minimal baseline test vectors from the circuit's INPUT nodes.
 * Patterns: all-zeros (tick 0), one-hot per input (ticks 1..N), all-ones (tick N+1).
 * Expected outputs are set to 0 — the student fills them in after running verify.
 */
function generateBaselineVectors(project: RBProject): Array<{
  tick: number;
  inputs: Record<string, number>;
  expected: Record<string, number>;
}> {
  const inputNodes = (project.circuit.nodes ?? []).filter((n) => n.type === 'INPUT');
  const outputNodes = (project.circuit.nodes ?? []).filter((n) => n.type === 'OUTPUT');
  if (inputNodes.length === 0) return [];

  const emptyExpected = Object.fromEntries(outputNodes.map((n) => [n.id, 0]));

  const vectors: Array<{ tick: number; inputs: Record<string, number>; expected: Record<string, number> }> = [];

  // Tick 0: all inputs = 0
  vectors.push({
    tick: 0,
    inputs: Object.fromEntries(inputNodes.map((n) => [n.id, 0])),
    expected: { ...emptyExpected },
  });

  // Ticks 1..N: one-hot inputs
  inputNodes.forEach((inNode, i) => {
    vectors.push({
      tick: i + 1,
      inputs: Object.fromEntries(inputNodes.map((n) => [n.id, n.id === inNode.id ? 1 : 0])),
      expected: { ...emptyExpected },
    });
  });

  // Final tick: all inputs = 1
  vectors.push({
    tick: inputNodes.length + 1,
    inputs: Object.fromEntries(inputNodes.map((n) => [n.id, 1])),
    expected: { ...emptyExpected },
  });

  return vectors;
}
