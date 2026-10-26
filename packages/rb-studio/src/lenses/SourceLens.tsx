import React, { useEffect, useMemo, useRef } from 'react';

/**
 * Source perspective: the generated VHDL the recording retained (or, with no recording, the
 * current design's generated source), with every line that a part drives marked in the gutter.
 * Spans are node-level today; a net's source is its driver's statement.
 */
export interface SourceSpanLite {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly nodeId: string;
  readonly definitionId?: string;
}

export interface SourceLensProps {
  readonly file: { readonly path: string; readonly text: string } | null;
  readonly spans: readonly SourceSpanLite[];
  readonly activeNodeId: string | null;
  readonly onSelectNode: (nodeId: string) => void;
  readonly nodeLabel: (nodeId: string) => string;
}

export const SourceLens: React.FC<SourceLensProps> = ({ file, spans, activeNodeId, onSelectNode, nodeLabel }) => {
  const bodyRef = useRef<HTMLPreElement | null>(null);
  const lines = useMemo(() => (file ? file.text.replace(/\r\n/g, '\n').split('\n') : []), [file]);
  const owners = useMemo(() => {
    // The narrowest top-level span owns a line; nested or ambiguous lines own nothing.
    const result = new Map<number, string>();
    if (!file) return result;
    for (let line = 1; line <= lines.length; line += 1) {
      const covering = spans.filter((span) => span.path === file.path && (span.definitionId ?? 'top') === 'top' && span.startLine <= line && line <= span.endLine);
      if (covering.length === 0) continue;
      const narrowest = Math.min(...covering.map((span) => span.endLine - span.startLine));
      const ids = new Set(covering.filter((span) => span.endLine - span.startLine === narrowest).map((span) => span.nodeId));
      if (ids.size === 1) result.set(line, [...ids][0]);
    }
    return result;
  }, [file, lines.length, spans]);
  const activeLines = useMemo(() => {
    const result = new Set<number>();
    if (!file || !activeNodeId) return result;
    for (const span of spans) {
      if (span.path !== file.path || span.nodeId !== activeNodeId || (span.definitionId ?? 'top') !== 'top') continue;
      for (let line = span.startLine; line <= span.endLine; line += 1) result.add(line);
    }
    return result;
  }, [activeNodeId, file, spans]);

  useEffect(() => {
    const first = Math.min(...activeLines);
    if (!Number.isFinite(first)) return;
    const element = bodyRef.current?.querySelector<HTMLElement>(`[data-line="${first}"]`);
    element?.scrollIntoView({ block: 'center' });
  }, [activeLines]);

  if (!file) return <div className="mrd-lens-empty">No generated source for this moment.</div>;
  return (
    <pre className="mrd-source" ref={bodyRef} data-testid="meridian-source" data-path={file.path} data-active-node={activeNodeId ?? ''}>
      {lines.map((text, index) => {
        const line = index + 1;
        const owner = owners.get(line);
        // The gutter names the owning part once, on the first line of its statement.
        const first = owner && owners.get(line - 1) !== owner;
        return (
          <div key={line} className="mrd-src-line" data-line={line} data-owner={owner ?? undefined} data-active={activeLines.has(line) ? '1' : undefined}>
            <span>{line}</span>
            {owner && first ? (
              <button type="button" className="mrd-src-owner" title={`${nodeLabel(owner)} drives this statement`} aria-label={`Select ${nodeLabel(owner)} (drives line ${line})`} onClick={() => onSelectNode(owner)}>{nodeLabel(owner)}</button>
            ) : <span />}
            <span>{text || ' '}</span>
          </div>
        );
      })}
    </pre>
  );
};
