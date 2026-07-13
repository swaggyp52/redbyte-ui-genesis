// Copyright (c) 2025 Connor Angiel - RedByte
// Project surface primitives: identity header, next-action card, metrics row,
// session controls, and examples browser. Built so the Project page reads as a
// real project dashboard (identity → next action → overview → examples →
// session) instead of a wall of cards.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IdeButton } from './IdePrimitives';

// ─────────────────────────────────────────────────────────────────────────────
// ProjectIdentityHeader
// Project name (with rename), kind label, board, save state, last saved.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectIdentityHeaderProps {
  projectName: string;
  onRenameProject?: (nextName: string) => void;
  projectKindLabel: string;
  sourceLabel?: string;
  board: string;
  saveState: 'saved' | 'unsaved' | 'autosaving';
  lastSavedAt?: string;
  studentName?: string;
}

export const ProjectIdentityHeader: React.FC<ProjectIdentityHeaderProps> = ({
  projectName,
  onRenameProject,
  projectKindLabel,
  sourceLabel,
  board,
  saveState,
  lastSavedAt,
  studentName,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelNextBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(projectName);
  }, [projectName, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = () => {
    if (!onRenameProject) return;
    cancelNextBlurCommitRef.current = false;
    setEditing(true);
  };

  const commit = () => {
    if (cancelNextBlurCommitRef.current) {
      cancelNextBlurCommitRef.current = false;
      return;
    }
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== projectName) {
      onRenameProject?.(trimmed);
    }
    if (trimmed.length === 0) {
      setDraft(projectName);
    }
    setEditing(false);
  };
  const cancel = () => {
    cancelNextBlurCommitRef.current = true;
    setDraft(projectName);
    setEditing(false);
  };

  const saveLabel =
    saveState === 'saved' ? 'Saved' : saveState === 'autosaving' ? 'Saving…' : 'Unsaved changes';
  const saveTone =
    saveState === 'saved' ? 'ok' : saveState === 'autosaving' ? 'busy' : 'attention';

  return (
    <header className="ide-projectx-identity" data-testid="ide-projectx-identity">
      <div className="ide-projectx-identity-name-row">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="ide-projectx-identity-name-input"
            value={draft}
            data-testid="ide-projectx-name-input"
            aria-label="Project name"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
          />
        ) : onRenameProject ? (
          <h1 className="ide-projectx-identity-name-heading">
            <button
              type="button"
              className="ide-projectx-identity-name ide-projectx-identity-name-button"
              data-testid="ide-projectx-name"
              title={`Rename project "${projectName}"`}
              aria-label={`Project title ${projectName}. Click or double-click to rename.`}
              onClick={startEditing}
              onDoubleClick={startEditing}
            >
              {projectName}
            </button>
          </h1>
        ) : (
          <h1 className="ide-projectx-identity-name" data-testid="ide-projectx-name" title={projectName}>
            {projectName}
          </h1>
        )}
        {onRenameProject && !editing ? (
          <button
            type="button"
            className="ide-projectx-identity-rename"
            onClick={startEditing}
            data-testid="ide-projectx-name-edit"
            aria-label={`Rename project title ${projectName}`}
          >
            Rename
          </button>
        ) : null}
      </div>
      <div className="ide-projectx-identity-meta" data-testid="ide-projectx-identity-meta">
        <span className="ide-projectx-meta-chip" data-testid="ide-projectx-kind">
          {projectKindLabel}
        </span>
        {sourceLabel ? (
          <span className="ide-projectx-meta-chip" data-testid="ide-project-source-label">
            Source: {sourceLabel}
          </span>
        ) : null}
        <span className="ide-projectx-meta-chip" data-testid="ide-projectx-board">
          {board}
        </span>
        <span
          className={`ide-projectx-meta-chip is-${saveTone}`}
          data-testid="ide-projectx-save-state"
        >
          <span className="ide-projectx-meta-dot" aria-hidden="true" />
          {saveLabel}
        </span>
        {lastSavedAt ? (
          <span className="ide-projectx-meta-note" data-testid="ide-projectx-last-saved">
            Saved {lastSavedAt}
          </span>
        ) : null}
        {studentName ? (
          <span className="ide-projectx-meta-note" data-testid="ide-projectx-student">
            {studentName}
          </span>
        ) : null}
      </div>
    </header>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ProjectNextActionCard
// Bold "what to do next" panel: status tone + reason + primary + secondary CTA.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectNextActionTone = 'ready' | 'attention' | 'blocked' | 'success';

export interface ProjectNextActionCardProps {
  tone: ProjectNextActionTone;
  statusLabel: string;
  title: string;
  reason: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryTestId?: string;
  primaryInnerTestId?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryTestId?: string;
  secondaryInnerTestId?: string;
  /** Outer wrapper testid (default: ide-projectx-next-action). */
  rootTestId?: string;
  /** Reason copy testid override (used to preserve legacy contracts). */
  reasonTestId?: string;
  /** Optional supporting status line shown above the reason. */
  subline?: string;
  /** Test id for the subline span (used to preserve legacy contracts). */
  sublineTestId?: string;
}

export const ProjectNextActionCard: React.FC<ProjectNextActionCardProps> = ({
  tone,
  statusLabel,
  title,
  reason,
  primaryLabel,
  onPrimary,
  primaryTestId,
  primaryInnerTestId,
  secondaryLabel,
  onSecondary,
  secondaryTestId,
  secondaryInnerTestId,
  rootTestId,
  reasonTestId,
  subline,
  sublineTestId,
}) => {
  return (
    <section
      className={`ide-projectx-next is-${tone}`}
      data-testid={rootTestId ?? 'ide-projectx-next-action'}
    >
      <div className="ide-projectx-next-status" data-testid="ide-projectx-next-status">
        {statusLabel}
      </div>
      <h2 className="ide-projectx-next-title" data-testid="ide-projectx-next-title">
        {title}
      </h2>
      {subline && subline !== reason ? (
        <p
          className="ide-projectx-next-subline"
          data-testid={sublineTestId ?? 'ide-projectx-next-subline'}
        >
          {subline}
        </p>
      ) : null}
      <p
        className="ide-projectx-next-reason"
        data-testid={reasonTestId ?? 'ide-projectx-next-reason'}
      >
        {reason}
      </p>
      <div className="ide-projectx-next-actions">
        <IdeButton tone="primary" onClick={onPrimary} testId={primaryTestId}>
          {primaryInnerTestId ? <span data-testid={primaryInnerTestId}>{primaryLabel}</span> : primaryLabel}
        </IdeButton>
        {secondaryLabel && onSecondary ? (
          <IdeButton tone="secondary" onClick={onSecondary} testId={secondaryTestId}>
            {secondaryInnerTestId ? (
              <span data-testid={secondaryInnerTestId}>{secondaryLabel}</span>
            ) : secondaryLabel}
          </IdeButton>
        ) : null}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ProjectMetricsRow
// Compact pill grid summarising the project (nodes, conns, in, out, board state…).
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectMetric {
  id: string;
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'attention' | 'blocked';
  testId?: string;
}

export const ProjectMetricsRow: React.FC<{ metrics: ProjectMetric[] }> = ({ metrics }) => {
  return (
    <section className="ide-projectx-metrics" data-testid="ide-projectx-metrics">
      {metrics.map((m) => (
        <div
          key={m.id}
          className={`ide-projectx-metric is-${m.tone ?? 'neutral'}`}
          data-testid={m.testId ?? `ide-projectx-metric-${m.id}`}
        >
          <span className="ide-projectx-metric-label">{m.label}</span>
          <span className="ide-projectx-metric-value">{m.value}</span>
        </div>
      ))}
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ProjectSessionCard
// Save now | Open existing | Restore last | Reset — grouped clearly.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProjectSessionCardProps {
  onSaveNow?: () => void;
  onOpenExisting?: () => void;
  onRestoreLastSave?: () => void;
  onResetProject?: () => void;
}

export const ProjectSessionCard: React.FC<ProjectSessionCardProps> = ({
  onSaveNow,
  onOpenExisting,
  onRestoreLastSave,
  onResetProject,
}) => {
  if (!onSaveNow && !onOpenExisting && !onRestoreLastSave && !onResetProject) return null;
  return (
    <section className="ide-projectx-session" data-testid="ide-projectx-session">
      <header className="ide-projectx-session-header">
        <h3 className="ide-projectx-session-title">Project session</h3>
        <p className="ide-projectx-session-sub">
          Save, restore, or reset this project on this device.
        </p>
      </header>
      <div className="ide-projectx-session-actions">
        {onSaveNow ? (
          <IdeButton tone="secondary" onClick={onSaveNow} testId="ide-session-save-now">
            Save now
          </IdeButton>
        ) : null}
        {onOpenExisting ? (
          <IdeButton tone="ghost" onClick={onOpenExisting} testId="ide-session-open-existing">
            Open existing
          </IdeButton>
        ) : null}
        {onRestoreLastSave ? (
          <IdeButton tone="ghost" onClick={onRestoreLastSave} testId="ide-session-restore">
            Restore last save
          </IdeButton>
        ) : null}
        {onResetProject ? (
          <IdeButton tone="danger" onClick={onResetProject} testId="ide-session-reset">
            Reset project
          </IdeButton>
        ) : null}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ExamplesBrowser
// Search + tag-filter + cards. Replaces the random-order example grid.
// ─────────────────────────────────────────────────────────────────────────────

export interface BrowsableExample {
  id: string;
  name: string;
  concept: string;
  expectedBehavior?: string;
  course?: string;
  lab?: string;
  tags: string[];
  recommended?: boolean;
  /** 1-based position in the curated learning path (1–6 for v1). Absent for non-path examples. */
  learningPathOrder?: number;
  /** True for the flagship example that first demonstrates the full IDE spine. */
  flagship?: boolean;
  /** Honest caveat when proof is not fully closed. Shown as a warning in the path strip. */
  openProof?: string;
}

export interface ExamplesBrowserProps {
  examples: BrowsableExample[];
  activeExampleId?: string | null;
  onLoad: (exampleId: string) => void;
  defaultExpanded?: boolean;
  testId?: string;
}

const RECOMMENDED_TAG_ORDER = [
  'Beginner',
  'Logic Gates',
  'Sequential',
  'Verification Ready',
  'Lab Starter',
  'Basys3',
  'Importable',
];

function deriveTagsFromExamples(examples: BrowsableExample[]): string[] {
  const seen = new Set<string>();
  examples.forEach((ex) => ex.tags?.forEach((tag) => seen.add(tag)));
  const all = Array.from(seen);
  // Stable order: known recommended tags first, then alphabetical.
  return [
    ...RECOMMENDED_TAG_ORDER.filter((tag) => seen.has(tag)),
    ...all.filter((tag) => !RECOMMENDED_TAG_ORDER.includes(tag)).sort(),
  ];
}

export const ExamplesBrowser: React.FC<ExamplesBrowserProps> = ({
  examples,
  activeExampleId,
  onLoad,
  defaultExpanded = true,
  testId,
}) => {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const allTags = useMemo(() => deriveTagsFromExamples(examples), [examples]);

  // Path items in order — always shown regardless of search/tag filter.
  const pathItems = useMemo(
    () =>
      examples
        .filter((ex) => ex.learningPathOrder != null)
        .sort((a, b) => a.learningPathOrder! - b.learningPathOrder!),
    [examples],
  );

  // Grid: path items first (by learningPathOrder), then non-path examples.
  const sorted = useMemo(() => {
    const path = examples.filter((ex) => ex.learningPathOrder != null)
      .sort((a, b) => a.learningPathOrder! - b.learningPathOrder!);
    const rest = examples.filter((ex) => ex.learningPathOrder == null);
    return [...path, ...rest];
  }, [examples]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((ex) => {
      if (activeTag && !(ex.tags ?? []).includes(activeTag)) return false;
      if (!q) return true;
      const haystack = [
        ex.name,
        ex.concept,
        ex.expectedBehavior ?? '',
        ex.course ?? '',
        ex.lab ?? '',
        (ex.tags ?? []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sorted, query, activeTag]);

  return (
    <section
      className="ide-projectx-examples"
      data-testid={testId ?? 'ide-projectx-examples'}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <header className="ide-projectx-examples-header">
        <div>
          <h3 className="ide-projectx-examples-title">Examples &amp; starters</h3>
          <p className="ide-projectx-examples-sub">
            Load a worked design as a starting point. {filtered.length} of {examples.length} shown.
          </p>
        </div>
        <button
          type="button"
          className="ide-projectx-examples-toggle"
          onClick={() => setExpanded((v) => !v)}
          data-testid="ide-projectx-examples-toggle"
          aria-expanded={expanded}
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </header>
      {expanded ? (
        <>
          {pathItems.length > 0 && (
            <nav
              className="ide-projectx-learning-path"
              data-testid="ide-projectx-learning-path"
              aria-label="Guided learning path"
            >
              <span className="ide-projectx-learning-path-label">Start here:</span>
              {pathItems.map((ex, idx) => (
                <React.Fragment key={ex.id}>
                  <button
                    type="button"
                    className={`ide-projectx-path-step${ex.flagship ? ' is-flagship' : ''}`}
                    data-testid={`ide-projectx-path-step-${ex.id}`}
                    onClick={() => onLoad(ex.id)}
                    title={ex.openProof ? `${ex.name} — ${ex.openProof}` : ex.name}
                    aria-label={`Step ${idx + 1}: ${ex.name}${ex.openProof ? ' (proof open)' : ''}`}
                  >
                    <span className="ide-projectx-path-step-num">{idx + 1}</span>
                    <span className="ide-projectx-path-step-name">{ex.name}</span>
                    {ex.openProof ? (
                      <span className="ide-projectx-path-step-warn" aria-hidden="true" title={ex.openProof}>⚠</span>
                    ) : null}
                  </button>
                  {idx < pathItems.length - 1 ? (
                    <span className="ide-projectx-path-arrow" aria-hidden="true">›</span>
                  ) : null}
                </React.Fragment>
              ))}
            </nav>
          )}
          <div className="ide-projectx-examples-controls">
            <input
              type="search"
              className="ide-projectx-examples-search"
              placeholder="Search examples (name, concept, tag)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="ide-projectx-examples-search"
              aria-label="Search examples"
            />
            <div
              className="ide-projectx-examples-tags"
              data-testid="ide-projectx-examples-tags"
              role="toolbar"
              aria-label="Filter by tag"
            >
              <button
                type="button"
                className={`ide-projectx-tag ${activeTag === null ? 'is-active' : ''}`}
                onClick={() => setActiveTag(null)}
                data-testid="ide-projectx-tag-all"
                aria-pressed={activeTag === null}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`ide-projectx-tag ${activeTag === tag ? 'is-active' : ''}`}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  data-testid={`ide-projectx-tag-${slug(tag)}`}
                  aria-pressed={activeTag === tag}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="ide-projectx-examples-grid" data-testid="ide-projectx-examples-grid">
            {filtered.length === 0 ? (
              <p className="ide-projectx-examples-empty" data-testid="ide-projectx-examples-empty">
                No examples match &ldquo;{query}&rdquo;{activeTag ? ` in ${activeTag}` : ''}.
              </p>
            ) : (
              filtered.map((ex) => (
                <article
                  key={ex.id}
                  className={`ide-projectx-example-card ${activeExampleId === ex.id ? 'is-active' : ''}`}
                  data-testid={`ide-projectx-example-${ex.id}`}
                  data-example-id={ex.id}
                >
                  <header className="ide-projectx-example-card-head">
                    <h4 className="ide-projectx-example-card-title">{ex.name}</h4>
                    {ex.learningPathOrder != null ? (
                      <span className="ide-projectx-example-path-badge">
                        Step {ex.learningPathOrder}
                        {ex.flagship ? ' ⭐' : ''}
                      </span>
                    ) : ex.recommended ? (
                      <span className="ide-projectx-example-recommended">Recommended</span>
                    ) : null}
                  </header>
                  <p className="ide-projectx-example-card-concept">{ex.concept}</p>
                  {ex.expectedBehavior ? (
                    <p className="ide-projectx-example-card-learn">
                      <span className="ide-projectx-example-card-learn-label">You&rsquo;ll learn:</span>{' '}
                      {ex.expectedBehavior}
                    </p>
                  ) : null}
                  {ex.openProof ? (
                    <p className="ide-projectx-example-card-open-proof" data-testid={`ide-projectx-example-open-proof-${ex.id}`}>
                      ⚠ {ex.openProof}
                    </p>
                  ) : null}
                  <div className="ide-projectx-example-card-tags">
                    {(ex.tags ?? []).slice(0, 3).map((tag) => (
                      <span key={tag} className="ide-projectx-example-card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="ide-projectx-example-card-actions">
                    {/*
                      Preserve the legacy `ide-project-load-start-*` testid so
                      lab-day flows that click "Load & Design" on alternate
                      starters keep working. The new wrapper testid below
                      (`ide-projectx-example-load-*`) is additive.
                    */}
                    <span
                      data-testid={`ide-projectx-example-load-${ex.id}`}
                      style={{ display: 'contents' }}
                    >
                      <IdeButton
                        tone="primary"
                        onClick={() => onLoad(ex.id)}
                        testId={`ide-project-load-start-${ex.id}`}
                      >
                        Load &amp; Design →
                      </IdeButton>
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  );
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
