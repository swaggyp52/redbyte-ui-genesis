import React, { useMemo, useState } from 'react';
import { IdeSurfaceLayout } from '../components/IdeSurfaceLayout';
import {
  IdeButton,
  IdeCallout,
  IdeDataTable,
  IdeInspectorSection,
  IdePanel,
  IdeStatusPill,
} from '../components/IdePrimitives';

interface ParsedPort {
  name: string;
  direction: 'in' | 'out' | 'inout';
  width: string;
}

const PARSED_PORTS: ParsedPort[] = [
  { name: 'clk', direction: 'in', width: '1' },
  { name: 'rst', direction: 'in', width: '1' },
  { name: 'count_en', direction: 'in', width: '1' },
  { name: 'q2', direction: 'out', width: '1' },
  { name: 'q1', direction: 'out', width: '1' },
  { name: 'q0', direction: 'out', width: '1' },
];

const WARNING_LINES = [
  'Ignored XDC directive: set_property IOSTANDARD LVCMOS33 [get_ports clk]',
  'Ignored XDC directive: create_clock -period 10.000 [get_ports clk]',
];

const SUGGESTED_PINS: Record<string, string> = {
  clk: 'CLK100MHZ (W5)',
  rst: 'SW0 (V17)',
  count_en: 'SW1 (V16)',
  q0: 'LD0 (U16)',
  q1: 'LD1 (E19)',
  q2: 'LD2 (U19)',
};

export const ImportSurface: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'hdl' | 'xdc' | 'preview'>('hdl');
  const [mappedPorts, setMappedPorts] = useState<Record<string, string>>({
    clk: 'CLK100MHZ',
    rst: 'SW0',
    q0: 'LD0',
  });

  const unmappedPorts = useMemo(
    () => PARSED_PORTS.filter((port) => !mappedPorts[port.name]),
    [mappedPorts]
  );

  const parsedRows = useMemo(
    () =>
      PARSED_PORTS.map((port) => [
        <code key={`${port.name}-name`}>{port.name}</code>,
        port.direction.toUpperCase(),
        port.width,
        mappedPorts[port.name] ? (
          <IdeStatusPill key={`${port.name}-status`} tone="ok">
            Mapped
          </IdeStatusPill>
        ) : (
          <IdeStatusPill key={`${port.name}-status`} tone="warn">
            Unmapped
          </IdeStatusPill>
        ),
      ]),
    [mappedPorts]
  );

  const canBuildProject = unmappedPorts.length === 0;

  return (
    <IdeSurfaceLayout
      mode="import"
      inspector={
        <>
          <IdeInspectorSection title="Import State">
            <div className="ide-kv-list">
              <div className="ide-kv-row">
                <span>Parsed Ports</span>
                <span>{PARSED_PORTS.length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Unmapped</span>
                <span>{unmappedPorts.length}</span>
              </div>
              <div className="ide-kv-row">
                <span>Warnings</span>
                <span>{WARNING_LINES.length}</span>
              </div>
            </div>
          </IdeInspectorSection>

          <IdeInspectorSection title="Next Action">
            {canBuildProject ? (
              <IdeCallout tone="success" title="Ready to build">
                Parsed ports are mapped to Basys3 pins. Build RBProject to continue.
              </IdeCallout>
            ) : (
              <IdeCallout tone="warn" title="Mapping required">
                Map remaining ports before creating the RBProject.
              </IdeCallout>
            )}
          </IdeInspectorSection>
        </>
      }
    >
      <IdePanel
        title="Import Diagnostics"
        description="Parse HDL/XDC inputs and resolve Basys3 mapping issues before project creation."
        actions={
          <>
            <IdeButton tone="secondary" testId="ide-import-parse">
              Parse
            </IdeButton>
            <IdeButton tone="primary" disabled={!canBuildProject} testId="ide-import-build-project">
              Build RBProject
            </IdeButton>
            <IdeButton tone="ghost" disabled={unmappedPorts.length === 0} testId="ide-import-apply-mapping">
              Apply Mapping
            </IdeButton>
          </>
        }
        right={
          canBuildProject ? (
            <IdeStatusPill tone="ok">Ready</IdeStatusPill>
          ) : (
            <IdeStatusPill tone="warn">Needs Mapping</IdeStatusPill>
          )
        }
        testId="ide-import-panel"
      >
        <section className="ide-export-section">
          <header className="ide-export-section-header">
            <h3>Input Tabs</h3>
          </header>
          <div className="ide-export-artifact-tabs">
            <button
              type="button"
              className={`ide-export-artifact-tab ${selectedTab === 'hdl' ? 'is-active' : ''}`}
              onClick={() => setSelectedTab('hdl')}
            >
              HDL
            </button>
            <button
              type="button"
              className={`ide-export-artifact-tab ${selectedTab === 'xdc' ? 'is-active' : ''}`}
              onClick={() => setSelectedTab('xdc')}
            >
              XDC
            </button>
            <button
              type="button"
              className={`ide-export-artifact-tab ${selectedTab === 'preview' ? 'is-active' : ''}`}
              onClick={() => setSelectedTab('preview')}
            >
              Preview
            </button>
          </div>
        </section>

        <section className="ide-export-section" data-testid="ide-import-ports-table">
          <header className="ide-export-section-header">
            <h3>Parsed Ports</h3>
          </header>
          <IdeDataTable
            columns={['Port', 'Direction', 'Width', 'Mapping']}
            rows={parsedRows}
          />
        </section>

        <section className="ide-export-section" data-testid="ide-import-unmapped-list">
          <header className="ide-export-section-header">
            <h3>Unmapped Ports</h3>
          </header>
          {unmappedPorts.length > 0 ? (
            <ul className="ide-list">
              {unmappedPorts.map((port) => (
                <li key={port.name}>
                  <code>{port.name}</code> - Suggested: {SUGGESTED_PINS[port.name] ?? 'Manual mapping required'}
                  <div className="ide-inline-actions">
                    <IdeButton
                      tone="ghost"
                      onClick={() =>
                        setMappedPorts((prev) => ({
                          ...prev,
                          [port.name]: (SUGGESTED_PINS[port.name] ?? '').split(' ')[0],
                        }))
                      }
                    >
                      Apply Suggestion
                    </IdeButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <IdeCallout tone="success" title="All ports mapped">
              Basys3 mapping coverage is complete.
            </IdeCallout>
          )}
        </section>

        <section className="ide-export-section" data-testid="ide-import-warnings">
          <header className="ide-export-section-header">
            <h3>Warnings</h3>
          </header>
          <IdeCallout tone="warn" title="Constraint notes">
            <ul className="ide-list">
              {WARNING_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </IdeCallout>
        </section>

        <section className="ide-export-section">
          <header className="ide-export-section-header">
            <h3>Preview Schematic</h3>
          </header>
          <div className="ide-waveform-stub" data-testid="ide-import-schematic-preview">
            <span />
            <span />
            <span />
            <span />
          </div>
        </section>
      </IdePanel>
    </IdeSurfaceLayout>
  );
};
