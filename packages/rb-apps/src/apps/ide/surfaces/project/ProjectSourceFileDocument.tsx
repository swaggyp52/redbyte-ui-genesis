import React, { useEffect, useMemo, useRef } from 'react';
import { capabilityFor } from '../../languageCapability';
import type { EngineeringObjectRef } from '../../engineeringSelection';
import type { SourceFile } from '../../projectSourceModel';
import { crossProbeQualityLabel, linksForSource, type CrossProbeIndex, type CrossProbeLink } from '../../sourceCrossProbe';

export interface ProjectSourceFileDocumentProps {
  readonly file: SourceFile | null;
  readonly fileId: string;
  readonly crossProbe: CrossProbeIndex | null;
  readonly selected: EngineeringObjectRef | null;
  readonly onSelect: (ref: EngineeringObjectRef) => void;
}

/**
 * Read-only source document: preserved bytes with line numbers, the file's
 * capability tier once, and its design relationships as navigable rows.
 * Selecting a relationship publishes the linked design object and scrolls the
 * line into view; the source itself is never edited here (bytes are preserved).
 */
export const ProjectSourceFileDocument: React.FC<ProjectSourceFileDocumentProps> = ({ file, fileId, crossProbe, selected, onSelect }) => {
  const codeRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => (file ? file.text.split(/\r?\n/) : []), [file]);
  const links = useMemo(() => (crossProbe && file ? linksForSource(crossProbe, file.id) : []), [crossProbe, file]);
  const linkedLines = useMemo(() => {
    const map = new Map<number, CrossProbeLink[]>();
    for (const link of links) {
      if (!link.range) continue;
      const list = map.get(link.range.start.line) ?? [];
      list.push(link);
      map.set(link.range.start.line, list);
    }
    return map;
  }, [links]);
  const selectedLine = selected?.kind === 'source-range' && selected.fileId === fileId ? selected.range.start.line : null;

  useEffect(() => {
    if (selectedLine === null) return;
    const row = codeRef.current?.querySelector<HTMLElement>(`[data-line="${selectedLine}"]`);
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' });
  }, [selectedLine]);

  if (!file) {
    return (
      <div className="rb-doc" data-testid="ide-project-source-file-document">
        <div className="wb-empty"><strong>Source file not found.</strong><span>The file <code>{fileId}</code> is no longer in the project.</span></div>
      </div>
    );
  }

  const capability = capabilityFor(file.language);

  return (
    <div className="rb-doc rb-source-doc" data-testid="ide-project-source-file-document" data-file-id={file.id}>
      <header className="rb-doc-header">
        <h2 className="rb-doc-title is-mono">{file.path}</h2>
        <span className="wb-toolbar-meta">{file.language} · {file.fileset} · {file.library} · {lines.length} lines · {capability.tier}</span>
      </header>
      <div className="rb-source-doc-body">
        <div ref={codeRef} className="rb-code" role="region" aria-label={`Source of ${file.path}`} data-testid="ide-project-source-code">
          {lines.map((text, index) => {
            const line = index + 1;
            const lineLinks = linkedLines.get(line);
            const isSelected = selectedLine === line;
            return (
              <div
                key={line}
                className={`rb-code-line${isSelected ? ' is-selected' : ''}${lineLinks ? ' has-link' : ''}`}
                data-line={line}
                onClick={() => onSelect({ kind: 'source-range', fileId: file.id, range: { start: { line, column: 1 }, end: { line, column: Math.max(1, text.length) } } })}
              >
                <span className="rb-code-gutter">{line}</span>
                <span className="rb-code-text">{text || ' '}</span>
              </div>
            );
          })}
        </div>
        <aside className="rb-source-doc-links" aria-label="Design relationships">
          <header className="rb-doc-section-header"><span>Relationships</span><span className="wb-toolbar-spacer" /><span className="wb-toolbar-meta">{links.length}</span></header>
          {links.length === 0 ? (
            <div className="wb-empty">No design element resolves to this file.</div>
          ) : (
            <ul className="rb-link-list" data-testid="ide-project-source-links">
              {links.map((link, index) => {
                const quality = link.quality ?? 'partial';
                return (
                  <li key={`${link.kind}-${link.elementKey ?? link.nodeId ?? index}`}>
                    <button
                      type="button"
                      className="wb-tree-row"
                      data-quality={quality}
                      onClick={() => {
                        if (link.range) onSelect({ kind: 'source-range', fileId: file.id, range: link.range });
                        if (link.nodeId) onSelect({ kind: 'node', moduleId: link.moduleId ?? 'top', nodeId: link.nodeId });
                        else if (link.kind === 'module' && link.moduleId) onSelect({ kind: 'module', moduleId: link.moduleId });
                      }}
                    >
                      <span className="wb-tree-chevron" aria-hidden="true" />
                      <span className="wb-tree-icon"><code className="wb-tree-meta">{link.kind}</code></span>
                      <span className="wb-tree-label"><code>{link.label ?? link.elementKey ?? link.nodeId}</code><code className="wb-tree-meta">{link.range ? `L${link.range.start.line}` : 'no range'}</code></span>
                      <span className="wb-mark" data-tone={quality === 'exact' ? 'ok' : quality === 'partial' ? 'warn' : quality === 'ambiguous' ? 'error' : 'muted'} title={crossProbeQualityLabel(quality)} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
};
