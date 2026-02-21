import React, { useMemo, useRef, useState } from 'react';
import { parseVhdl } from '../../../import/vhdlImport';
import { parseVerilog } from '../../../import/verilogImport';
import { parseXdcPins, type XdcParseResult } from '../../../import/xdcImport';
import type { ParsedHDL } from '../../../import/hdlToCircuit';
import type { RBProject } from '../../../export/projectFormat';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  buildImportedProject,
  importVivadoZipFile,
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
}

export const ImportSurface: React.FC<ImportSurfaceProps> = ({ onImportProject }) => {
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
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle');
  const zipInputRef = useRef<HTMLInputElement | null>(null);

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
    if (zipInspection?.warnings?.length) warningRows.push(...zipInspection.warnings);
    return warningRows;
  }, [parsedHdl, xdcResult, zipInspection]);

  const hasParsedHdl = parsedHdl !== null;
  const hasParsedXdc = xdcResult !== null;
  const hasZipInspection = zipInspection !== null;
  const sourceFiles = useMemo(
    () => [
      { id: 'hdl', label: 'source.hdl', status: hasParsedHdl ? 'READY' : 'PENDING' },
      { id: 'xdc', label: 'constraints.xdc', status: hasParsedXdc ? 'READY' : 'OPTIONAL' },
      { id: 'zip', label: 'import.zip', status: hasZipInspection ? 'READY' : 'OPTIONAL' },
      { id: 'report', label: 'import-report.json', status: blockingErrors.length === 0 ? 'CLEAN' : 'BLOCKED' },
    ],
    [blockingErrors.length, hasParsedHdl, hasParsedXdc, hasZipInspection]
  );
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
      setZipInspection(null);
      setPendingApplyProject(null);
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
    return buildImportedProject({
      sourceName,
      topPath,
      topText,
      parsedHdl,
      xdcPath: zipInspection?.detectedXdcPath ?? (normalizedXdcText ? 'top.xdc' : undefined),
      xdcText: normalizedXdcText.length > 0 ? normalizedXdcText : undefined,
      xdcResult: xdcResult ?? undefined,
    });
  };

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
      setStatusMessage('ZIP import requires a .zip archive.');
      return;
    }
    setZipBusy(true);
    setPendingApplyProject(null);
    try {
      const inspection = await importVivadoZipFile(file);
      setZipInspection(inspection);
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
    } catch (error) {
      setZipInspection(null);
      setParsedHdl(null);
      setXdcResult(null);
      setStatusMessage(
        `ZIP import failed: ${error instanceof Error ? error.message : 'unknown error'}`
      );
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
        <section className="ide-import-file-tree" data-testid="ide-import-file-tree">
          <header className="ide-design-subheader">
            <h3>Source Files</h3>
            <span className="ide-copy">{sourceFiles.length}</span>
          </header>
          <div className="ide-export-file-tree-list">
            {sourceFiles.map((file) => (
              <button
                key={file.id}
                type="button"
                className={`ide-signal-row ${
                  (file.id === 'hdl' && tab === 'hdl') ||
                  (file.id === 'xdc' && tab === 'xdc') ||
                  (file.id === 'zip' && tab === 'upload')
                    ? 'is-active'
                    : ''
                }`}
                data-testid={`ide-import-file-tree-item-${file.id}`}
                onClick={() => {
                  if (file.id === 'hdl' || file.id === 'xdc') {
                    setTab(file.id);
                    return;
                  }
                  if (file.id === 'zip') {
                    setTab('upload');
                  }
                }}
              >
                <span>{file.label}</span>
                <span>{file.status}</span>
              </button>
            ))}
          </div>
          <IdeCallout tone={canImport ? 'success' : 'info'} title="Import Pipeline">
            Parse HDL, parse XDC, map ports, then import the RBProject graph.
          </IdeCallout>
        </section>
      }
      inspector={
        <>
          <IdeInspectorSection title="Pipeline Stage" defaultOpen>
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
                onClick={requestApplyProject}
                disabled={!canImport}
                testId="ide-import-build-project"
              >
                Apply to Project
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
        {pendingApplyProject ? (
          <IdeCallout tone="warn" title="Apply import to active project?" testId="ide-import-apply-confirmation">
            <p className="ide-copy">
              Applying this import replaces the current workspace project state.
            </p>
            <div className="ide-inline-actions">
              <IdeButton tone="ghost" onClick={cancelApplyProject} testId="ide-import-apply-cancel">
                Cancel
              </IdeButton>
              <IdeButton tone="primary" onClick={confirmApplyProject} testId="ide-import-apply-confirm">
                Confirm Apply
              </IdeButton>
            </div>
          </IdeCallout>
        ) : null}

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
                onClick={() => setTab('upload')}
                data-testid="ide-import-tab-upload"
              >
                Upload ZIP
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
              <div className="ide-empty-stack ide-import-zip-stage" data-testid="ide-import-zip-stage">
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
                    <div className="ide-kv-list">
                      <div className="ide-kv-row">
                        <span>Top HDL</span>
                        <code data-testid="ide-import-zip-top-path">{zipInspection.detectedTopPath}</code>
                      </div>
                      <div className="ide-kv-row">
                        <span>Language</span>
                        <span data-testid="ide-import-zip-top-language">
                          {zipInspection.detectedTopLanguage.toUpperCase()}
                        </span>
                      </div>
                      <div className="ide-kv-row">
                        <span>XDC</span>
                        <code data-testid="ide-import-zip-xdc-path">
                          {zipInspection.detectedXdcPath ?? 'not found'}
                        </code>
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
                  </section>
                ) : null}
              </div>
            )}
          </section>

          <section className="ide-import-stage-col" data-testid="ide-import-diagnostics-panel">
            <IdeSectionHeader title="Diagnostics + Preview" meta="Stage 2/3" />
            {!hasParsedHdl && (
              <IdeCallout tone="info" title="Nothing parsed yet" testId="ide-import-empty-state">
                Paste module/entity HDL in the editor and click Parse — or Upload a Vivado ZIP to
                auto-extract source and constraints.
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
