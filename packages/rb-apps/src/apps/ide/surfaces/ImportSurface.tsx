import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseVhdl, scanVhdlEntities } from '../../../import/vhdlImport';
import { parseVerilog, scanVerilogModules } from '../../../import/verilogImport';
import { parseXdcPins, type XdcParseResult } from '../../../import/xdcImport';
import type { ParsedHDL, ReconstructionLevel } from '../../../import/hdlToCircuit';
import type { ParsedHdlWarning } from '../../../import/hdlToCircuit';
import {
  buildImportedProjectCompilerResult,
  deriveProjectCompilerResult,
  type ImportedProjectCompilerResult,
} from '../../../import/importCompiler';
import type { RBProject } from '../../../export/projectFormat';
import * as submissionImport from '../../../export/parseIdeSubmission';
import {
  type ParsedIdeSubmission,
} from '../../../export/parseIdeSubmission';
import type { IdeExampleIoRow } from '../examplesCatalog';
import { unifyImportDiagnostics } from '../diagnostics';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  importVivadoZipBytes,
  importVivadoZipFile,
  reimportZipWithCandidates,
  type ZipImportInspection,
} from '../zipImport';
import { getZipImportAuthorityModel } from '../importSurfaceZipAuthority';
import {
  buildZipInspectionMappingRecord,
  isCanonicalImportPortIdentity,
} from '../importPortIdentity';
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
import { SurfaceCommandStrip, SurfacePanel } from '../components/SurfaceLayoutPrimitives';
import type { IdeChromeContract } from '../chromeContract';
import { PROFESSIONAL_CLASSROOM_COPY } from '../productUiStandards';
import type { GuidedLabTaskDefinition } from '../labTaskDefinition';
import './import-recovery-workspace-v3.css';

export const CHROME_CONTRACT = {
  surfaceId: 'import',
  topStripSlots: ['command-bar'],
  leftDockPolicy: 'always',
  rightDockPolicy: 'collapsed-default',
  exitPaths: [],
} satisfies IdeChromeContract;

type ImportTab = 'hdl' | 'xdc' | 'upload';
type HdlLanguage = 'auto' | 'vhdl' | 'verilog';

export interface ImportSurfaceProps {
  onImportProject?: (project: RBProject) => void;
  onImportCommitted?: (meta: {
    fidelity: 'full' | 'reconstructed' | 'partial';
    importMode: 'manifest' | 'reconstructed';
    reconstructionLevel: ReconstructionLevel;
    sourceName: string;
  }) => void;
  onImportSubmission?: (submission: ParsedIdeSubmission) => void;
  projectIoRows?: IdeExampleIoRow[];
  onApplySuggestions?: (items: Array<{ rowId: string; pin: string }>) => void;
  onGoToProject?: () => void;
  onGoToDesign?: () => void;
  onGoToVerify?: () => void;
  onGoToExport?: () => void;
  activeGuidedLabTask?: GuidedLabTaskDefinition | null;
}

function ImportZipAuthorityCallout({ zi }: { zi: ZipImportInspection }) {
  const m = getZipImportAuthorityModel(zi);
  return (
    <IdeCallout tone={m.tone} title={m.title} testId="ide-import-zip-authority">
      <p className="ide-copy" style={{ margin: '0 0 var(--ide-space-1)' }}>
        {m.classroom}
      </p>
      <ul className="ide-bullets" style={{ margin: 0, paddingLeft: '1.1em' }}>
        {m.facts.map((f, idx) => (
          <li key={`${f.k}-${idx}`}>{f.text}</li>
        ))}
      </ul>
    </IdeCallout>
  );
}

function formatZipImportErrorMessage(error: string): string {
  const message = error.trim();
  if (/requires a \.zip archive/i.test(message)) {
    return 'No files were changed. ZIP import requires a .zip archive. Choose a RedByte or Vivado ZIP, re-export from Vivado, or use Paste HDL for source-only recovery.';
  }
  if (/central directory|not a zip|zip is empty|could not read|failed to read|corrupted or unsupported/i.test(message)) {
    return 'No files were changed. The archive could not be read as a RedByte or Vivado ZIP. Try a fresh RedByte export ZIP, re-export from Vivado, or use Paste HDL for source-only recovery.';
  }
  if (/contains no readable project files/i.test(message)) {
    return 'No files were changed. This ZIP does not contain a RedByte project manifest or readable HDL/XDC sources. Try another export ZIP or use Paste HDL for source-only recovery.';
  }
  if (/no .*(hdl|vhd|verilog|\.v\b)|No HDL source found/i.test(message)) {
    return 'No VHDL or Verilog file was found in this ZIP. Make sure your Vivado export includes a top-level .vhd or .v source.';
  }
  if (/entity/i.test(message)) {
    return 'Could not find a top-level entity in your HDL. Verify your file defines an entity block with a port list.';
  }
  if (/\b(port|ports)\b|xdc|package_pin|loc constraint/i.test(message)) {
    return 'The ZIP opened, but RedByte could not pair HDL ports with XDC constraints. Check that the XDC uses valid LOC/PACKAGE_PIN constraints and that the HDL declares matching top-level ports.';
  }
  return 'No files were changed. The ZIP could not be read. Try a RedByte export ZIP with project.rbproj.json, re-export from Vivado, or use Paste HDL for source-only recovery.';
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

/**
 * Strips VHDL and Verilog comments from HDL source so comment text does not
 * trigger false-positive behavioral construct detection.
 *   VHDL:    -- line comment
 *   Verilog: // line comment  and  block comments (slash-star ... star-slash)
 */
function stripHdlComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // Verilog block comments
    .replace(/\/\/[^\n]*/g, '')          // Verilog line comments
    .replace(/--[^\n]*/g, '');           // VHDL line comments
}

/** Scans HDL source text for behavioral/sequential constructs that RedByte cannot import. */
function scanBehavioralConstructs(source: string): string[] {
  const stripped = stripHdlComments(source);
  const found: string[] = [];
  if (/\bprocess\b/i.test(stripped)) found.push('process (VHDL sequential)');
  if (/\balways\b/i.test(stripped)) found.push('always (Verilog behavioral)');
  if (/\binitial\b/i.test(stripped)) found.push('initial (Verilog test-bench/sequential init)');
  if (/\brising_edge\b/i.test(stripped)) found.push('rising_edge (clocked logic)');
  if (/\bposedge\b/i.test(stripped)) found.push('posedge (clock edge sensitivity)');
  if (/\bnegedge\b/i.test(stripped)) found.push('negedge (clock edge sensitivity)');
  if (/\bgenerate\b/i.test(stripped)) found.push('generate (structural generate — unsupported)');
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
type ImportWorkflowStepId = 'upload' | 'review' | 'apply';
type ImportWorkflowStepState = 'pending' | 'active' | 'done' | 'blocked';

interface ImportPipelineStep {
  id: ImportPipelineStepId;
  label: string;
  state: ImportPipelineStepState;
  detail?: string;
}

interface ImportWorkflowStep {
  id: ImportWorkflowStepId;
  order: number;
  label: string;
  state: ImportWorkflowStepState;
  detail: string;
}

interface ImportBoardDetection {
  board: string;
  confidence: 'High' | 'Medium' | 'Low';
  reason: string;
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

function isImportTab(value: unknown): value is ImportTab {
  return value === 'hdl' || value === 'xdc' || value === 'upload';
}

function readImportUiState(): { tab?: ImportTab; firstLookDismissed?: boolean } {
  if (typeof window === 'undefined') return {};
  try {
    const url = new URL(window.location.href);
    const sourceFromUrl = url.searchParams.get('importSource');
    const urlTab = isImportTab(sourceFromUrl) ? sourceFromUrl : undefined;
    const urlActive = url.searchParams.get('importActive') === '1';
    if (urlTab || urlActive) {
      return {
        tab: urlTab,
        firstLookDismissed: urlActive || Boolean(urlTab),
      };
    }
    return {};
  } catch {
    return {};
  }
}

export const ImportSurface: React.FC<ImportSurfaceProps> = ({
  onImportProject,
  onImportCommitted,
  onImportSubmission,
  projectIoRows,
  onApplySuggestions,
  onGoToProject,
  onGoToDesign,
  onGoToVerify,
  onGoToExport,
  activeGuidedLabTask,
}) => {
  const [tab, setTab] = useState<ImportTab>(() => readImportUiState().tab ?? 'upload');
  const [language, setLanguage] = useState<HdlLanguage>('auto');
  const [hdlText, setHdlText] = useState('');
  const [xdcText, setXdcText] = useState('');
  const [parsedHdl, setParsedHdl] = useState<ParsedHDL | null>(null);
  const [xdcResult, setXdcResult] = useState<XdcParseResult | null>(null);
  const [zipInspection, setZipInspection] = useState<ZipImportInspection | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [pendingApplyImportResult, setPendingApplyImportResult] = useState<ImportedProjectCompilerResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string>(
    'Start with a RedByte project ZIP when available; Vivado ZIPs and raw HDL use recovery review before replacing your project.'
  );
  const [zipImportError, setZipImportError] = useState<string>('');
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const zipInputRef = useRef<HTMLInputElement | null>(null);
  const zipFileRef = useRef<File | null>(null);
  const [selectedZipHdl, setSelectedZipHdl] = useState<string | null>(null);
  const [selectedZipXdc, setSelectedZipXdc] = useState<string | null>(null);
  const hdlTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hdlGutterRef = useRef<HTMLDivElement | null>(null);
  const hdlEditorActionsRef = useRef<HTMLDivElement | null>(null);
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
  const [showVerifyResetNotice, setShowVerifyResetNotice] = useState(false);
  const [submissionDetectedMessage, setSubmissionDetectedMessage] = useState<string>('');
  const [submissionIntegrityMessage, setSubmissionIntegrityMessage] = useState<string>('');
  const [importFirstLookDismissed, setImportFirstLookDismissed] = useState(
    () => readImportUiState().firstLookDismissed ?? false
  );
  const mappingSectionRef = useRef<HTMLElement | null>(null);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const applySectionRef = useRef<HTMLDivElement | null>(null);
  const pendingApplyProject = pendingApplyImportResult?.project ?? null;

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

  const parseHdl = useCallback((sourceOverride?: unknown) => {
    const source = (typeof sourceOverride === 'string' ? sourceOverride : hdlText).trim();
    if (!source) {
      setStatusMessage('Paste HDL before parsing.');
      return null;
    }
    try {
      setZipInspection(null);
      setPendingApplyImportResult(null);
      setShowVerifyResetNotice(false);
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
      return parsed;
    } catch (error) {
      setParsedHdl(null);
      setStatusMessage(`HDL parse failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return null;
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

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const nextAction = hdlEditorActionsRef.current?.querySelector<HTMLButtonElement>(
          'button:not([disabled])'
        );
        nextAction?.focus();
        setStatusMessage('Left the HDL editor. Continue with Parse HDL or another import action.');
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
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (importFirstLookDismissed) {
        url.searchParams.set('importActive', '1');
        url.searchParams.set('importSource', tab);
      } else {
        url.searchParams.delete('importActive');
        url.searchParams.delete('importSource');
      }
      if (url.href !== window.location.href) {
        window.history.replaceState(window.history.state, '', url);
      }
    } catch {
      // UI continuity is best-effort and must not block import behavior.
    }
  }, [importFirstLookDismissed, tab]);

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
        .filter((port) => !isCanonicalImportPortIdentity(port.name))
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

  const previewImportResult = useMemo((): ImportedProjectCompilerResult | null => {
    if (!parsedHdl) return null;

    if (zipInspection?.importMode === 'manifest') {
      return deriveProjectCompilerResult(zipInspection.project, {
        parsedHdl,
        parseStatus: zipInspection.status.parse,
        parserDiagnostics: zipInspection.parserDiagnostics,
        reconstructionLevel: zipInspection.reconstructionLevel,
      });
    }

    const sourceName =
      zipInspection?.sourceName ??
      `${parsedHdl.entityName.trim() || 'imported-design'}.${parsedHdl.lang === 'vhdl' ? 'vhd' : 'v'}`;
    const topPath =
      zipInspection?.detectedTopPath ?? `top.${parsedHdl.lang === 'vhdl' ? 'vhd' : 'v'}`;
    const topText = hdlText.trim();
    const normalizedXdcText = xdcText.trim();
    const userPins = Object.fromEntries(
      Object.entries(mapping).filter(([, pin]) => pin.trim().length > 0)
    );
    const mergedXdcResult: XdcParseResult | undefined =
      xdcResult
        ? { ...xdcResult, pinMap: { ...xdcResult.pinMap, ...userPins } }
        : Object.keys(userPins).length > 0
          ? { pinMap: userPins, pinEntries: {}, warnings: [] }
          : undefined;

    return buildImportedProjectCompilerResult({
      sourceName,
      topPath,
      topText,
      parsedHdl,
      xdcPath: zipInspection?.detectedXdcPath ?? (normalizedXdcText ? 'top.xdc' : undefined),
      xdcText: normalizedXdcText.length > 0 ? normalizedXdcText : undefined,
      xdcResult: mergedXdcResult,
      parserDiagnostics: zipInspection?.parserDiagnostics ?? [],
    });
  }, [parsedHdl, zipInspection, hdlText, xdcText, xdcResult, mapping]);

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
    const warningRows = new Set<string>();
    for (const diagnostic of previewImportResult?.parserDiagnostics ?? zipInspection?.parserDiagnostics ?? []) {
      warningRows.add(diagnostic.message);
    }
    if (zipInspection?.warnings?.length) {
      for (const warning of zipInspection.warnings) warningRows.add(warning);
    }
    if (warningRows.size === 0) {
      if (parsedHdl?.warnings?.length) {
        for (const warning of parsedHdl.warnings) warningRows.add(warning.message);
      }
      if (xdcResult?.warnings?.length) {
        for (const warning of xdcResult.warnings) warningRows.add(warning);
      }
    }
    return Array.from(warningRows);
  }, [parsedHdl, previewImportResult, xdcResult, zipInspection]);
  const unifiedImportDiagnostics = useMemo(
    () => unifyImportDiagnostics(
      previewImportResult?.parserDiagnostics ??
        zipInspection?.parserDiagnostics ??
        [],
      pendingApplyImportResult?.compilerDiagnostics ??
        previewImportResult?.compilerDiagnostics ??
        zipInspection?.compilerDiagnostics ??
        []
    ),
    [
      pendingApplyImportResult?.compilerDiagnostics,
      previewImportResult?.compilerDiagnostics,
      previewImportResult?.parserDiagnostics,
      zipInspection?.compilerDiagnostics,
      zipInspection?.parserDiagnostics,
    ]
  );

  const hasParsedHdl = parsedHdl !== null;
  const hdlLooksValid =
    hasParsedHdl && parsedHdl?.entityName !== 'unknown' && (parsedHdl?.ports.length ?? 0) > 0;
  const hdlParseWarnings = parsedHdl?.warnings ?? [];
  const hdlWarningCount = hdlParseWarnings.length;
  const hasParsedXdc = xdcResult !== null;
  const hasZipInspection = zipInspection !== null;
  const isManifestZipImport = zipInspection?.importMode === 'manifest';
  const canApplySuggestions = useMemo(
    () => unmappedPorts.some((port) => Boolean(suggestBasys3Alias(port.name, port.direction))),
    [unmappedPorts]
  );
  const canImport = hasParsedHdl && blockingErrors.length === 0;
  const activeImportStatus =
    pendingApplyImportResult?.status ?? previewImportResult?.status ?? zipInspection?.status ?? null;
  const parseStatusLabel =
    !hasParsedHdl && !hasZipInspection
      ? 'pending'
      : activeImportStatus?.parse === 'failure'
        ? 'failed'
        : activeImportStatus?.parse === 'success'
          ? 'ok'
          : 'pending';
  const reconstructionStatusLabel =
    activeImportStatus?.reconstruction === 'success'
      ? 'full'
      : activeImportStatus?.reconstruction === 'partial'
        ? 'partial'
        : activeImportStatus?.reconstruction === 'failure'
          ? 'failed'
          : 'pending';
  const compilerStatusLabel =
    activeImportStatus?.compiler === 'blocked'
      ? 'blocked'
      : activeImportStatus?.compiler === 'runnable'
        ? 'runnable'
        : 'pending';

  // ── STOP-SHIP: Behavioral construct pre-scan ───────────────────────────────
  // Detect process/always/rising_edge BEFORE the commit is applied.
  // These constructs are dropped silently; we must block the commit, not warn.
  const detectedBehavioralConstructs = useMemo(
    // Manifest HDL is preview/reference evidence; the decoded project is the
    // restored authority and is not rebuilt through the HDL parser.
    () => (isManifestZipImport || !hdlText.trim() ? [] : scanBehavioralConstructs(hdlText)),
    [hdlText, isManifestZipImport]
  );

  // Compute reconstruction level for paste imports (where there's no zipInspection).
  const effectiveReconstructionLevel = useMemo((): ReconstructionLevel => {
    if (previewImportResult?.reconstructionLevel) return previewImportResult.reconstructionLevel;
    if (zipInspection?.reconstructionLevel) return zipInspection.reconstructionLevel;
    return computeReconstructionLevelFromParsed(parsedHdl);
  }, [previewImportResult, zipInspection, parsedHdl]);

  // Block commit when behavioral constructs detected or no gates were reconstructed.
  // STOP-SHIP item 1: No silent dropping. STOP-SHIP item 5: No fake success.
  const importBlockerReasons = useMemo((): string[] => {
    if (!pendingApplyImportResult) return [];
    const reasons: string[] = [];
    if (detectedBehavioralConstructs.length > 0) {
      reasons.push(
        `This design uses behavioral/sequential HDL constructs that RedByte cannot import: ${detectedBehavioralConstructs.join(', ')}.`
      );
    }
    if (effectiveReconstructionLevel === 'empty') {
      reasons.push('No circuit was reconstructed — the schematic is empty. Check entity/module syntax.');
    } else if (effectiveReconstructionLevel === 'ports-only') {
      reasons.push('Only the port names were saved — no internal logic was captured. Switch to Build and wire the gates manually, or re-import from a full RedByte project export.');
    }
    for (const diagnostic of pendingApplyImportResult.compilerDiagnostics) {
      if (diagnostic.severity !== 'error') continue;
      reasons.push(`${diagnostic.code}: ${diagnostic.message}`);
    }
    return reasons;
  }, [pendingApplyImportResult, detectedBehavioralConstructs, effectiveReconstructionLevel]);

  const hasImportBlocker = importBlockerReasons.length > 0;

  const commitPreview = useMemo(() => {
    if (!pendingApplyProject || !parsedHdl) return null;
    const inPorts = parsedHdl.ports.filter((p) => p.direction === 'in');
    const outPorts = parsedHdl.ports.filter((p) => p.direction === 'out');
    const mappedCount = parsedHdl.ports.filter((p) => (mapping[p.name] ?? '').trim()).length;
    const reconstructionLevel = effectiveReconstructionLevel;

    // diff vs current project
    // `port` is the circuit-node connector (usually "in"/"out"), not the
    // student-facing top-level signal name. Destructive import summaries must
    // identify the signals that will actually be replaced.
    const currentPortNames = new Set((projectIoRows ?? []).map((r) => (r.label ?? r.id ?? r.port ?? '').toLowerCase()));
    const incomingPortNames = new Set(parsedHdl.ports.map((p) => p.name.toLowerCase()));
    const addedPorts = parsedHdl.ports.filter((p) => !currentPortNames.has(p.name.toLowerCase()));
    const removedPortNames = (projectIoRows ?? [])
      .filter((r) => {
        const key = (r.label ?? r.id ?? r.port ?? '').toLowerCase();
        return key.length > 0 && !incomingPortNames.has(key);
      })
      .map((r) => r.label ?? r.id ?? r.port);

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

  const boardDetection = useMemo(
    () => detectImportBoard({ xdcResult, zipInspection }),
    [xdcResult, zipInspection]
  );
  const inputCount = useMemo(
    () => ports.filter((port) => port.direction === 'in').length,
    [ports]
  );
  const outputCount = useMemo(
    () => ports.filter((port) => port.direction === 'out').length,
    [ports]
  );
  const mappedPortCount = useMemo(
    () => ports.filter((port) => (mapping[port.name] ?? '').trim().length > 0).length,
    [mapping, ports]
  );
  const reviewModeLabel = isManifestZipImport
    ? 'Manifest restore'
    : effectiveReconstructionLevel === 'full'
      ? 'Structural reconstruction'
      : effectiveReconstructionLevel === 'ports-only'
        ? 'Ports only — no circuit'
        : 'No reconstruction';
  const currentWorkflowStepId = useMemo<ImportWorkflowStepId>(() => {
    if (showVerifyResetNotice) return 'apply';
    if (pendingApplyProject) return 'apply';
    if (hasZipInspection || hasParsedHdl || hdlText.trim().length > 0 || importFirstLookDismissed) return 'review';
    return 'upload';
  }, [
    hasParsedHdl,
    hasZipInspection,
    hdlText,
    importFirstLookDismissed,
    pendingApplyProject,
    showVerifyResetNotice,
  ]);
  const workflowSteps = useMemo<ImportWorkflowStep[]>(
    () => [
      {
        id: 'upload',
        order: 1,
        label: 'Upload',
        state:
          hasZipInspection || hasParsedHdl || hdlText.trim().length > 0
            ? 'done'
            : currentWorkflowStepId === 'upload'
              ? 'active'
              : 'pending',
        detail: hasZipInspection
          ? 'ZIP loaded'
          : hdlText.trim().length > 0
            ? 'HDL source selected'
            : 'Choose a ZIP or paste HDL',
      },
      {
        id: 'review',
        order: 2,
        label: 'Review',
        state:
          pendingApplyProject || showVerifyResetNotice
            ? 'done'
            : !hasZipInspection && !hasParsedHdl && hdlText.trim().length === 0
            ? 'blocked'
            : currentWorkflowStepId === 'review'
              ? 'active'
              : 'pending',
        detail:
          !hasParsedHdl
            ? 'Parse source, inspect warnings, then map ports'
            : unmappedPorts.length > 0
              ? `${unmappedPorts.length} port${unmappedPorts.length === 1 ? '' : 's'} need review`
              : `Inspect ${reviewModeLabel.toLowerCase()}`,
      },
      {
        id: 'apply',
        order: 3,
        label: 'Apply',
        state:
          showVerifyResetNotice
            ? 'done'
            : pendingApplyProject
              ? 'active'
              : canImport && detectedBehavioralConstructs.length === 0
                ? 'pending'
                : 'blocked',
        detail:
          showVerifyResetNotice
            ? 'Project replaced; rerun Simulate'
            : pendingApplyProject
              ? 'Confirm project replacement'
              : detectedBehavioralConstructs.length > 0
                ? 'Review is available; replacement is blocked'
              : 'Review before replacing the active project',
      },
    ],
    [
      canImport,
      currentWorkflowStepId,
      detectedBehavioralConstructs.length,
      hasParsedHdl,
      hasZipInspection,
      hdlText,
      parsedEntityName,
      pendingApplyProject,
      reviewModeLabel,
      showVerifyResetNotice,
      unmappedPorts.length,
    ]
  );
  const workflowActiveLabel =
    workflowSteps.find((step) => step.id === currentWorkflowStepId)?.label ?? 'Upload';

  const portRows = useMemo(
    () =>
      ports.map((port) => {
        const mapped = (mapping[port.name] ?? '').trim();
        const suggestion = suggestBasys3Alias(port.name, port.direction);
        const xdcEntry = xdcResult?.pinEntries[port.name];
        const confidenceTone =
          xdcEntry?.confidence === 'strong'
            ? 'ok'
            : xdcEntry?.confidence === 'weak'
              ? 'warn'
              : suggestion
                ? 'warn'
                : mapped.length > 0
                  ? 'idle'
                  : 'warn';
        const confidenceLabel = xdcEntry
          ? xdcEntry.confidence === 'strong'
            ? 'High'
            : 'Low'
          : suggestion
            ? 'Medium'
            : mapped.length > 0
              ? 'Manual'
              : 'Pending';
        return [
          <div key={`${port.name}-name`} className="ide-import-port-flow">
            <code>{port.name}</code>
            <span className="ide-import-port-flow-arrow" aria-hidden="true">→</span>
          </div>,
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
          port.direction.toUpperCase(),
          inferPortWidth(port.typeName),
          <IdeStatusPill key={`${port.name}-confidence`} tone={confidenceTone}>
            {confidenceLabel}
          </IdeStatusPill>,
          <IdeStatusPill key={`${port.name}-status`} tone={mapped.length > 0 ? 'ok' : 'warn'}>
            {mapped.length > 0 ? 'Mapped' : 'Missing'}
          </IdeStatusPill>,
        ];
      }),
    [mapping, ports, xdcResult]
  );

  const parseXdc = (sourceOverride?: unknown, parsedHdlOverride?: ParsedHDL | null) => {
    const source = (typeof sourceOverride === 'string' ? sourceOverride : xdcText).trim();
    if (!source) {
      setStatusMessage('Paste XDC before parsing.');
      return;
    }
    try {
      setZipInspection(null);
      setPendingApplyImportResult(null);
      setShowVerifyResetNotice(false);
      const parsed = parseXdcPins(source);
      setXdcResult(parsed);
      setMapping((previous) => {
        const activeParsedHdl = parsedHdlOverride ?? parsedHdl;
        if (!activeParsedHdl) return previous;
        const next = { ...previous };
        for (const port of activeParsedHdl.ports) {
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

  const buildCurrentImportResult = useCallback(
    (): ImportedProjectCompilerResult | null => previewImportResult,
    [previewImportResult]
  );

  const finalizeImportResult = useCallback(
    (result: ImportedProjectCompilerResult): ImportedProjectCompilerResult => {
      if (zipInspection?.importMode === 'manifest') return result;
      if ((result.project.vectors?.length ?? 0) > 0) return result;
      const baselineVectors = generateBaselineVectors(result.project);
      if (baselineVectors.length === 0) return result;
      return {
        ...result,
        project: {
          ...result.project,
          vectors: baselineVectors,
        },
      };
    },
    [zipInspection]
  );

  const handleProcessDesign = useCallback(async () => {
    setPipelineActive(true);
    setPipelineSteps(makePipelineSteps());
    setPendingApplyImportResult(null);
    setShowVerifyResetNotice(false);
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
      const built = buildCurrentImportResult();
      if (!built) {
        markPipelineStep('build', 'error', 'buildCurrentImportResult returned null');
        setStatusMessage('Build failed.');
        setPipelineActive(false);
        return;
      }
      const finalized = finalizeImportResult(built);
      const baselineVectorCount = finalized.project.vectors?.length ?? 0;
      setPendingApplyImportResult(finalized);
      markPipelineStep(
        'build',
        'done',
        baselineVectorCount > 0
          ? `${finalized.project.circuit.nodes.length} nodes · ${baselineVectorCount} baseline vectors`
          : `${finalized.project.circuit.nodes.length} nodes · ${finalized.project.circuit.connections.length} connections`
      );
      setStatusMessage(
        finalized.isImportRunnable
          ? 'Design processed. Review commit preview below.'
          : 'Design processed, but the compiler blocked this import. Review diagnostics before replacing the project.'
      );
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
    markPipelineStep, buildCurrentImportResult, finalizeImportResult, selectedEntityName, detectedEntityNames,
  ]);

  const requestApplyProject = () => {
    if (!canImport) return;
    const nextImportResult = buildCurrentImportResult();
    if (!nextImportResult) return;
    setPendingApplyImportResult(finalizeImportResult(nextImportResult));
    setShowVerifyResetNotice(false);
    setStatusMessage('Confirm applying import to replace the active project.');
  };

  const confirmApplyProject = () => {
    if (!pendingApplyProject) return;
    onImportCommitted?.({
      fidelity:
        zipInspection?.importMode === 'manifest'
          ? 'full'
          : effectiveReconstructionLevel === 'full'
            ? 'reconstructed'
            : 'partial',
      importMode: zipInspection?.importMode ?? 'reconstructed',
      reconstructionLevel: effectiveReconstructionLevel,
      sourceName:
        zipInspection?.sourceName ??
        `${parsedHdl?.entityName.trim() || 'imported-design'}.${parsedHdl?.lang === 'verilog' ? 'v' : 'vhd'}`,
    });
    onImportProject?.(pendingApplyProject);
    setPendingApplyImportResult(null);
    setShowVerifyResetNotice(true);
    setStatusMessage(
      `RBProject ready: ${pendingApplyProject.circuit.nodes.length} nodes, ${pendingApplyProject.circuit.connections.length} connections.`
    );
  };

  const cancelApplyProject = () => {
    setPendingApplyImportResult(null);
    setShowVerifyResetNotice(false);
    setStatusMessage('Import apply canceled.');
  };

  const handleOpenZipPicker = () => {
    zipInputRef.current?.click();
  };
  const importEntryAction = useMemo(() => {
    if (pendingApplyProject) return null;
    if (!hasParsedHdl && !hdlText.trim() && !hasZipInspection) {
      if (importFirstLookDismissed && tab === 'hdl') {
        return {
          id: 'paste-hdl',
          title: 'Paste HDL',
          body:
            'Paste structural VHDL or Verilog into the editor, then parse it to build a recovery preview.',
          primaryLabel: 'Focus editor',
          primaryAction: () => hdlTextareaRef.current?.focus(),
          secondaryLabel: 'Select ZIP',
          secondaryAction: () => {
            setTab('upload');
            handleOpenZipPicker();
          },
        } as const;
      }
      return {
        id: 'zip',
        title: 'Restore a RedByte project first',
        body:
          'Highest-fidelity path: choose a RedByte export ZIP with project.rbproj.json so the embedded manifest can restore circuit, vectors, layout, and mappings. Vivado ZIP or VHDL without that manifest is a reconstruction path with fidelity limits. Nothing replaces your current project until you review the import.',
        primaryLabel: 'Select Project/Vivado ZIP',
        primaryAction: () => {
          setTab('upload');
          handleOpenZipPicker();
        },
        secondaryLabel: 'Paste HDL',
        secondaryAction: () => setTab('hdl'),
      } as const;
    }
    if (!hasParsedHdl && hdlText.trim().length > 0) {
      return {
        id: 'parse-hdl',
        title: 'Parse the HDL first',
        body:
          'RedByte needs to detect ports and supported structure before it can build the import preview.',
        primaryLabel: 'Parse HDL',
        primaryAction: parseHdl,
        secondaryLabel: 'Select Vivado ZIP',
        secondaryAction: () => {
          setTab('upload');
          handleOpenZipPicker();
        },
      } as const;
    }
    if (hasParsedHdl && !canImport) {
      if (!hasParsedXdc && xdcText.trim().length > 0) {
        return {
          id: 'parse-xdc',
          title: 'Parse constraints or map pins next',
          body:
            'Your ports are parsed. Parse the XDC now, or use Basys3 suggestions before reviewing the import.',
          primaryLabel: 'Parse XDC',
          primaryAction: () => parseXdc(),
          secondaryLabel: canApplySuggestions ? 'Apply Pins Only' : 'Open XDC',
          secondaryAction: canApplySuggestions ? applySuggestions : () => setTab('xdc'),
        } as const;
      }
      return {
        id: 'apply-pins',
        title: 'Finish mapping before import',
        body: canApplySuggestions
          ? 'Apply Basys3 pin suggestions or add pins manually, then review the import.'
          : 'Map the required ports before replacing the current project.',
        primaryLabel: canApplySuggestions ? 'Apply Pins Only' : 'Open XDC',
        primaryAction: canApplySuggestions ? applySuggestions : () => setTab('xdc'),
        secondaryLabel: 'Back to HDL',
        secondaryAction: () => setTab('hdl'),
      } as const;
    }
    return {
      id: 'review-import',
      title: 'Review the import before replacing anything',
      body:
        'RedByte has enough information to build the project. Review the import first, then confirm the replacement only if it looks correct.',
      primaryLabel: 'Review Import...',
      primaryAction: requestApplyProject,
      secondaryLabel: 'Back to HDL',
      secondaryAction: () => setTab('hdl'),
    } as const;
  }, [
    applySuggestions,
    canApplySuggestions,
    canImport,
    handleOpenZipPicker,
    hdlText,
    hasParsedHdl,
    hasParsedXdc,
    hasZipInspection,
    importFirstLookDismissed,
    parseHdl,
    parseXdc,
    pendingApplyProject,
    requestApplyProject,
    tab,
    xdcText,
  ]);

  const isImportFirstLook = !importFirstLookDismissed && importEntryAction?.id === 'zip';
  const showImportHeaderAction = false;

  useEffect(() => {
    if (importFirstLookDismissed) return;
    if (hasParsedHdl || hdlText.trim().length > 0 || hasZipInspection || pendingApplyProject) {
      setImportFirstLookDismissed(true);
    }
  }, [hasParsedHdl, hasZipInspection, hdlText, importFirstLookDismissed, pendingApplyProject]);

  const runImportPrimaryAction = () => {
    if (!importEntryAction) return;
    if (isImportFirstLook) setImportFirstLookDismissed(true);
    importEntryAction.primaryAction();
  };

  const runImportSecondaryAction = () => {
    if (!importEntryAction) return;
    setImportFirstLookDismissed(true);
    importEntryAction.secondaryAction();
  };

  const activeImportTaskLabel =
    detectedBehavioralConstructs.length > 0
      ? 'Unsupported HDL'
      : canImport
        ? 'Review Import'
        : tab === 'xdc'
          ? 'Paste XDC'
          : tab === 'upload'
            ? 'Upload ZIP'
            : 'Paste HDL';
  const activeImportTaskBody =
    detectedBehavioralConstructs.length > 0
      ? 'Behavioral constructs are blocked. Keep the source visible, explain the limit, then rebuild structurally or start fresh in Design.'
      : canImport
        ? 'Ports and blockers are resolved. Review the reconstructed project before replacing the current lab.'
        : hasParsedHdl
          ? 'Finish mapping, apply eligible pin suggestions, or paste constraints before reviewing the import.'
          : tab === 'upload'
            ? 'Choose a ZIP, or switch to Paste HDL when the project archive is not available.'
            : 'Paste structural VHDL or Verilog here, then Parse HDL to build the recovery preview.';

  const loadImportSample = useCallback((sampleId: string) => {
    const sample = IMPORT_SAMPLES.find((entry) => entry.id === sampleId);
    if (!sample) return;
    setImportFirstLookDismissed(true);
    setHdlText(sample.hdl);
    setXdcText(sample.xdc);
    setTab('hdl');
    const parsedSample = parseHdl(sample.hdl);
    if (sample.xdc.trim()) parseXdc(sample.xdc, parsedSample);
  }, [parseHdl, parseXdc]);

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
      const message = `ZIP import requires a .zip archive. "${file.name}" was not opened. No files were changed.`;
      zipFileRef.current = null;
      setImportFirstLookDismissed(true);
      setTab('upload');
      setPendingApplyImportResult(null);
      setShowVerifyResetNotice(false);
      setZipInspection(null);
      setParsedHdl(null);
      setXdcResult(null);
      setHdlText('');
      setXdcText('');
      setMapping({});
      setSelectedZipHdl(null);
      setSelectedZipXdc(null);
      setSubmissionDetectedMessage('');
      setSubmissionIntegrityMessage('');
      setZipImportError(message);
      setStatusMessage(`ZIP import failed: ${message}`);
      return;
    }
    setImportFirstLookDismissed(true);
    setTab('upload');
    zipFileRef.current = file;
    setZipBusy(true);
    setPendingApplyImportResult(null);
    setShowVerifyResetNotice(false);
    setZipImportError('');
    setSubmissionDetectedMessage('');
    setSubmissionIntegrityMessage('');

    try {
      const bytes = await file.arrayBuffer();
      try {
        const submission = await submissionImport.parseIdeSubmissionZip(bytes);
        setSubmissionDetectedMessage(
          `Submission ZIP detected: ${submission.gradeSummary.bundleId}. Open the submission workflow instead of Vivado import.`
        );
        setStatusMessage(`Submission ZIP detected: ${submission.gradeSummary.bundleId}.`);
        onImportSubmission?.(submission);
        setZipBusy(false);
        return;
      } catch (submissionError) {
        const isSubmissionIntegrityError =
          submissionError instanceof submissionImport.SubmissionIntegrityError ||
          (submissionError instanceof Error &&
            submissionError.name === 'SubmissionIntegrityError');
        if (isSubmissionIntegrityError) {
          const message = submissionError.message;
          setSubmissionIntegrityMessage(message);
          setStatusMessage(message);
          setZipBusy(false);
          return;
        }
        const isNotASubmissionZipError =
          submissionError instanceof submissionImport.NotASubmissionZipError ||
          (submissionError instanceof Error &&
            submissionError.name === 'NotASubmissionZipError');
        if (!isNotASubmissionZipError) {
          const message =
            submissionError instanceof Error ? submissionError.message : 'unknown submission parse error';
          setSubmissionIntegrityMessage(message);
          setStatusMessage(message);
          setZipBusy(false);
          return;
        }
      }

      const inspection = await importVivadoZipBytes(new Uint8Array(bytes), { sourceName: file.name });
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
      const inspectionMapping = buildZipInspectionMappingRecord(inspection);
      setMapping(inspectionMapping);
      const mappedPins = Object.values(inspectionMapping).filter(
        (pin) => pin.trim().length > 0
      ).length;
      setStatusMessage(
        inspection.importMode === 'manifest'
          ? inspection.isImportRunnable
            ? `ZIP parsed from RedByte manifest: ${inspection.manifestPath ?? inspection.detectedFiles[0]}.`
            : `ZIP parsed from RedByte manifest, but compiler checks are blocked by imported design diagnostics.`
          : inspection.isImportRunnable
            ? `ZIP parsed: ${inspection.detectedTopPath}${inspection.detectedXdcPath ? ` + ${inspection.detectedXdcPath}` : ''} (${mappedPins}/${inspection.parsedHdl.ports.length} mapped).`
            : `ZIP parsed, but compiler checks are blocked. Review diagnostics before replacing the project.`
      );
    } catch (error) {
      zipFileRef.current = null;
      setZipInspection(null);
      setParsedHdl(null);
      setXdcResult(null);
      setHdlText('');
      setXdcText('');
      setMapping({});
      setSelectedZipHdl(null);
      setSelectedZipXdc(null);
      const message = error instanceof Error ? error.message : 'unknown error';
      setZipImportError(message);
      setStatusMessage(`ZIP import failed: ${message}`);
    } finally {
      setZipBusy(false);
    }
  };

  const handleReextractZip = async (hdlPath: string, xdcPath: string | null) => {
    const file = zipFileRef.current;
    if (!file) return;
    setZipBusy(true);
    setPendingApplyImportResult(null);
    setShowVerifyResetNotice(false);
    setZipImportError('');
    setSubmissionDetectedMessage('');
    setSubmissionIntegrityMessage('');
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
      const inspectionMapping = buildZipInspectionMappingRecord(inspection);
      setMapping(inspectionMapping);
      const mappedPins = Object.values(inspectionMapping).filter(
        (pin) => pin.trim().length > 0
      ).length;
      setStatusMessage(
        inspection.importMode === 'manifest'
          ? inspection.isImportRunnable
            ? `ZIP parsed from RedByte manifest: ${inspection.manifestPath ?? inspection.detectedFiles[0]}.`
            : `ZIP parsed from RedByte manifest, but compiler checks are blocked by imported design diagnostics.`
          : inspection.isImportRunnable
            ? `Re-extracted: ${hdlPath}${xdcPath ? ` + ${xdcPath}` : ''} (${mappedPins}/${inspection.parsedHdl.ports.length} mapped).`
            : `Re-extracted, but compiler checks are blocked. Review diagnostics before replacing the project.`
      );
    } catch (error) {
      setZipInspection(null);
      setSelectedZipHdl(null);
      setSelectedZipXdc(null);
      setParsedHdl(null);
      setXdcResult(null);
      setHdlText('');
      setXdcText('');
      setMapping({});
      const message = error instanceof Error ? error.message : 'unknown error';
      setZipImportError(message);
      setStatusMessage(`Re-extract failed: ${message}`);
    } finally {
      setZipBusy(false);
    }
  };

  const jumpToReviewSection = useCallback((target: 'mapping' | 'review' | 'apply') => {
    const ref =
      target === 'mapping'
        ? mappingSectionRef
        : target === 'review'
          ? reviewSectionRef
          : applySectionRef;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleWorkflowStepAction = useCallback((stepId: ImportWorkflowStepId) => {
    if (stepId === 'upload') {
      setTab('upload');
      if (!hasZipInspection) handleOpenZipPicker();
      return;
    }
    if (stepId === 'review') {
      if (!hasParsedHdl) {
        setTab('hdl');
        return;
      }
      jumpToReviewSection(unmappedPorts.length > 0 ? 'mapping' : 'review');
      return;
    }
    if (pendingApplyProject) {
      jumpToReviewSection('apply');
      return;
    }
    if (canImport) {
      requestApplyProject();
      return;
    }
    jumpToReviewSection('mapping');
  }, [
    canImport,
    hasParsedHdl,
    hasZipInspection,
    jumpToReviewSection,
    pendingApplyProject,
    requestApplyProject,
    unmappedPorts.length,
  ]);

  const copyDiagnostics = async () => {
    const report = buildDiagnosticsReport({
      parsedEntityName,
      ports,
      mapping,
      warnings,
      blockingErrors,
      compilerStatus: compilerStatusLabel,
      compilerDiagnostics:
        pendingApplyImportResult?.compilerDiagnostics ??
        previewImportResult?.compilerDiagnostics ??
        zipInspection?.compilerDiagnostics ??
        [],
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

  const leftDockContent = (
    <section
      className={`ide-import-dock-v2${
        isImportFirstLook ? ' ide-import-dock-v2--first-look' : ' ide-import-dock-v2--active'
      }`}
      data-testid="ide-import-dock"
    >
      <header className="ide-workbench-placeholder-header">
        <h3>Import Workflow</h3>
      </header>
      <ol className="ide-import-workflow-rail" data-testid="ide-import-workflow-rail">
        {workflowSteps.map((step) => (
          <li
            key={step.id}
            className={`ide-import-workflow-step is-${step.state}`}
            data-testid={`ide-import-workflow-step-${step.id}`}
          >
            <button
              type="button"
              className="ide-import-workflow-step-btn"
              onClick={() => handleWorkflowStepAction(step.id)}
            >
              <span className="ide-import-workflow-step-order">{step.order}</span>
              <span className="ide-import-workflow-step-copy">
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </span>
              <IdeStatusPill tone={workflowTone(step.state)}>
                {workflowLabel(step.state)}
              </IdeStatusPill>
            </button>
          </li>
        ))}
      </ol>

      {!isImportFirstLook ? (
        <>
          <SurfacePanel className="ide-import-dock-actions" testId="ide-import-dock-actions">
            <div className="ide-import-dock-actions-header">
              <strong>Current step</strong>
              <span>{workflowActiveLabel}</span>
            </div>
            {importEntryAction ? (
              <>
                <div className="ide-inline-actions">
                  <IdeButton tone="secondary" onClick={runImportPrimaryAction} testId="ide-import-dock-primary">
                    {importEntryAction.primaryLabel}
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={runImportSecondaryAction} testId="ide-import-dock-secondary">
                    {importEntryAction.secondaryLabel}
                  </IdeButton>
                </div>
                <p className="ide-copy" data-testid="ide-import-dock-mode-hint" style={{ margin: 0 }}>
                  {importEntryAction.body}
                </p>
              </>
            ) : null}
            <div className="ide-inline-actions">
              <IdeButton tone="ghost" onClick={parseHdl} testId="ide-import-parse">
                Parse HDL
              </IdeButton>
              <IdeButton tone="ghost" onClick={() => parseXdc()} testId="ide-import-parse-xdc">
                Parse XDC
              </IdeButton>
              <IdeButton
                tone="ghost"
                onClick={applySuggestions}
                disabled={!canApplySuggestions}
                testId="ide-import-apply-pins-only"
              >
                Apply Pins Only
              </IdeButton>
            </div>
          </SurfacePanel>

          <SurfacePanel className="ide-import-dock-guidance" testId="ide-import-expectations">
            <strong>What happens when you import</strong>
            <ul className="ide-bullets">
              <li><b>Apply Pins Only</b> fills missing pin assignments on your current project.</li>
              <li><b>Review Import...</b> shows the exact replacement before commit.</li>
              <li><b>Confirm Replace Project</b> is the only step that swaps the active project.</li>
            </ul>
          </SurfacePanel>

          <div className="ide-import-secondary-tools" data-testid="ide-import-secondary-tools">
            <span className="ide-import-secondary-tools-label">Secondary tools</span>
            <div className="ide-inline-actions">
              <IdeButton tone="ghost" onClick={copyDiagnostics} testId="ide-import-copy-diagnostics">
                Copy report
              </IdeButton>
              <IdeButton
                tone="ghost"
                onClick={() => void handleProcessDesign()}
                disabled={pipelineActive || (!hdlText.trim() && !zipInspection)}
                testId="ide-import-process-design"
              >
                {pipelineActive ? 'Processing…' : 'Process Design'}
              </IdeButton>
            </div>
          </div>

          <section className="ide-import-samples-grid">
            {IMPORT_SAMPLES.filter((s) => !s.behavioral).map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="ide-import-sample-card"
                onClick={() => loadImportSample(sample.id)}
                data-testid={`ide-import-load-sample-${sample.id}`}
              >
                <span className="ide-import-sample-card-name">{sample.name}</span>
                <span className="ide-import-sample-card-desc">{sample.desc}</span>
                <span className="ide-import-sample-card-learn">Lesson: {sample.learn}</span>
              </button>
            ))}
            {showBehavioralSamples && IMPORT_SAMPLES.filter((s) => s.behavioral).map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="ide-import-sample-card ide-import-sample-card--behavioral"
                onClick={() => loadImportSample(sample.id)}
                data-testid={`ide-import-load-sample-${sample.id}`}
              >
                <span className="ide-import-sample-card-name">{sample.name}</span>
                <span className="ide-import-sample-card-desc">{sample.desc}</span>
                <span className="ide-import-sample-card-learn">Blocked: {sample.learn}</span>
              </button>
            ))}
          </section>
          <button
            type="button"
            className="ide-import-behavioral-toggle"
            data-testid="ide-import-toggle-behavioral-samples"
            onClick={() => setShowBehavioralSamples((prev) => !prev)}
          >
            {showBehavioralSamples ? 'Hide unsupported examples' : 'Show unsupported examples (blocked)'}
          </button>
        </>
      ) : null}
    </section>
  );

  const inspectorContent = (
    <>
      <IdeInspectorSection title="Import Readiness" defaultOpen testId="ide-import-readiness">
        <div className="ide-kv-list">
          <div className="ide-kv-row">
            <span>Parsed entity</span>
            <code data-testid="ide-import-entity-name">{parsedEntityName}</code>
          </div>
          <div className="ide-kv-row">
            <span>Ports</span>
            <span data-testid="ide-import-stage-summary">
              {ports.length} total · {inputCount} in / {outputCount} out
            </span>
          </div>
          <div className="ide-kv-row">
            <span>Mapping</span>
            <span data-testid="ide-import-port-summary">
              {mappedPortCount}/{ports.length} mapped
            </span>
          </div>
          <div className="ide-kv-row">
            <span>Review mode</span>
            <span>{reviewModeLabel}</span>
          </div>
          <div className="ide-kv-row">
            <span>Status</span>
            <span>{statusMessage}</span>
          </div>
        </div>
        {boardDetection ? (
          <div className="ide-import-board-detection" data-testid="ide-import-board-detection">
            <strong>Board detected: {boardDetection.board}</strong>
            <IdeStatusPill tone={boardDetection.confidence === 'High' ? 'ok' : boardDetection.confidence === 'Medium' ? 'warn' : 'idle'}>
              {boardDetection.confidence}
            </IdeStatusPill>
            <p className="ide-copy">{boardDetection.reason}</p>
          </div>
        ) : null}
        {clockCandidatePort ? (
          <div className="ide-import-clock-candidate" data-testid="ide-import-clock-candidate">
            <IdeStatusPill tone="ok">CLK</IdeStatusPill>
            <code>{clockCandidatePort.name}</code>
            <span>
              {xdcResult?.pinMap[clockCandidatePort.name]
                ? `→ ${xdcResult.pinMap[clockCandidatePort.name]}`
                : 'no pin constraint yet'}
            </span>
          </div>
        ) : null}
      </IdeInspectorSection>

      <IdeInspectorSection title="Suggestions" defaultOpen testId="ide-import-port-suggestions">
        {!parsedHdl ? (
          <p className="ide-copy" data-testid="ide-import-port-suggestions-empty">Parse HDL to see port suggestions.</p>
        ) : suggestions.length === 0 ? (
          <p className="ide-copy">No eligible suggestions were found.</p>
        ) : (
          <>
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Ready to apply</span>
                <IdeStatusPill tone="ok">{applicableItems.length}</IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Already pinned</span>
                <IdeStatusPill tone="idle">{suggestions.filter((s) => s.locked).length}</IdeStatusPill>
              </div>
              {activeGuidedLabTask && pendingApplyProject?.meta?.labId === activeGuidedLabTask.id ? (
                <div className="ide-import-commitPreview-row" data-testid="ide-import-guided-full-adder-review">
                  <span className="ide-import-commitPreview-key">LAB</span>
                  <span className="ide-import-commitPreview-val">
                    {activeGuidedLabTask.title} ({activeGuidedLabTask.id})
                  </span>
                </div>
              ) : null}
            </div>
            <div className="ide-import-suggestion-list">
              {suggestions.slice(0, 8).map((s) => (
                <div key={s.portName} className="ide-import-suggestion-row" data-testid={`ide-import-suggestion-${s.portName}`}>
                  <div>
                    <code>{s.portName}</code>
                    <span className="ide-import-suggestion-arrow">{s.direction === 'in' ? '→' : '←'}</span>
                    <span>{resolvedPin(s) ?? 'skip'}</span>
                  </div>
                  <IdeStatusPill tone={s.confidence === 'high' ? 'ok' : s.confidence === 'medium' ? 'warn' : 'idle'}>
                    {s.confidence.toUpperCase()}
                  </IdeStatusPill>
                </div>
              ))}
            </div>
            <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
              <IdeButton tone="secondary" onClick={handleApplyAll} testId="ide-import-apply-all" disabled={applicableItems.length === 0}>
                Apply {applicableItems.length} suggestion{applicableItems.length !== 1 ? 's' : ''}
              </IdeButton>
              {onGoToProject ? (
                <IdeButton tone="ghost" onClick={onGoToProject} testId="ide-import-go-project">
                  Review in Project
                </IdeButton>
              ) : null}
            </div>
          </>
        )}
      </IdeInspectorSection>

      <IdeInspectorSection title="Warnings + Blockers" defaultOpen testId="ide-import-diagnostics">
        {blockingErrors.length > 0 ? (
          <IdeCallout tone="error" title="Import blocked" testId="ide-import-errors">
            <ul className="ide-list">
              {blockingErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </IdeCallout>
        ) : hasParsedHdl ? (
          <IdeCallout tone="success" title="No blocking errors" testId="ide-import-errors">
            Review the schematic, then confirm the replacement.
          </IdeCallout>
        ) : null}
        {warnings.length > 0 ? (
          <IdeCallout tone="warn" title="Warnings" testId="ide-import-warnings">
            <ul className="ide-list">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </IdeCallout>
        ) : hasParsedHdl ? (
          <IdeCallout tone="info" title="No warnings" testId="ide-import-warnings">
            No parser warnings detected yet.
          </IdeCallout>
        ) : null}
        {unifiedImportDiagnostics.length > 0 ? (
          <IdeCallout tone="info" title="Unified diagnostics" testId="ide-import-unified-diagnostics">
            <ul className="ide-list">
              {unifiedImportDiagnostics.slice(0, 6).map((diagnostic) => (
                <li key={diagnostic.id}>
                  <strong>{diagnostic.code}</strong> [{diagnostic.origin}] {diagnostic.message}
                </li>
              ))}
            </ul>
          </IdeCallout>
        ) : null}
      </IdeInspectorSection>

      {commitPreview ? (
        <IdeInspectorSection title="Review Summary" defaultOpen testId="ide-import-review-summary">
          {commitPreview ? (
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Entity</span>
                <span>{commitPreview.entityName}</span>
              </div>
              <div className="ide-kv-row">
                <span>Ports</span>
                <span>{commitPreview.totalPorts}</span>
              </div>
              <div className="ide-kv-row">
                <span>Pins</span>
                <span>{commitPreview.mappedCount}/{commitPreview.totalPorts} mapped</span>
              </div>
              <div className="ide-kv-row">
                <span>Graph</span>
                <span>{commitPreview.nodeCount} nodes</span>
              </div>
            </div>
          ) : null}
        </IdeInspectorSection>
      ) : null}
    </>
  );

  const sourceReviewLane = (
    <aside className="ide-import-source-review-v1" data-testid="ide-import-source-review-v1" aria-label="Import source review">
      <header className="ide-import-source-review-v1__header">
        <span className="ide-surface-block-label">Source selected</span>
        <IdeStatusPill tone={canImport ? 'ok' : hasParsedHdl ? 'warn' : 'idle'}>
          {tab === 'upload' ? 'ZIP' : tab === 'xdc' ? 'XDC' : 'HDL'}
        </IdeStatusPill>
      </header>
      <strong>{activeImportTaskLabel}</strong>
      <p>{activeImportTaskBody}</p>
      <div className="ide-import-source-review-v1__checks">
        <div>
          <span>Inspect / parse</span>
          <b>{hasParsedHdl ? `${parsedEntityName} parsed` : 'Parse HDL next'}</b>
        </div>
        <div>
          <span>Map pins</span>
          <b>{hasParsedHdl ? `${mappedPortCount}/${ports.length} mapped` : 'After parse'}</b>
        </div>
        <div>
          <span>Review / replace</span>
          <b>{canImport ? 'Ready for review' : 'No replace yet'}</b>
        </div>
      </div>
      <div className="ide-import-source-review-v1__actions">
        <IdeButton
          tone="secondary"
          onClick={canImport ? requestApplyProject : parseHdl}
          disabled={!canImport && !hdlText.trim()}
          testId="ide-import-source-review-primary"
        >
          {canImport ? 'Review Import...' : 'Parse HDL'}
        </IdeButton>
        <IdeButton
          tone="secondary"
          onClick={() => setTab('xdc')}
          testId="ide-import-source-review-xdc"
        >
          Paste XDC
        </IdeButton>
      </div>
      <p className="ide-import-source-review-v1__boundary">
        Import review does not replace current work. Cancel keeps your current project; Confirm Replace Project applies the reviewed import.
      </p>
    </aside>
  );

  const sourceStageContent = (
    <section className="ide-import-source-stage" data-testid="ide-import-source-stage">
      <div className="ide-import-pipeline-tabs ide-import-source-tabs" data-testid="ide-import-source-tabs">
        {(['upload', 'hdl', 'xdc'] as ImportTab[]).map((tabId, index) => (
          <button
            key={tabId}
            type="button"
            className={`ide-pipeline-stage ${tab === tabId ? 'ide-pipeline-stage--active' : 'ide-pipeline-stage--pending'}`}
            onClick={() => setTab(tabId)}
            aria-current={tab === tabId ? 'step' : undefined}
          >
            <span className="ide-pipeline-badge">{index + 1}</span>
            <span className="ide-pipeline-label">
              {tabId === 'upload' ? 'Upload ZIP' : tabId === 'hdl' ? 'Paste HDL' : 'Paste XDC'}
            </span>
          </button>
        ))}
      </div>

      {pipelineSteps.some((s) => s.state !== 'idle') ? (
        <ol className="ide-import-pipeline-steps" data-testid="ide-import-pipeline-steps">
          {pipelineSteps.map((s) => (
            <li
              key={s.id}
              className={`ide-import-pipeline-step ide-import-pipeline-step--${s.state}`}
              data-testid={`ide-import-pipeline-step-${s.id}`}
            >
              <span className="ide-import-step-mark">
                {s.state === 'done' ? '[✔]' : s.state === 'running' ? '[…]' : s.state === 'error' ? '[✗]' : s.state === 'skipped' ? '[—]' : '[ ]'}
              </span>
              <span className="ide-import-step-label">{s.label}</span>
              {s.detail ? <span className="ide-import-step-detail">{s.detail}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {submissionDetectedMessage ? (
        <IdeCallout tone="info" title="Submission detected" testId="ide-import-submission-detected">
          <p className="ide-copy" style={{ margin: 0 }}>{submissionDetectedMessage}</p>
        </IdeCallout>
      ) : null}
      {submissionIntegrityMessage ? (
        <IdeCallout tone="error" title="Submission integrity failed" testId="ide-import-submission-integrity-failed">
          <p className="ide-copy" style={{ margin: 0 }}>{submissionIntegrityMessage}</p>
        </IdeCallout>
      ) : null}

      {tab === 'upload' ? (
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
          <IdeCallout tone="info" title="Vivado ZIP import">
            Drop a Vivado ZIP here or browse to inspect the detected top module, constraints, and manifest status.
          </IdeCallout>
          <div className="ide-inline-actions">
            <IdeButton tone="secondary" onClick={handleOpenZipPicker} disabled={zipBusy} testId="ide-import-zip-browse">
              {zipBusy ? 'Importing ZIP...' : 'Select ZIP'}
            </IdeButton>
          </div>
          {zipImportError ? (
            <IdeCallout tone="error" title="Could not open ZIP" testId="ide-import-zip-error">
              <p className="ide-copy" style={{ margin: '0 0 var(--ide-space-1)' }}>
                {formatZipImportErrorMessage(zipImportError)}
              </p>
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 'var(--rb-font-size-1)', color: 'var(--ide-text-soft)' }}>
                  Show technical details
                </summary>
                <p className="ide-copy" style={{ margin: 'var(--ide-space-1) 0 0', fontFamily: 'var(--rb-font-mono)', fontSize: 'var(--rb-font-size-1)' }}>
                  {zipImportError}
                </p>
              </details>
            </IdeCallout>
          ) : null}
          {zipInspection ? (
            <section className="ide-export-section ide-import-zip-inspection-v2" data-testid="ide-import-zip-inspection">
              <IdeSectionHeader
                title="ZIP Inspection"
                meta={`${zipInspection.detectedFiles.length} detected / ${zipInspection.ignoredFiles.length} ignored`}
              />
              <ImportZipAuthorityCallout zi={zipInspection} />
              {!isManifestZipImport ? (
                <div className="ide-import-zip-chooser" data-testid="ide-import-zip-chooser">
                  <div className="ide-import-zip-chooser-col">
                    <div className="ide-import-zip-chooser-label">
                      HDL Top
                      {zipInspection.detectedTopPath === selectedZipHdl ? (
                        <span className="ide-import-zip-auto-badge" data-testid="ide-import-zip-hdl-auto">auto</span>
                      ) : null}
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
                        {path === zipInspection.detectedTopPath ? <span className="ide-import-zip-score-badge">scored #1</span> : null}
                      </label>
                    ))}
                  </div>
                  <div className="ide-import-zip-chooser-col">
                    <div className="ide-import-zip-chooser-label">
                      XDC Constraints
                      {zipInspection.detectedXdcPath === selectedZipXdc ? (
                        <span className="ide-import-zip-auto-badge" data-testid="ide-import-zip-xdc-auto">auto</span>
                      ) : null}
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
                      <span className="ide-import-zip-radio-path">none</span>
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
                        {path === zipInspection.detectedXdcPath ? <span className="ide-import-zip-score-badge">scored #1</span> : null}
                      </label>
                    ))}
                  </div>
                  {(selectedZipHdl !== zipInspection.detectedTopPath ||
                    selectedZipXdc !== (zipInspection.detectedXdcPath ?? null)) && selectedZipHdl ? (
                    <div className="ide-inline-actions" style={{ gridColumn: '1 / -1' }}>
                      <IdeButton tone="secondary" onClick={() => void handleReextractZip(selectedZipHdl, selectedZipXdc)} disabled={zipBusy} testId="ide-import-zip-reextract">
                        {zipBusy ? 'Re-extracting…' : 'Re-extract with selection'}
                      </IdeButton>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="ide-import-zip-meta-grid">
                <div className="ide-kv-list">
                  <div className="ide-kv-row">
                    <span>Mode</span>
                    <span data-testid="ide-import-zip-mode">
                      {zipInspection.importMode === 'manifest' ? 'RedByte manifest' : 'HDL/XDC reconstruction'}
                    </span>
                  </div>
                  <div className="ide-kv-row">
                    <span>Language</span>
                    <span data-testid="ide-import-zip-top-language">{zipInspection.detectedTopLanguage.toUpperCase()}</span>
                  </div>
                </div>
                <div className="ide-import-zip-lists">
                  <div>
                    <h4>Detected</h4>
                    <ul className="ide-list" data-testid="ide-import-zip-detected-list">
                      {zipInspection.detectedFiles.map((path) => (
                        <li key={path}><code>{path}</code></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Ignored</h4>
                    {zipInspection.ignoredFiles.length > 0 ? (
                      <ul className="ide-list" data-testid="ide-import-zip-ignored-list">
                        {zipInspection.ignoredFiles.slice(0, 10).map((path) => (
                          <li key={path}><code>{path}</code></li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ide-copy">No extra files ignored.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'hdl' ? (
        <div className="ide-import-editor">
          <div className="ide-import-parse-summary ide-import-parse-summary--hero" data-testid="ide-import-stage-summary-detail">
            <span><strong>{parsedEntityName}</strong></span>
            <span>{ports.length} port{ports.length !== 1 ? 's' : ''}</span>
            <span>{mappedPortCount}/{ports.length} mapped</span>
            {hasParsedXdc ? <span data-testid="ide-import-xdc-ok">XDC parsed</span> : <span data-testid="ide-import-xdc-missing">No XDC yet</span>}
          </div>
          <details className="ide-import-hdl-scope-box" data-testid="ide-import-hdl-scope">
            <summary>What HDL does RedByte support?</summary>
            <div className="ide-import-hdl-support-grid">
              <div>
                <strong>Supported</strong>
                <ul>
                  <li>entity / port declarations</li>
                  <li>structural component instantiations</li>
                  <li>concurrent signal assignments</li>
                  <li>gate primitives and simple assign statements</li>
                </ul>
              </div>
              <div>
                <strong>Blocked</strong>
                <ul>
                  <li>process / always blocks</li>
                  <li>clocked logic</li>
                  <li>generate statements</li>
                  <li>generics / parameters</li>
                </ul>
              </div>
            </div>
          </details>
          {detectedBehavioralConstructs.length > 0 ? (
            <IdeCallout tone="error" title="Behavioral HDL cannot be imported" testId="ide-import-behavioral-warning">
              <p className="ide-copy" style={{ margin: 0 }}>
                RedByte supports structural/combinational HDL only. The following constructs were detected and will block the commit step: <strong>{detectedBehavioralConstructs.join(', ')}</strong>.
              </p>
            </IdeCallout>
          ) : null}
          {hdlWarningCount > 0 ? (
            <ol className="ide-warning-list" data-testid="ide-import-parse-warnings">
              {hdlParseWarnings.slice(0, 10).map((w, idx) => (
                <li key={`${idx}-${w.message.slice(0, 20)}`} className="ide-warning-row" data-testid="ide-import-parse-warning-row">
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
          ) : null}
          <div className="ide-import-language-row">
            <span>Language</span>
            <select className="ide-export-pin-input" value={language} onChange={(event) => setLanguage(event.target.value as HdlLanguage)} data-testid="ide-import-language-select">
              <option value="auto">Auto-detect</option>
              <option value="vhdl">VHDL</option>
              <option value="verilog">Verilog</option>
            </select>
            <IdeButton tone="ghost" onClick={() => setHdlText('')} testId="ide-import-clear-hdl">
              Clear
            </IdeButton>
          </div>
          {detectedEntityNames.length >= 2 ? (
            <div className="ide-import-entity-chooser" data-testid="ide-import-entity-chooser">
              <span className="ide-import-entity-chooser-label">Top Entity</span>
              <select className="ide-export-pin-input" value={selectedEntityName ?? detectedEntityNames[0]} onChange={(e) => setSelectedEntityName(e.target.value)} data-testid="ide-import-entity-select">
                {detectedEntityNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <span className="ide-import-entity-chooser-hint" data-testid="ide-import-entity-hint">
                {(selectedEntityName ?? detectedEntityNames[0]) === detectedEntityNames[0] ? 'Auto-selected: first entity' : 'User selected'}
              </span>
            </div>
          ) : null}
          <div className="ide-code-editor" data-testid="ide-import-hdl-editor">
            <div className="ide-code-gutter" aria-hidden="true" data-testid="ide-import-hdl-gutter" ref={hdlGutterRef}>
              {Array.from({ length: lineCount }, (_, i) => {
                const lineNum = i + 1;
                return <span key={lineNum} className={`ide-code-gutter-line${activeWarningLine === lineNum ? ' ide-code-gutter-line--warn' : ''}`}>{lineNum}</span>;
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
              placeholder={"-- Paste your VHDL or Verilog here\n-- Structural VHDL and Verilog only\n-- Try one of the sample templates in the left rail"}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        </div>
      ) : null}

      {tab === 'xdc' ? (
        <div className="ide-import-editor">
          <div className="ide-import-parse-summary ide-import-parse-summary--hero">
            <span>entity port → board pin</span>
            <span>{mappedPortCount}/{ports.length} mapped</span>
            {boardDetection ? <span>Board: {boardDetection.board}</span> : <span>Board detection pending</span>}
          </div>
          <div className="ide-code-editor" data-testid="ide-import-xdc-editor">
            <div className="ide-code-gutter" aria-hidden="true" ref={xdcGutterRef}>
              {Array.from({ length: xdcLineCount }, (_, i) => {
                const lineNum = i + 1;
                return <span key={lineNum} className={`ide-code-gutter-line${activeXdcWarningLine === lineNum ? ' ide-code-gutter-line--warn' : ''}`}>{lineNum}</span>;
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
      ) : null}
    </section>
  );

  const reviewWorkspace = hasParsedHdl ? (
    <section className="ide-import-review-shell" data-testid="ide-import-review-shell">
      <div className="ide-import-review-overview" ref={reviewSectionRef}>
        <IdeSectionHeader title="Review schematic" meta="Step 4" />
        <div className="ide-import-review-summary-grid">
          <div className="ide-import-review-stat">
            <span>Entity</span>
            <strong>{parsedEntityName}</strong>
          </div>
          <div className="ide-import-review-stat">
            <span>Ports</span>
            <strong>{ports.length}</strong>
          </div>
          <div className="ide-import-review-stat">
            <span>Inputs / Outputs</span>
            <strong>{inputCount} / {outputCount}</strong>
          </div>
          <div className="ide-import-review-stat">
            <span>Mapped</span>
            <strong>{mappedPortCount}/{ports.length}</strong>
          </div>
          <div className="ide-import-review-stat">
            <span>Mode</span>
            <strong>{reviewModeLabel}</strong>
          </div>
          <div className="ide-import-review-stat">
            <span>Board</span>
            <strong>{boardDetection ? `${boardDetection.board} (${boardDetection.confidence})` : 'Undetected'}</strong>
          </div>
        </div>
        {isManifestZipImport ? (
          <div className="ide-import-recon-callout ide-import-recon-callout--full" data-testid="ide-import-recon-manifest">
            <strong>RedByte project restored</strong>
            <p>RedByte restored the project directly from the embedded manifest. HDL, XDC, and Vivado files are reference-only.</p>
          </div>
        ) : effectiveReconstructionLevel === 'ports-only' ? (
          <IdeCallout tone="warn" title="Ports only — no circuit reconstructed" testId="ide-import-ports-only-warning">
            <p className="ide-copy" style={{ margin: '0 0 var(--ide-space-1)' }}>
              Only input/output ports were recovered. Internal logic was not reconstructed.
            </p>
            <p className="ide-copy" style={{ margin: '0 0 var(--ide-space-1)' }}>
              Your project will have the correct port names, but the circuit is empty — no gates or connections exist.
            </p>
            <p className="ide-copy" style={{ margin: 0 }}>
              Rebuild the internal circuit in Design, or re-import from a RedByte project export.
            </p>
            {onGoToExport && (
              <div className="ide-inline-actions" style={{ marginTop: 'var(--ide-space-2)' }}>
                <IdeButton tone="secondary" onClick={onGoToExport} testId="ide-import-go-to-export">
                  Export structural VHDL from Design →
                </IdeButton>
              </div>
            )}
          </IdeCallout>
        ) : effectiveReconstructionLevel === 'full' ? (
          <div className="ide-import-recon-callout ide-import-recon-callout--full" data-testid="ide-import-recon-full">
            <strong>Structural HDL detected</strong>
            <p>Circuit reconstructed with gates and connections.</p>
          </div>
        ) : null}
      </div>

      <div className="ide-import-review-grid">
        <section className="ide-export-section ide-import-review-panel" ref={mappingSectionRef} data-testid="ide-import-ports-table">
          <IdeSectionHeader title="Map ports" meta="entity port → board pin" />
          <IdeDataTable
            columns={['Entity Port', 'Board Pin', 'Direction', 'Width', 'Confidence', 'State']}
            rows={portRows}
          />

          {(hasParsedXdc || unmappedPorts.length > 0) ? (
            <section className="ide-import-xdc-coverage" data-testid="ide-import-xdc-coverage">
              <header className="ide-export-section-header">
                <h3>XDC coverage</h3>
                <span className="ide-export-section-meta">
                  {ports.length - unmappedPorts.length}/{ports.length} constrained
                </span>
              </header>

              {unmappedPorts.length > 0 ? (
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
              ) : null}

              {orphanXdcKeys.length > 0 ? (
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
              ) : null}

              {unmappedPorts.length === 0 && orphanXdcKeys.length === 0 ? (
                <p className="ide-copy" style={{ margin: 0 }}>All HDL ports are constrained. No orphan XDC keys.</p>
              ) : null}
            </section>
          ) : null}
        </section>

        <section className="ide-export-section ide-import-review-panel" data-testid="ide-import-schematic-stage">
          <IdeSectionHeader title="Preview schematic" meta="Step 4" />
          <div data-testid="ide-import-schematic-preview">
            <ImportSchematicPreview parsedHdl={parsedHdl} mapping={mapping} />
          </div>
          {zipInspection?.weakPinPorts.length ? (
            <div className="ide-import-weak-pins-callout" data-testid="ide-import-weak-pins">
              <span className="ide-import-weak-pins-label">Weak pin mappings</span>
              <p>
                {zipInspection.weakPinPorts.length} port{zipInspection.weakPinPorts.length !== 1 ? 's' : ''} map to pins outside the known Basys3 pin table.
              </p>
              <ul>
                {zipInspection.weakPinPorts.map((portName) => (
                  <li key={portName} data-testid={`ide-import-weak-pin-${portName}`}>{portName}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  ) : null;

  return (
    <IdeSurfaceLayout
      mode="import"
      layoutIntent="workbench"
      leftDockMode="hidden"
      rightDockMode="hidden"
      consoleMode="hidden"
      consoleHasBlocking={blockingErrors.length > 0 || hasImportBlocker}
      consoleHasEntries={warnings.length > 0 || blockingErrors.length > 0}
      productSpine={{
        currentStage: workflowActiveLabel,
        nextStage: currentWorkflowStepId === 'apply' ? 'Design' : currentWorkflowStepId === 'review' ? 'Apply' : 'Review',
        status: showVerifyResetNotice
          ? 'Applied'
          : hasImportBlocker
            ? 'Blocked'
            : detectedBehavioralConstructs.length > 0
              ? 'Reviewable · apply blocked'
              : canImport
                ? 'Ready to review'
                : 'In progress',
        owner: 'Import',
        title: showVerifyResetNotice ? 'Project replacement complete' : activeImportTaskLabel,
        detail: statusMessage,
      }}
    >
      <IdePanel testId="ide-import-panel">
        <section className="ide-import-v3" data-testid="ide-import-workbench" aria-label="Import recovery workflow">
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => void handleZipInputChange(event)}
            data-testid="ide-import-zip-input"
          />

          <header className="ide-import-v3__header">
            <div>
              <p className="ide-surface-block-label">Import</p>
              <h2>Recover a project without replacing current work early</h2>
              <p>Choose a source, review what RedByte reconstructed, then explicitly apply the replacement.</p>
            </div>
            <ol
              className="ide-import-v3__steps"
              data-testid="ide-import-horizontal-stepper"
              aria-label="Upload, review, and apply progress"
            >
              {workflowSteps.map((step) => (
                <li
                  key={step.id}
                  className={'is-' + step.state}
                  aria-current={step.state === 'active' ? 'step' : undefined}
                  data-testid={'ide-import-step-' + step.id}
                >
                  <span>{step.order}</span>
                  <div><strong>{step.label}</strong><small>{step.detail}</small></div>
                </li>
              ))}
            </ol>
          </header>

          {showVerifyResetNotice ? (
            <IdeCallout tone="success" title="Project replaced" testId="ide-import-verify-reset-notice">
              <p className="ide-copy ide-copy--flush">
                The reviewed import is now the active project. Run Simulate again because prior evidence belongs to the replaced design.
              </p>
              <div className="ide-inline-actions">
                {onGoToDesign ? <IdeButton tone="secondary" onClick={onGoToDesign} testId="ide-import-open-design">Open Design</IdeButton> : null}
                {onGoToVerify ? <IdeButton tone="secondary" onClick={onGoToVerify} testId="ide-import-open-verify">Open Simulate</IdeButton> : null}
              </div>
            </IdeCallout>
          ) : null}

          {!showVerifyResetNotice && !pendingApplyProject ? (
            <section className="ide-import-v3__source" aria-labelledby="ide-import-v3-source-title">
              <header className="ide-import-v3__section-header">
                <div>
                  <p className="ide-surface-block-label">1 · Upload</p>
                  <h3 id="ide-import-v3-source-title">
                    {tab === 'upload' ? 'Choose a project ZIP' : tab === 'hdl' ? 'Paste structural HDL' : 'Paste Basys3 constraints'}
                  </h3>
                </div>
                <div className="ide-import-v3__source-switch">
                  {tab !== 'upload' ? (
                    <IdeButton tone="secondary" onClick={() => setTab('upload')} testId="ide-import-source-zip">ZIP</IdeButton>
                  ) : null}
                  {tab !== 'hdl' ? (
                    <IdeButton tone="secondary" onClick={() => { setImportFirstLookDismissed(true); setTab('hdl'); }} testId="ide-import-start-secondary">
                      Paste HDL
                    </IdeButton>
                  ) : null}
                  {tab !== 'xdc' && hasParsedHdl ? (
                    <IdeButton tone="ghost" onClick={() => setTab('xdc')} testId="ide-import-source-xdc">Paste XDC</IdeButton>
                  ) : null}
                </div>
              </header>

              {tab === 'upload' ? (
                <div
                  className="ide-import-v3__dropzone"
                  data-testid="ide-import-zip-dropzone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleZipDrop(event)}
                >
                  <div>
                    <strong>{zipInspection ? zipInspection.sourceName : 'RedByte project ZIP or Vivado project ZIP'}</strong>
                    <p>
                      {zipInspection
                        ? 'Archive opened. Review the detected project below before applying anything.'
                        : 'Drop one .zip archive here, or choose it from your computer. A manifest restores the most project state.'}
                    </p>
                  </div>
                  <IdeButton
                    tone={hasParsedHdl ? 'secondary' : 'primary'}
                    onClick={handleOpenZipPicker}
                    disabled={zipBusy}
                    testId="ide-import-zip-browse"
                  >
                    {zipBusy ? 'Reading ZIP…' : zipInspection ? 'Choose another ZIP' : 'Choose ZIP'}
                  </IdeButton>
                </div>
              ) : null}

              {tab === 'upload' && !zipInspection ? (
                <details className="ide-import-v3__samples">
                  <summary>No ZIP available? Try an example</summary>
                  <div>
                    <IdeButton tone="secondary" onClick={() => loadImportSample('and-gate')} testId="ide-import-load-sample-and-gate">
                      Load structural sample
                    </IdeButton>
                    <IdeButton tone="ghost" onClick={() => loadImportSample('edge-detect')} testId="ide-import-load-sample-edge-detect">
                      Load blocked behavioral sample
                    </IdeButton>
                  </div>
                </details>
              ) : null}

              {zipImportError ? (
                <IdeCallout tone="error" title="ZIP was not opened" testId="ide-import-zip-error">
                  <p className="ide-copy ide-copy--flush">{formatZipImportErrorMessage(zipImportError)}</p>
                  <p className="ide-import-v3__safe-state">Your active project was not changed.</p>
                  <div className="ide-inline-actions">
                    <IdeButton tone="primary" onClick={handleOpenZipPicker} disabled={zipBusy} testId="ide-import-retry-zip">
                      Choose another ZIP
                    </IdeButton>
                    <IdeButton tone="secondary" onClick={() => setTab('hdl')} testId="ide-import-error-paste-hdl">
                      Paste HDL instead
                    </IdeButton>
                  </div>
                </IdeCallout>
              ) : null}

              {submissionDetectedMessage ? (
                <IdeCallout tone="info" title="Submission detected" testId="ide-import-submission-detected">
                  {submissionDetectedMessage}
                </IdeCallout>
              ) : null}

              {submissionIntegrityMessage ? (
                <IdeCallout tone="error" title="Submission integrity failed" testId="ide-import-submission-integrity-failed">
                  {submissionIntegrityMessage}
                </IdeCallout>
              ) : null}

              {zipInspection ? (
                <div className="ide-import-v3__zip-summary" data-testid="ide-import-zip-inspection">
                  <ImportZipAuthorityCallout zi={zipInspection} />
                  <dl>
                    <div><dt>Top source</dt><dd>{zipInspection.detectedTopPath ?? 'Not detected'}</dd></div>
                    <div><dt>Constraints</dt><dd>{zipInspection.detectedXdcPath ?? 'Not detected'}</dd></div>
                    <div><dt>Mode</dt><dd>{zipInspection.importMode === 'manifest' ? 'Manifest restore' : 'Reconstruction'}</dd></div>
                  </dl>
                </div>
              ) : null}

              {tab === 'hdl' ? (
                <div className="ide-import-v3__editor">
                  <div className="ide-import-v3__editor-bar">
                    <label>
                      Language
                      <select value={language} onChange={(event) => setLanguage(event.target.value as HdlLanguage)} data-testid="ide-import-language-select">
                        <option value="auto">Auto-detect</option>
                        <option value="vhdl">VHDL</option>
                        <option value="verilog">Verilog</option>
                      </select>
                    </label>
                    {detectedEntityNames.length >= 2 ? (
                      <label>
                        Top entity
                        <select
                          value={selectedEntityName ?? detectedEntityNames[0]}
                          onChange={(event) => setSelectedEntityName(event.target.value)}
                          data-testid="ide-import-entity-select"
                        >
                          {detectedEntityNames.map((name) => <option key={name} value={name}>{name}</option>)}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  {detectedBehavioralConstructs.length > 0 ? (
                    <IdeCallout tone="error" title="Behavioral HDL is not importable" testId="ide-import-behavioral-warning">
                      Detected: {detectedBehavioralConstructs.join(', ')}. The source remains visible, and replacement will be blocked.
                    </IdeCallout>
                  ) : null}
                  <textarea
                    ref={hdlTextareaRef}
                    data-testid="ide-import-hdl-textarea"
                    value={hdlText}
                    onChange={(event) => setHdlText(event.target.value)}
                    onScroll={handleHdlScroll}
                    onKeyDown={handleHdlKeyDown}
                    aria-describedby="ide-import-hdl-editor-keyboard-help"
                    placeholder="Paste structural VHDL or Verilog. Behavioral process/always constructs are detected before replacement."
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                  <p
                    id="ide-import-hdl-editor-keyboard-help"
                    className="ide-import-v3__keyboard-help"
                    data-testid="ide-import-hdl-editor-keyboard-help"
                  >
                    Keyboard: Tab indents, Shift+Tab outdents, Ctrl+S parses, and Escape leaves the editor for the actions below.
                  </p>
                  <div className="ide-import-v3__editor-actions" ref={hdlEditorActionsRef}>
                    <IdeButton
                      tone={hasParsedHdl ? 'secondary' : 'primary'}
                      onClick={parseHdl}
                      disabled={!hdlText.trim()}
                      testId="ide-import-parse"
                    >
                      Parse HDL
                    </IdeButton>
                    <IdeButton tone="secondary" onClick={() => loadImportSample('and-gate')} testId="ide-import-load-sample-and-gate">
                      Structural sample
                    </IdeButton>
                    <IdeButton tone="ghost" onClick={() => loadImportSample('edge-detect')} testId="ide-import-load-sample-edge-detect">
                      Blocked sample
                    </IdeButton>
                  </div>
                </div>
              ) : null}

              {tab === 'xdc' ? (
                <div className="ide-import-v3__editor">
                  <textarea
                    ref={xdcTextareaRef}
                    data-testid="ide-import-xdc-input"
                    value={xdcText}
                    onChange={(event) => setXdcText(event.target.value)}
                    onScroll={handleXdcScroll}
                    placeholder="Paste XDC PACKAGE_PIN constraints here."
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                  <div className="ide-import-v3__editor-actions">
                    <IdeButton tone="secondary" onClick={() => parseXdc()} disabled={!xdcText.trim()} testId="ide-import-parse-xdc">
                      Parse XDC
                    </IdeButton>
                    <IdeButton tone="ghost" onClick={() => setTab('hdl')} testId="ide-import-back-hdl">Back to HDL</IdeButton>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {!showVerifyResetNotice && hasParsedHdl && !pendingApplyProject ? (
            <section className="ide-import-v3__review" data-testid="ide-import-review-shell" aria-labelledby="ide-import-v3-review-title">
              <header className="ide-import-v3__section-header">
                <div>
                  <p className="ide-surface-block-label">2 · Review</p>
                  <h3 id="ide-import-v3-review-title">Inspect the import candidate</h3>
                </div>
                <strong>
                  {detectedBehavioralConstructs.length > 0
                    ? 'Ready to review; replacement blocked'
                    : canImport
                      ? 'Ready for replacement review'
                      : 'Resolve required mappings'}
                </strong>
              </header>

              <div className="ide-import-v3__review-facts">
                <div><span>Entity</span><strong>{parsedEntityName}</strong></div>
                <div><span>Fidelity</span><strong>{reviewModeLabel}</strong></div>
                <div><span>Ports</span><strong>{inputCount} in · {outputCount} out</strong></div>
                <div data-testid="ide-import-board-detection">
                  <span>Board</span>
                  <strong>{boardDetection ? boardDetection.board : 'Not detected'}</strong>
                  <small>{boardDetection ? boardDetection.confidence : 'No XDC evidence'}</small>
                </div>
              </div>

              {effectiveReconstructionLevel === 'ports-only' ? (
                <IdeCallout tone="warn" title="Ports only — no internal circuit" testId="ide-import-ports-only-warning">
                  <p className="ide-copy ide-copy--flush">
                    Internal logic was not reconstructed, so the circuit is empty. The project can preserve its top-level ports. Rebuild the circuit in Design before verification.
                  </p>
                  <div className="ide-inline-actions">
                    {onGoToDesign ? (
                      <IdeButton tone="secondary" onClick={onGoToDesign} testId="ide-import-ports-only-go-design">
                        Rebuild in Design
                      </IdeButton>
                    ) : null}
                    {onGoToExport ? (
                      <IdeButton tone="ghost" onClick={onGoToExport} testId="ide-import-go-to-export">
                        Open Build &amp; Export
                      </IdeButton>
                    ) : null}
                  </div>
                </IdeCallout>
              ) : effectiveReconstructionLevel === 'full' ? (
                <div className="ide-import-v3__reconstruction" data-testid="ide-import-recon-full">
                  <strong>Structural HDL circuit reconstructed</strong>
                  <span>Gates and connections are available in the schematic preview.</span>
                </div>
              ) : null}

              {warnings.length > 0 ? (
                <IdeCallout tone="warn" title="Review parser warnings" testId="ide-import-warning-list">
                  <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </IdeCallout>
              ) : null}

              {blockingErrors.length > 0 ? (
                <IdeCallout tone="error" title="Required repairs" testId="ide-import-blocking-errors">
                  <ul>{blockingErrors.map((error) => <li key={error}>{error}</li>)}</ul>
                </IdeCallout>
              ) : null}

              <div className="ide-import-v3__review-workspace">
                <section data-testid="ide-import-ports-table">
                  <header>
                    <div><p className="ide-surface-block-label">Port mapping</p><h4>Entity ports to board pins</h4></div>
                    {canApplySuggestions ? (
                      <IdeButton tone="secondary" onClick={applySuggestions} testId="ide-import-apply-pins-only">Apply suggestions</IdeButton>
                    ) : null}
                  </header>
                  <IdeDataTable
                    columns={['Entity Port', 'Board Pin', 'Direction', 'Width', 'Confidence', 'Status']}
                    rows={portRows}
                  />
                </section>
                <section className="ide-import-v3__schematic" data-testid="ide-import-schematic-preview">
                  <header><p className="ide-surface-block-label">Schematic preview</p><h4>{parsedEntityName}</h4></header>
                  <ImportSchematicPreview parsedHdl={parsedHdl} mapping={mapping} />
                </section>
              </div>

              <div className="ide-import-v3__review-actions">
                <p>{statusMessage}</p>
                <div>
                  <IdeButton
                    tone="primary"
                    onClick={requestApplyProject}
                    disabled={!canImport}
                    testId="ide-import-replace-project"
                  >
                    Review replacement
                  </IdeButton>
                  <IdeButton tone="secondary" onClick={() => setTab('hdl')} testId="ide-import-review-edit-source">
                    Edit source
                  </IdeButton>
                </div>
              </div>
            </section>
          ) : null}

          {!showVerifyResetNotice && pendingApplyProject && commitPreview ? (
            <section className="ide-import-v3__apply" data-testid="ide-import-commit-preview" aria-labelledby="ide-import-v3-apply-title">
              <header className="ide-import-v3__section-header">
                <div><p className="ide-surface-block-label">3 · Apply</p><h3 id="ide-import-v3-apply-title">Confirm project replacement</h3></div>
                <strong>{hasImportBlocker ? 'Blocked' : 'Ready to apply'}</strong>
              </header>
              <div className="ide-import-v3__apply-facts">
                <div><span>Incoming entity</span><strong>{commitPreview.entityName}</strong></div>
                <div><span>Reconstruction</span><strong>{commitPreview.reconstructionLevel}</strong></div>
                <div><span>Circuit</span><strong>{commitPreview.nodeCount} nodes · {commitPreview.connectionCount} connections</strong></div>
                <div><span>Port mapping</span><strong>{commitPreview.mappedCount}/{commitPreview.totalPorts} mapped</strong></div>
              </div>
              <div className="ide-import-v3__replacement">
                <div>
                  <span>Added ports</span>
                  <strong>{commitPreview.addedPorts.length > 0 ? commitPreview.addedPorts.map((port) => port.name).join(', ') : 'None'}</strong>
                </div>
                <div>
                  <span>Removed ports</span>
                  <strong>{commitPreview.removedPortNames.length > 0 ? commitPreview.removedPortNames.join(', ') : 'None'}</strong>
                </div>
              </div>

              {hasImportBlocker ? (
                <IdeCallout tone="error" title="Replacement blocked" testId="ide-import-behavioral-blocker">
                  <ul>{importBlockerReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  {onGoToDesign ? (
                    <IdeButton tone="secondary" onClick={onGoToDesign} testId="ide-import-blocker-go-design">
                      Open Design to rebuild
                    </IdeButton>
                  ) : null}
                </IdeCallout>
              ) : (
                <IdeCallout tone="warn" title="This replaces the active project" testId="ide-import-review-before-replace">
                  Cancel keeps the current project unchanged. Confirm applies only the candidate shown above.
                </IdeCallout>
              )}

              <div className="ide-import-v3__apply-actions">
                <IdeButton tone="secondary" onClick={cancelApplyProject} testId="ide-import-apply-cancel">
                  Cancel · keep current project
                </IdeButton>
                <IdeButton tone="primary" onClick={confirmApplyProject} disabled={hasImportBlocker} testId="ide-import-apply-confirm">
                  Confirm replacement
                </IdeButton>
              </div>
            </section>
          ) : null}
        </section>
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

function workflowTone(state: ImportWorkflowStepState): 'idle' | 'ok' | 'warn' | 'error' {
  if (state === 'done') return 'ok';
  if (state === 'active') return 'warn';
  if (state === 'blocked') return 'error';
  return 'idle';
}

function workflowLabel(state: ImportWorkflowStepState): string {
  if (state === 'done') return 'Done';
  if (state === 'active') return 'Current';
  if (state === 'blocked') return 'Blocked';
  return 'Pending';
}

function detectImportBoard(input: {
  xdcResult: XdcParseResult | null;
  zipInspection: ZipImportInspection | null;
}): ImportBoardDetection | null {
  if (input.zipInspection?.importMode === 'manifest' && input.zipInspection.project.fpga?.board === 'basys3') {
    return {
      board: 'Basys3',
      confidence: 'High',
      reason: 'The embedded RedByte manifest targets the Basys3 classroom board.',
    };
  }

  const pinEntries = input.xdcResult?.pinEntries ? Object.values(input.xdcResult.pinEntries) : [];
  if (pinEntries.length === 0) return null;
  const strongPins = pinEntries.filter((entry) => entry.confidence === 'strong').length;
  if (strongPins === 0) {
    return {
      board: 'Basys3',
      confidence: 'Low',
      reason: 'Pins were parsed, but none matched the known Basys3 package-pin table.',
    };
  }

  const ratio = strongPins / pinEntries.length;
  const confidence: ImportBoardDetection['confidence'] =
    ratio >= 0.95 ? 'High' : ratio >= 0.6 ? 'Medium' : 'Low';

  return {
    board: 'Basys3',
    confidence,
    reason: `${strongPins}/${pinEntries.length} parsed XDC pin${pinEntries.length === 1 ? '' : 's'} match the Basys3 package-pin table.`,
  };
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
  compilerStatus: string;
  compilerDiagnostics: ImportedProjectCompilerResult['compilerDiagnostics'];
}): string {
  const {
    parsedEntityName,
    ports,
    mapping,
    warnings,
    blockingErrors,
    compilerStatus,
    compilerDiagnostics,
  } = params;
  const lines: string[] = [];
  lines.push('RedByte Import Diagnostics');
  lines.push(`Entity: ${parsedEntityName}`);
  lines.push(`Compiler: ${compilerStatus}`);
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
  lines.push('Compiler Diagnostics:');
  if (compilerDiagnostics.length === 0) {
    lines.push('- none');
  } else {
    for (const diagnostic of compilerDiagnostics) {
      lines.push(`- [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`);
    }
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
