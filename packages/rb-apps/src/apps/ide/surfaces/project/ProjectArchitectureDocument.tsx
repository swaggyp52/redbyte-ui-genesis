import React, { useMemo, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { sameEngineeringObject, type EngineeringObjectRef } from '../../engineeringSelection';
import { parseBusLabel } from '../../engineeringRelationships';
import { TOP_MODULE_ID, type ProjectHierarchyDocument } from '../../projectHierarchy';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import { ArchitecturePreview, type ArchitectureTraceMode } from './ArchitecturePreview';
import type { ProjectMappingRowLike } from './projectWorkbenchModel';

export interface ProjectArchitectureDocumentProps {
  readonly topModuleName: string;
  readonly circuit: Circuit | undefined;
  readonly hierarchy: ProjectHierarchyDocument | undefined;
  readonly ioLabelByNodeId: ReadonlyMap<string, string>;
  readonly moduleNameByNodeId: ReadonlyMap<string, string>;
  readonly mappingRows: readonly ProjectMappingRowLike[];
  readonly selected: EngineeringObjectRef | null;
  readonly onSelect: (ref: EngineeringObjectRef) => void;
  readonly onOpenDocument: (doc: WorkbenchDocument) => void;
}

interface ModuleEntry {
  readonly id: string;
  readonly name: string;
  readonly circuit: Circuit;
  readonly instanceCount: number;
  readonly ports: readonly { readonly name: string; readonly direction: string; readonly width: number; readonly range?: { left: number; right: number } }[];
}

interface InstanceEntry {
  readonly nodeId: string;
  readonly instanceName: string;
  readonly moduleId: string;
  readonly moduleName: string;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Architecture document — the same hierarchy and relationship data Design
 * uses, presented as a module tree, the selected module's block view and its
 * interface table. Selecting a block or an instance publishes the engineering
 * object; "Open in Design" opens the schematic for the module under review.
 */
export const ProjectArchitectureDocument: React.FC<ProjectArchitectureDocumentProps> = ({
  topModuleName,
  circuit,
  hierarchy,
  ioLabelByNodeId,
  moduleNameByNodeId,
  mappingRows,
  selected,
  onSelect,
  onOpenDocument,
}) => {
  const [moduleId, setModuleId] = useState<string>(TOP_MODULE_ID);

  const modules = useMemo<ModuleEntry[]>(() => {
    const defs = hierarchy?.modules ?? [];
    const instancesByModule = new Map<string, number>();
    for (const node of circuit?.nodes ?? []) {
      const definitionId = readString(node.config?.moduleDefinitionId);
      if (definitionId) instancesByModule.set(definitionId, (instancesByModule.get(definitionId) ?? 0) + 1);
    }
    const top: ModuleEntry[] = circuit
      ? [
          {
            id: TOP_MODULE_ID,
            name: topModuleName,
            circuit,
            instanceCount: 0,
            ports: mappingRows.map((row) => ({
              name: row.label,
              direction: row.direction === 'in' ? 'in' : 'out',
              width: 1,
            })),
          },
        ]
      : [];
    return top.concat(
      defs.map((def) => ({
        id: def.id,
        name: def.displayName || def.name,
        circuit: def.circuit,
        instanceCount: instancesByModule.get(def.id) ?? 0,
        ports: def.ports.map((port) => ({ name: port.name, direction: String(port.direction), width: port.width, range: port.range })),
      }))
    );
  }, [circuit, hierarchy?.modules, mappingRows, topModuleName]);

  const instances = useMemo<InstanceEntry[]>(() => {
    const defs = new Map((hierarchy?.modules ?? []).map((def) => [def.id, def]));
    return (circuit?.nodes ?? [])
      .map((node) => {
        const definitionId = readString(node.config?.moduleDefinitionId);
        const def = definitionId ? defs.get(definitionId) : undefined;
        if (!def) return null;
        return {
          nodeId: node.id,
          instanceName: readString(node.config?.instanceName) || node.label || node.id,
          moduleId: def.id,
          moduleName: def.displayName || def.name,
        };
      })
      .filter((entry): entry is InstanceEntry => entry !== null);
  }, [circuit?.nodes, hierarchy?.modules]);

  const current = modules.find((entry) => entry.id === moduleId) ?? modules[0] ?? null;

  // Interface rows: top-level ports group into buses by their `NAME[i]` labels.
  const interfaceRows = useMemo(() => {
    if (!current) return [];
    if (current.id !== TOP_MODULE_ID) {
      return current.ports.map((port) => ({
        key: port.name,
        name: port.name,
        direction: port.direction,
        width: port.width,
        bits: port.width > 1 && port.range ? `${port.range.left}:${port.range.right}` : '',
        pin: '',
        ref: null as EngineeringObjectRef | null,
      }));
    }
    const buses = new Map<string, { direction: string; bits: number[]; pins: string[] }>();
    const scalars: typeof interfaceRowsSeed = [];
    for (const row of mappingRows) {
      const bus = parseBusLabel(row.label);
      if (bus) {
        const entry = buses.get(bus.name) ?? { direction: row.direction, bits: [], pins: [] };
        entry.bits.push(bus.bit);
        entry.pins.push(row.pin.trim() || '—');
        buses.set(bus.name, entry);
      } else {
        scalars.push({
          key: row.id,
          name: row.label,
          direction: row.direction,
          width: 1,
          bits: '',
          pin: row.pin.trim() || (row.required ? 'unmapped' : '—'),
          ref: { kind: 'signal', fieldId: row.id, runSignal: null, nodeId: row.nodeId },
        });
      }
    }
    const busRows = Array.from(buses.entries()).map(([name, entry]) => {
      const sorted = [...entry.bits].sort((a, b) => b - a);
      return {
        key: `bus:${name}`,
        name: `${name}[${sorted[0]}:${sorted[sorted.length - 1]}]`,
        direction: entry.direction,
        width: entry.bits.length,
        bits: `${sorted[0]}:${sorted[sorted.length - 1]}`,
        pin: entry.pins.join(' '),
        ref: null as EngineeringObjectRef | null,
      };
    });
    return busRows.concat(scalars);
  }, [current, mappingRows]);

  const selectedNodeId = selected?.kind === 'node' ? selected.nodeId : selected?.kind === 'signal' ? selected.nodeId ?? null : null;
  // Trace around the selected block: drivers (upstream), loads (downstream), or the whole path.
  const [trace, setTrace] = useState<ArchitectureTraceMode | null>(null);
  const toggleTrace = (mode: ArchitectureTraceMode) => setTrace((current) => (current === mode ? null : mode));
  const currentIoLabels = current?.id === TOP_MODULE_ID ? ioLabelByNodeId : buildModuleIoLabels(current);
  const currentModuleNames = current?.id === TOP_MODULE_ID ? moduleNameByNodeId : new Map<string, string>();

  return (
    <div className="rb-doc rb-project-architecture" data-testid="ide-project-architecture-document">
      <header className="rb-doc-header">
        <h2 className="rb-doc-title">Architecture</h2>
        <span className="rb-doc-header-sep" aria-hidden="true" />
        <code className="rb-doc-header-code">{current ? current.name : topModuleName}</code>
        <span className="wb-toolbar-meta">
          {current ? `${current.circuit.nodes.length} components · ${current.circuit.connections.length} nets` : 'no circuit'}
        </span>
        <span className="wb-toolbar-spacer" />
        <div className="wb-segment" role="group" aria-label="Trace" data-testid="ide-project-architecture-trace">
          {([
            ['drivers', 'Drivers', 'Isolate the blocks that drive the selected block'],
            ['loads', 'Loads', 'Isolate the blocks the selected block drives'],
            ['path', 'Path', 'Isolate the full path through the selected block'],
          ] as const).map(([mode, label, title]) => (
            <button
              key={mode}
              type="button"
              className="wb-btn"
              onClick={() => toggleTrace(mode)}
              disabled={!selectedNodeId}
              aria-pressed={trace === mode}
              title={selectedNodeId ? title : 'Select a block first'}
              data-testid={`ide-project-architecture-trace-${mode}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="wb-btn"
          onClick={() => onOpenDocument({ kind: 'schematic', moduleId: current?.id ?? TOP_MODULE_ID })}
          data-testid="ide-project-architecture-open-design"
        >
          Open in Design
        </button>
      </header>
      <div className="rb-project-architecture-body">
        <section className="rb-project-architecture-tree" aria-label="Module tree">
          <header className="rb-doc-section-header"><span>Modules</span><span className="wb-toolbar-spacer" /><span className="wb-toolbar-meta">{modules.length}</span></header>
          <div role="tree" aria-label="Modules" className="wb-tree">
            {modules.map((entry) => {
              const isCurrent = entry.id === (current?.id ?? '');
              const moduleInstances = entry.id === TOP_MODULE_ID ? instances : [];
              return (
                <React.Fragment key={entry.id}>
                  <button
                    type="button"
                    role="treeitem"
                    className="wb-tree-row"
                    aria-selected={isCurrent}
                    data-testid={`ide-project-architecture-module-${entry.id}`}
                    style={{ ['--wb-depth' as string]: 0 }}
                    onClick={() => {
                      setModuleId(entry.id);
                      onSelect({ kind: 'module', moduleId: entry.id });
                    }}
                    onDoubleClick={() => onOpenDocument({ kind: 'schematic', moduleId: entry.id })}
                  >
                    <span className="wb-tree-chevron" aria-hidden="true" />
                    <span className="wb-tree-label">
                      <span>{entry.name}</span>
                      <code className="wb-tree-meta">
                        {entry.id === TOP_MODULE_ID ? 'top' : `${entry.instanceCount} instance${entry.instanceCount === 1 ? '' : 's'}`}
                      </code>
                    </span>
                  </button>
                  {moduleInstances.map((instance) => {
                    const ref: EngineeringObjectRef = { kind: 'node', moduleId: TOP_MODULE_ID, nodeId: instance.nodeId };
                    return (
                      <button
                        key={instance.nodeId}
                        type="button"
                        role="treeitem"
                        className="wb-tree-row"
                        aria-selected={sameEngineeringObject(selected, ref)}
                        data-testid={`ide-project-architecture-instance-${instance.nodeId}`}
                        style={{ ['--wb-depth' as string]: 1 }}
                        onClick={() => {
                          setModuleId(TOP_MODULE_ID);
                          onSelect(ref);
                        }}
                        onDoubleClick={() => onOpenDocument({ kind: 'schematic', moduleId: instance.moduleId })}
                        title={`${instance.instanceName} : ${instance.moduleName} — double-click opens the module`}
                      >
                        <span className="wb-tree-chevron" aria-hidden="true" />
                        <span className="wb-tree-label">
                          <span>{instance.instanceName}</span>
                          <code className="wb-tree-meta">{instance.moduleName}</code>
                        </span>
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </section>
        <section className="rb-project-architecture-stage" aria-label="Block view">
          {current && current.circuit.nodes.length > 0 ? (
            <ArchitecturePreview
              circuit={current.circuit}
              ioLabelByNodeId={currentIoLabels}
              moduleNameByNodeId={currentModuleNames}
              selectedNodeId={selectedNodeId}
              trace={selectedNodeId ? trace : null}
              onSelectNode={(nodeId) => onSelect({ kind: 'node', moduleId: current.id, nodeId })}
              onOpenDesign={() => onOpenDocument({ kind: 'schematic', moduleId: current.id })}
            />
          ) : (
            <div className="wb-empty"><strong>No circuit in this module.</strong></div>
          )}
        </section>
        <section className="rb-project-architecture-interface" aria-label="Interface">
          <header className="rb-doc-section-header">
            <span>Interface</span>
            <span className="wb-toolbar-spacer" />
            <span className="wb-toolbar-meta">{interfaceRows.length} ports</span>
          </header>
          <div className="wb-table-frame">
            <table className="wb-table" data-testid="ide-project-architecture-interface">
              <thead>
                <tr>
                  <th scope="col">Port</th>
                  <th scope="col">Dir</th>
                  <th scope="col">Width</th>
                  <th scope="col">Bits</th>
                  <th scope="col">Pin</th>
                </tr>
              </thead>
              <tbody>
                {interfaceRows.length === 0 ? (
                  <tr><td colSpan={5} className="wb-table-empty">No ports.</td></tr>
                ) : (
                  interfaceRows.map((row) => (
                    <tr
                      key={row.key}
                      aria-selected={row.ref ? sameEngineeringObject(selected, row.ref) : undefined}
                      onClick={() => row.ref && onSelect(row.ref)}
                      onDoubleClick={() => row.ref && onOpenDocument({ kind: 'board-io', constraintSetId: 'default' })}
                    >
                      <td className="is-mono">{row.name}</td>
                      <td className="is-mono">{row.direction}</td>
                      <td className="is-mono">{row.width}</td>
                      <td className="is-mono">{row.bits}</td>
                      <td className="is-mono">{row.pin}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

const interfaceRowsSeed: {
  key: string;
  name: string;
  direction: string;
  width: number;
  bits: string;
  pin: string;
  ref: EngineeringObjectRef | null;
}[] = [];

/** A native module's I/O labels come from its INPUT/OUTPUT pin nodes' labels. */
function buildModuleIoLabels(module: ModuleEntry | null): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  if (!module) return map;
  for (const node of module.circuit.nodes) {
    if (node.type === 'INPUT' || node.type === 'OUTPUT') map.set(node.id, String(node.label ?? node.id));
  }
  return map;
}
