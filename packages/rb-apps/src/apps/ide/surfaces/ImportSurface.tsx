import React, { useMemo, useState } from 'react';
import { parseVhdl } from '../../../import/vhdlImport';
import { parseVerilog } from '../../../import/verilogImport';
import { parseXdcPins, type XdcParseResult } from '../../../import/xdcImport';
import { importToRbProject } from '../../../import/importToRbProject';
import type { ParsedHDL } from '../../../import/hdlToCircuit';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
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

export const ImportSurface: React.FC = () => {
  const [tab, setTab] = useState<ImportTab>('hdl');
  const [language, setLanguage] = useState<HdlLanguage>('auto');
  const [hdlText, setHdlText] = useState('');
  const [xdcText, setXdcText] = useState('');
  const [parsedHdl, setParsedHdl] = useState<ParsedHDL | null>(null);
  const [xdcResult, setXdcResult] = useState<XdcParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string>('Paste HDL to begin import.');
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');

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
    if (parsedHdl?.warnings?.length) warningRows.push(...parsedHdl.warnings);
    if (xdcResult?.warnings?.length) warningRows.push(...xdcResult.warnings);
    return warningRows;
  }, [parsedHdl, xdcResult]);

  const hasParsedHdl = parsedHdl !== null;
  const hasParsedXdc = xdcResult !== null;
  const canApplySuggestions = useMemo(
    () => unmappedPorts.some((port) => Boolean(suggestBasys3Alias(port.name, port.direction))),
    [unmappedPorts]
  );
  const canImport = hasParsedHdl && blockingErrors.length === 0;

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

  const parseHdl = () => {
    const source = hdlText.trim();
    if (!source) {
      setStatusMessage('Paste HDL before parsing.');
      return;
    }
    try {
      const effectiveLang =
        language === 'auto' ? detectHdlLanguage(source) : (language as 'vhdl' | 'verilog');
      const parsed = effectiveLang === 'vhdl' ? parseVhdl(source) : parseVerilog(source);
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
  };

  const parseXdc = () => {
    const source = xdcText.trim();
    if (!source) {
      setStatusMessage('Paste XDC before parsing.');
      return;
    }
    try {
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

  const importToProject = () => {
    if (!parsedHdl || !canImport) return;
    const project = importToRbProject(parsedHdl, xdcResult ?? undefined);
    setStatusMessage(
      `RBProject ready: ${project.circuit.nodes.length} nodes, ${project.circuit.connections.length} connections.`
    );
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
      inspector={
        <>
          <IdeInspectorSection title="Pipeline Stage">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>HDL Parsed</span>
                <IdeStatusPill tone={hasParsedHdl ? 'ok' : 'idle'}>
                  {hasParsedHdl ? 'READY' : 'WAITING'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>XDC Parsed</span>
                <IdeStatusPill tone={hasParsedXdc ? 'ok' : 'idle'}>
                  {hasParsedXdc ? 'READY' : 'OPTIONAL'}
                </IdeStatusPill>
              </div>
              <div className="ide-kv-row">
                <span>Mapped Ports</span>
                <span>
                  {ports.length - unmappedPorts.length}/{ports.length}
                </span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Next Step">
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
        title="Import Truth Screen"
        description="Paste HDL and XDC, resolve deterministic diagnostics, then import with confidence."
        actions={
          <>
            <IdeButton tone="secondary" onClick={parseHdl} testId="ide-import-parse">
              Parse HDL
            </IdeButton>
            <IdeButton tone="secondary" onClick={parseXdc} testId="ide-import-parse-xdc">
              Parse XDC
            </IdeButton>
            <IdeButton
              tone="ghost"
              onClick={applySuggestions}
              disabled={!canApplySuggestions}
              testId="ide-import-apply-mapping"
            >
              Apply suggestions
            </IdeButton>
            <IdeButton tone="ghost" onClick={copyDiagnostics} testId="ide-import-copy-diagnostics">
              Copy report
            </IdeButton>
            <span data-testid="ide-primary-cta">
              <IdeButton
                tone="primary"
                onClick={importToProject}
                disabled={!canImport}
                testId="ide-import-build-project"
              >
                Import to Project
              </IdeButton>
            </span>
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
        <IdeGrid columns={2} testId="ide-import-pipeline-grid">
          <section className="ide-import-stage-col" data-testid="ide-import-inputs">
            <IdeSectionHeader title="Inputs" meta="Stage 1" />
            <div className="ide-export-artifact-tabs">
              <button
                type="button"
                className={`ide-export-artifact-tab ${tab === 'hdl' ? 'is-active' : ''}`}
                onClick={() => setTab('hdl')}
                data-testid="ide-import-tab-hdl"
              >
                HDL
              </button>
              <button
                type="button"
                className={`ide-export-artifact-tab ${tab === 'xdc' ? 'is-active' : ''}`}
                onClick={() => setTab('xdc')}
                data-testid="ide-import-tab-xdc"
              >
                XDC
              </button>
              <button
                type="button"
                className={`ide-export-artifact-tab ${tab === 'upload' ? 'is-active' : ''}`}
                disabled
                data-testid="ide-import-tab-upload"
              >
                Upload ZIP (Soon)
              </button>
            </div>

            {tab === 'hdl' && (
              <div className="ide-import-editor">
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
                <textarea
                  className="ide-import-textarea"
                  value={hdlText}
                  onChange={(event) => setHdlText(event.target.value)}
                  placeholder="Paste module/entity source here."
                  spellCheck={false}
                  data-testid="ide-import-hdl-input"
                />
              </div>
            )}

            {tab === 'xdc' && (
              <div className="ide-import-editor">
                <textarea
                  className="ide-import-textarea"
                  value={xdcText}
                  onChange={(event) => setXdcText(event.target.value)}
                  placeholder="Paste XDC constraints here."
                  spellCheck={false}
                  data-testid="ide-import-xdc-input"
                />
              </div>
            )}

            {tab === 'upload' && (
              <div className="ide-empty-stack">
                <div className="ide-empty-illustration ide-empty-illustration-import" aria-hidden="true" />
                <IdeCallout tone="info" title="ZIP Import Pending">
                  ZIP import is intentionally disabled in v1 to keep deterministic parsing strict.
                </IdeCallout>
              </div>
            )}
          </section>

          <section className="ide-import-stage-col" data-testid="ide-import-diagnostics-panel">
            <IdeSectionHeader title="Diagnostics + Preview" meta="Stage 2/3" />
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

            <section className="ide-export-section" data-testid="ide-import-unmapped-list">
              <IdeSectionHeader title="Unmapped Ports" meta={`${unmappedPorts.length} remaining`} />
              {unmappedPorts.length > 0 ? (
                <ul className="ide-list">
                  {unmappedPorts.map((port) => {
                    const suggestion = suggestBasys3Alias(port.name, port.direction);
                    return (
                      <li key={port.name}>
                        <code>{port.name}</code> - {suggestion ? `Suggested: ${suggestion.pin}` : 'No automatic alias'}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <IdeCallout tone="success" title="All required ports mapped">
                  Required ports are fully mapped and ready for import.
                </IdeCallout>
              )}
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
              ) : (
                <IdeCallout tone="info" title="No warnings">No parser warnings detected yet.</IdeCallout>
              )}
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
              ) : (
                <IdeCallout tone="success" title="No blocking errors">
                  Import can proceed once you click "Import to Project."
                </IdeCallout>
              )}
            </section>

            <section className="ide-export-section">
              <IdeSectionHeader title="Preview Schematic" meta="v1 preview" />
              <div className="ide-waveform-stub" data-testid="ide-import-schematic-preview">
                <span />
                <span />
                <span />
                <span />
              </div>
            </section>
          </section>
        </IdeGrid>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};

function detectHdlLanguage(source: string): 'vhdl' | 'verilog' {
  const lowered = source.toLowerCase();
  if (lowered.includes('entity') && lowered.includes('architecture')) return 'vhdl';
  if (lowered.includes('module') && lowered.includes('endmodule')) return 'verilog';
  return lowered.includes('entity') ? 'vhdl' : 'verilog';
}

function inferPortWidth(typeName: string): string {
  const normalized = typeName.trim().toLowerCase();
  const vectorMatch = normalized.match(/\[(\d+)\s*:\s*(\d+)\]/);
  if (vectorMatch) {
    const left = Number(vectorMatch[1]);
    const right = Number(vectorMatch[2]);
    return String(Math.abs(left - right) + 1);
  }
  if (normalized.includes('vector')) return 'bus';
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
