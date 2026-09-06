import React from 'react';
import { capabilityFor } from '../../languageCapability';
import { sameEngineeringObject, type EngineeringObjectRef } from '../../engineeringSelection';
import { TOP_MODULE_ID, type ProjectHierarchyDocument } from '../../projectHierarchy';
import { deriveCompileOrder, isEmptyProjectSourceModel, type ProjectSourceModel } from '../../projectSourceModel';
import type { WorkbenchDocument } from '../../workbenchDocuments';
import { modulePortSignature, type CompileOrderRow } from './projectWorkbenchModel';
import type { Circuit } from '@redbyte/rb-logic-core';

export interface ProjectSourcesDocumentProps {
  readonly mode: 'sources' | 'compile-order';
  readonly topModuleName: string;
  readonly circuit: Circuit | undefined;
  readonly hierarchy: ProjectHierarchyDocument | undefined;
  readonly sourceModel: ProjectSourceModel | undefined;
  readonly compileOrder: readonly CompileOrderRow[];
  readonly selected: EngineeringObjectRef | null;
  readonly onSelect: (ref: EngineeringObjectRef) => void;
  readonly onOpenDocument: (doc: WorkbenchDocument) => void;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Sources / Filesets and Compile Order documents. Dense tables over the
 * source-model authority (imported HDL, constraints, scripts) and the native
 * visual modules. Rows select; double-click opens the object's document.
 */
export const ProjectSourcesDocument: React.FC<ProjectSourcesDocumentProps> = ({
  mode,
  topModuleName,
  circuit,
  hierarchy,
  sourceModel,
  compileOrder,
  selected,
  onSelect,
  onOpenDocument,
}) => {
  const modules = hierarchy?.modules ?? [];
  const hasFiles = Boolean(sourceModel && !isEmptyProjectSourceModel(sourceModel));
  const files = hasFiles && sourceModel ? deriveCompileOrder(sourceModel).concat(sourceModel.files.filter((file) => file.fileset === 'utility')) : [];

  if (mode === 'compile-order') {
    return (
      <div className="rb-doc" data-testid="ide-project-compile-order-document">
        <header className="rb-doc-header">
          <h2 className="rb-doc-title">Compile Order</h2>
          <span className="wb-toolbar-spacer" />
          <span className="wb-toolbar-meta">{compileOrder.length} units · derived from filesets and hierarchy</span>
        </header>
        <div className="wb-table-frame">
          <table className="wb-table" data-testid="ide-project-compile-order">
            <thead>
              <tr>
                <th scope="col" className="is-num">#</th>
                <th scope="col">Unit</th>
                <th scope="col">Kind</th>
                <th scope="col">Library</th>
                <th scope="col">Fileset</th>
                <th scope="col">Depends on</th>
              </tr>
            </thead>
            <tbody>
              {compileOrder.map((row) => {
                const isSelected = sameEngineeringObject(selected, row.ref);
                return (
                  <tr
                    key={`${row.order}:${row.unit}`}
                    aria-selected={isSelected}
                    data-testid={`ide-project-compile-row-${row.order}`}
                    onClick={() => onSelect(row.ref)}
                    onDoubleClick={() => row.open && onOpenDocument(row.open)}
                  >
                    <td className="is-num is-mono">{row.order}</td>
                    <td className="is-mono">{row.unit}</td>
                    <td>{row.kind}</td>
                    <td className="is-mono">{row.library}</td>
                    <td>{row.fileset}</td>
                    <td className="is-mono">{row.dependsOn.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="rb-doc" data-testid="ide-project-sources-document">
      <header className="rb-doc-header">
        <h2 className="rb-doc-title">Sources</h2>
        <span className="wb-toolbar-spacer" />
        <span className="wb-toolbar-meta">
          {modules.length + 1} visual module{modules.length === 0 ? '' : 's'}
          {hasFiles && sourceModel ? ` · ${sourceModel.files.length} file${sourceModel.files.length === 1 ? '' : 's'}` : ''}
        </span>
        <button type="button" className="wb-btn" onClick={() => onOpenDocument({ kind: 'compile-order' })} data-testid="ide-project-open-compile-order">
          Compile order
        </button>
      </header>

      <section className="rb-doc-section" aria-label="Visual modules">
        <header className="rb-doc-section-header"><span>Visual modules</span><span className="wb-toolbar-spacer" /><span className="wb-toolbar-meta">native · canvas-editable</span></header>
        <div className="wb-table-frame">
          <table className="wb-table" data-testid="ide-project-modules-table">
            <thead>
              <tr>
                <th scope="col">Module</th>
                <th scope="col">Ports</th>
                <th scope="col" className="is-num">Nodes</th>
                <th scope="col" className="is-num">Nets</th>
                <th scope="col" className="is-num">Instances</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {[{ id: TOP_MODULE_ID, name: topModuleName, ports: [] as { name: string; direction: 'input' | 'output'; width: number }[], circuit, top: true }, ...modules.map((module) => ({ id: module.id, name: module.displayName || module.name, ports: module.ports, circuit: module.circuit, top: false }))].map((module) => {
                const ref: EngineeringObjectRef = { kind: 'module', moduleId: module.id };
                const isSelected = sameEngineeringObject(selected, ref);
                const instances = module.top ? 0 : circuit ? circuit.nodes.filter((node) => readString(node.config?.moduleDefinitionId) === module.id).length : 0;
                return (
                  <tr
                    key={module.id}
                    aria-selected={isSelected}
                    data-testid={`ide-project-module-row-${module.id}`}
                    onClick={() => onSelect(ref)}
                    onDoubleClick={() => onOpenDocument({ kind: 'schematic', moduleId: module.id })}
                  >
                    <td className="is-mono">{module.name}</td>
                    <td className="is-mono" data-testid={`ide-project-module-ports-${module.id}`}>{module.top ? '—' : modulePortSignature(module.ports)}</td>
                    <td className="is-num is-mono">{module.circuit?.nodes.length ?? 0}</td>
                    <td className="is-num is-mono">{module.circuit?.connections.length ?? 0}</td>
                    <td className="is-num is-mono">{module.top ? '—' : instances}</td>
                    <td>{module.top ? 'top' : 'definition'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rb-doc-section" aria-label="Source files">
        <header className="rb-doc-section-header">
          <span>Files</span>
          <span className="wb-toolbar-spacer" />
          <span className="wb-toolbar-meta">{hasFiles ? 'preserved bytes · language capability shown per file' : 'no HDL, constraint, or script files in this project'}</span>
        </header>
        {hasFiles ? (
          <div className="wb-table-frame">
            <table className="wb-table" data-testid="ide-project-sources">
              <thead>
                <tr>
                  <th scope="col">Path</th>
                  <th scope="col">Fileset</th>
                  <th scope="col">Language</th>
                  <th scope="col">Library</th>
                  <th scope="col">Capability</th>
                  <th scope="col" className="is-num">Bytes</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const ref: EngineeringObjectRef = { kind: 'source-range', fileId: file.id, range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } };
                  const isSelected = sameEngineeringObject(selected, ref);
                  const capability = capabilityFor(file.language);
                  return (
                    <tr
                      key={file.id}
                      aria-selected={isSelected}
                      data-testid={`ide-project-source-${file.id}`}
                      data-language={file.language}
                      onClick={() => onSelect(ref)}
                      onDoubleClick={() => onOpenDocument({ kind: 'source-file', fileId: file.id })}
                    >
                      <td className="is-mono">{file.path}</td>
                      <td>{file.fileset}</td>
                      <td className="is-mono">{file.language}</td>
                      <td className="is-mono">{file.library}</td>
                      <td title={capability.notes} data-testid={`ide-project-source-tier-${file.id}`}>{capability.tier}</td>
                      <td className="is-num is-mono">{new TextEncoder().encode(file.text).length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
};
