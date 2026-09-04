import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { IDE_EXAMPLES, type IdeExampleDefinition } from '../../examplesCatalog';
import { LAB_STARTERS, type LabStarter } from '../../labStarters';
import { GANNON_PILOT_LABS, formatGannonPilotProofScope, type GannonPilotLab } from '../../gannonPilotLabs';
import type { GuidedLabTaskDefinition } from '../../labTaskDefinition';
import type { ProjectHierarchyDocument } from '../../projectHierarchy';
import { ArchitecturePreview } from './ArchitecturePreview';

/**
 * Start Center — a visual project and lab library, not a web catalog.
 *
 * Left: compact sections (Recent, Course labs, Starters, Imported, Recover).
 * Center: a dense, keyboard-navigable list for the section.
 * Right: a real preview of the selected item rendered by the same
 * ArchitecturePreview the Project workspace uses — never a decorative
 * thumbnail — with the facts a student needs before starting: target,
 * ports, modules, cases, what is provided, what to build, what to submit,
 * and one primary command.
 *
 * Read-only over the example catalog, the lab pack and the saved-project
 * index. Previewing never loads or mutates a project.
 */

export type StartSection = 'recent' | 'labs' | 'starters' | 'imported' | 'recover';

export interface StartCenterRecentProject {
  readonly projectId: string;
  readonly projectName: string;
  readonly savedAtIso: string;
  readonly projectHash: string;
}

export interface StartCenterPeek {
  readonly circuit: Circuit;
  readonly hierarchy?: ProjectHierarchyDocument | null;
  readonly ioLabels: ReadonlyMap<string, string>;
  readonly top?: string;
  readonly board?: string;
  readonly part?: string;
  readonly caseCount?: number;
  readonly lastRun?: { readonly status: 'pass' | 'fail'; readonly stale: boolean } | null;
}

export interface StartCenterProps {
  readonly recentProjects: readonly StartCenterRecentProject[];
  readonly guidedLabTask?: GuidedLabTaskDefinition | null;
  readonly onOpenExample: (exampleId: string) => void;
  readonly onStartGuidedLab?: (labId: string) => void;
  readonly onOpenRecentProject?: (projectId: string) => void;
  readonly onOpenSavedProjects?: () => void;
  readonly onOpenImport: () => void;
  readonly onStartBlankProject?: () => void;
  /** Read-only look at a saved project for its preview; must not load it. */
  readonly peekRecentProject?: (projectId: string) => StartCenterPeek | null;
  readonly recovery?: {
    readonly available: boolean;
    readonly label: string | null;
    readonly onRestore: () => void;
  } | null;
  readonly boardLabel?: string;
  readonly fpgaPart?: string;
}

type Item =
  | { readonly kind: 'lab'; readonly id: string; readonly lab: GannonPilotLab; readonly example: IdeExampleDefinition | null }
  | { readonly kind: 'guided'; readonly id: string; readonly task: GuidedLabTaskDefinition }
  | { readonly kind: 'starter'; readonly id: string; readonly example: IdeExampleDefinition; readonly starter: LabStarter | null }
  | { readonly kind: 'recent'; readonly id: string; readonly project: StartCenterRecentProject }
  | { readonly kind: 'recover'; readonly id: string };

const SECTION_LABELS: Readonly<Record<StartSection, string>> = {
  recent: 'Recent',
  labs: 'Course labs',
  starters: 'Starters',
  imported: 'Imported',
  recover: 'Recover',
};

const DIFFICULTY_LABEL: Readonly<Record<string, string>> = {
  intro: 'Intro',
  intermediate: 'Intermediate',
  sequential: 'Sequential',
  advanced: 'Advanced',
};

function exampleById(id: string): IdeExampleDefinition | null {
  return IDE_EXAMPLES.find((example) => example.id === id) ?? LAB_STARTERS.find((starter) => starter.example.id === id)?.example ?? null;
}

function ioLabelsOf(example: IdeExampleDefinition): ReadonlyMap<string, string> {
  return new Map(example.ioRows.map((row) => [row.nodeId, row.label]));
}

function moduleNamesOf(circuit: Circuit, hierarchy: ProjectHierarchyDocument | null | undefined): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  const byId = new Map((hierarchy?.modules ?? []).map((module) => [module.id, module]));
  for (const node of circuit.nodes) {
    const definitionId = typeof node.config?.moduleDefinitionId === 'string' ? node.config.moduleDefinitionId : '';
    const definition = byId.get(definitionId);
    if (definition) map.set(node.id, definition.displayName || definition.name);
  }
  return map;
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return new Date(then).toLocaleDateString();
}

function circuitFacts(circuit: Circuit, hierarchy?: ProjectHierarchyDocument | null): { parts: number; nets: number; modules: number; inputs: number; outputs: number } {
  let inputs = 0;
  let outputs = 0;
  for (const node of circuit.nodes) {
    if (node.type === 'INPUT') inputs += 1;
    else if (node.type === 'OUTPUT') outputs += 1;
  }
  return { parts: circuit.nodes.length, nets: circuit.connections.length, modules: hierarchy?.modules.length ?? 0, inputs, outputs };
}

export const StartCenter: React.FC<StartCenterProps> = ({
  recentProjects,
  guidedLabTask,
  onOpenExample,
  onStartGuidedLab,
  onOpenRecentProject,
  onOpenSavedProjects,
  onOpenImport,
  onStartBlankProject,
  peekRecentProject,
  recovery,
  boardLabel = 'Basys3',
  fpgaPart = 'xc7a35tcpg236-1',
}) => {
  const [section, setSection] = useState<StartSection>(recentProjects.length > 0 ? 'recent' : 'labs');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<Item[]>(() => {
    switch (section) {
      case 'recent':
        return recentProjects.map((project) => ({ kind: 'recent', id: `recent:${project.projectId}`, project }));
      case 'labs': {
        const labs: Item[] = GANNON_PILOT_LABS.map((lab) => ({ kind: 'lab', id: `lab:${lab.id}`, lab, example: exampleById(lab.exampleId) }));
        if (guidedLabTask) labs.push({ kind: 'guided', id: `guided:${guidedLabTask.id}`, task: guidedLabTask });
        return labs;
      }
      case 'starters': {
        // The catalog also lists the lab starters; show each once, as its lab.
        const labExampleIds = new Set(LAB_STARTERS.map((starter) => starter.example.id));
        const ordered = IDE_EXAMPLES.filter((example) => !labExampleIds.has(example.id)).sort((left, right) => {
          const l = left.learningPath?.order ?? Number.POSITIVE_INFINITY;
          const r = right.learningPath?.order ?? Number.POSITIVE_INFINITY;
          return l - r || left.name.localeCompare(right.name);
        });
        return [
          ...ordered.map<Item>((example) => ({ kind: 'starter', id: `starter:${example.id}`, example, starter: null })),
          ...LAB_STARTERS.map<Item>((starter) => ({ kind: 'starter', id: `starter:${starter.example.id}`, example: starter.example, starter })),
        ];
      }
      case 'recover':
        return recovery?.available ? [{ kind: 'recover', id: 'recover:checkpoint' }] : [];
      default:
        return [];
    }
  }, [guidedLabTask, recentProjects, recovery?.available, section]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => itemSearchText(item).includes(needle));
  }, [items, query]);

  useEffect(() => {
    if (visible.some((item) => item.id === selectedId)) return;
    setSelectedId(visible[0]?.id ?? null);
  }, [selectedId, visible]);

  const selected = visible.find((item) => item.id === selectedId) ?? null;
  const selectedIndex = selected ? visible.indexOf(selected) : -1;

  const primaryFor = (item: Item): { label: string; run: () => void; testId: string } | null => {
    switch (item.kind) {
      case 'lab':
        return { label: item.lab.startLabel, run: () => onOpenExample(item.lab.exampleId), testId: `ide-project-gannon-lab-start-${item.lab.id}` };
      case 'guided':
        return onStartGuidedLab
          ? { label: `Start ${item.task.shortTitle} scratch lab`, run: () => onStartGuidedLab(item.task.id), testId: 'ide-project-guided-full-adder-start' }
          : null;
      case 'starter':
        return { label: 'Open starter', run: () => onOpenExample(item.example.id), testId: `ide-project-start-open-${item.starter ? item.starter.id : item.example.id}` };
      case 'recent':
        return onOpenRecentProject
          ? { label: 'Resume', run: () => onOpenRecentProject(item.project.projectId), testId: `ide-project-recent-open-${item.project.projectId}` }
          : null;
      case 'recover':
        return recovery ? { label: 'Restore snapshot', run: recovery.onRestore, testId: 'ide-project-recover-restore' } : null;
    }
  };

  const focusRow = (index: number) => {
    const item = visible[index];
    if (!item) return;
    setSelectedId(item.id);
    listRef.current?.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(item.id)}"]`)?.focus();
  };

  return (
    <div className="rb-start" data-testid="ide-project-landing" data-section={section}>
      <nav className="rb-start-nav" aria-label="Start center sections">
        {(['recent', 'labs', 'starters', 'imported', 'recover'] as const).map((key) => {
          const count =
            key === 'recent' ? recentProjects.length
            : key === 'labs' ? GANNON_PILOT_LABS.length + (guidedLabTask ? 1 : 0)
            : key === 'starters' ? IDE_EXAMPLES.length + LAB_STARTERS.length
            : key === 'recover' ? (recovery?.available ? 1 : 0)
            : 0;
          const testId =
            key === 'labs' ? 'ide-project-start-a-lab-primary'
            : key === 'starters' ? 'ide-project-open-starter-primary'
            : `ide-project-start-section-${key}`;
          return (
            <button
              key={key}
              type="button"
              className={`rb-start-nav-item${section === key ? ' is-active' : ''}`}
              aria-current={section === key ? 'true' : undefined}
              data-product-priority={key === 'labs' ? 'primary' : undefined}
              onClick={() => {
                setSection(key);
                setQuery('');
              }}
              data-testid={testId}
            >
              <span>{SECTION_LABELS[key]}</span>
              <span className="wb-toolwindow-count">{count}</span>
            </button>
          );
        })}
        <div className="rb-start-nav-actions">
          <button type="button" className="wb-btn wb-btn--ghost" onClick={onOpenImport} data-testid="ide-project-import-primary">
            Import project…
          </button>
          {onOpenSavedProjects ? (
            <button type="button" className="wb-btn wb-btn--ghost" onClick={onOpenSavedProjects} data-testid="ide-project-open-existing-primary">
              Open saved…
            </button>
          ) : null}
          {onStartBlankProject ? (
            <button type="button" className="wb-btn wb-btn--ghost" onClick={onStartBlankProject} data-testid="ide-project-build-fresh-primary">
              Blank project
            </button>
          ) : null}
        </div>
      </nav>

      <div className="rb-start-list-pane">
        <div className="rb-start-list-bar">
          <h2 className="rb-start-list-title">{SECTION_LABELS[section]}</h2>
          {items.length > 3 ? (
            <input
              className="rb-start-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Filter ${SECTION_LABELS[section].toLowerCase()}`}
              aria-label={`Filter ${SECTION_LABELS[section].toLowerCase()}`}
              data-testid="ide-project-start-filter"
            />
          ) : null}
        </div>
        {section === 'imported' ? (
          <div className="rb-start-empty" data-testid="ide-project-start-imported">
            <p>Import a Vivado project archive, HDL sources or an XDC to work beside them. Imported projects are reviewed before anything is applied, and their bytes are preserved.</p>
            <button type="button" className="wb-btn wb-btn--primary" onClick={onOpenImport}>
              Import…
            </button>
          </div>
        ) : visible.length === 0 ? (
          <p className="rb-start-empty" data-testid="ide-project-start-empty">
            {section === 'recent'
              ? 'No saved projects yet. Local saves appear here.'
              : section === 'recover'
                ? 'No recovery snapshot is waiting. RedByte writes one before it replaces a project.'
                : 'Nothing matches the filter.'}
          </p>
        ) : (
          <div
            ref={listRef}
            className="rb-start-list"
            role="listbox"
            aria-label={SECTION_LABELS[section]}
            data-testid={section === 'recent' ? 'ide-project-recent-panel' : `ide-project-start-list-${section}`}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                focusRow(Math.min(visible.length - 1, selectedIndex + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                focusRow(Math.max(0, selectedIndex - 1));
              } else if (event.key === 'Home') {
                event.preventDefault();
                focusRow(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                focusRow(visible.length - 1);
              } else if (event.key === 'Enter' && selected) {
                event.preventDefault();
                primaryFor(selected)?.run();
              }
            }}
          >
            {visible.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === selectedId}
                tabIndex={item.id === selectedId || (selectedId === null && index === 0) ? 0 : -1}
                className={`rb-start-row${item.id === selectedId ? ' is-selected' : ''}`}
                data-item-id={item.id}
                data-testid={rowTestId(item)}
                onClick={() => setSelectedId(item.id)}
                onDoubleClick={() => primaryFor(item)?.run()}
                onFocus={() => setSelectedId(item.id)}
              >
                <RowBody item={item} />
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="rb-start-preview" aria-label="Preview" data-testid="ide-project-start-preview">
        {selected ? (
          <Preview
            item={selected}
            primary={primaryFor(selected)}
            peekRecentProject={peekRecentProject}
            recoveryLabel={recovery?.label ?? null}
            boardLabel={boardLabel}
            fpgaPart={fpgaPart}
          />
        ) : (
          <p className="rb-start-empty">Select an item to preview it.</p>
        )}
      </section>
    </div>
  );
};

function rowTestId(item: Item): string {
  switch (item.kind) {
    case 'lab':
      return `ide-project-gannon-lab-card-${item.lab.id}`;
    case 'guided':
      return 'ide-project-guided-full-adder-lab';
    case 'starter':
      return item.starter ? `ide-project-lab-card-${item.starter.id}` : `ide-project-landing-example-${item.example.id}`;
    case 'recent':
      return `ide-project-recent-${item.project.projectId}`;
    case 'recover':
      return 'ide-project-recover-checkpoint';
  }
}

function itemSearchText(item: Item): string {
  switch (item.kind) {
    case 'lab':
      return `${item.lab.title} ${item.lab.build} ${item.lab.difficulty} lab ${item.lab.labNumber} ${item.example?.concept ?? ''} ${item.example?.tags.join(' ') ?? ''}`.toLowerCase();
    case 'guided':
      return `${item.task.title} ${item.task.assignment} guided scratch`.toLowerCase();
    case 'starter':
      return `${item.example.name} ${item.example.concept} ${item.example.summary} ${item.example.tags.join(' ')} ${item.starter?.title ?? ''}`.toLowerCase();
    case 'recent':
      return `${item.project.projectName} ${item.project.projectHash}`.toLowerCase();
    case 'recover':
      return 'recover snapshot checkpoint';
  }
}

const RowBody: React.FC<{ item: Item }> = ({ item }) => {
  switch (item.kind) {
    case 'lab': {
      const facts = item.example ? circuitFacts(item.example.circuit, item.example.hierarchy) : null;
      return (
        <>
          <span className="rb-start-row-kind">Lab {item.lab.labNumber}</span>
          <span className="rb-start-row-main" data-testid={`ide-project-gannon-lab-details-${item.lab.id}`}>
            <strong>{item.lab.title}</strong>
            <small>{item.lab.build}</small>
          </span>
          <span className="rb-start-row-meta">
            <span>{DIFFICULTY_LABEL[item.lab.difficulty] ?? item.lab.difficulty}</span>
            {facts ? <code>{facts.inputs} in · {facts.outputs} out</code> : null}
          </span>
        </>
      );
    }
    case 'guided':
      return (
        <>
          <span className="rb-start-row-kind">Scratch</span>
          <span className="rb-start-row-main">
            <strong>{item.task.title}</strong>
            <small>{item.task.assignment}</small>
          </span>
          <span className="rb-start-row-meta">
            <span>From blank</span>
            <code>{item.task.inputs.length} in · {item.task.outputs.length} out</code>
          </span>
        </>
      );
    case 'starter': {
      const facts = circuitFacts(item.example.circuit, item.example.hierarchy);
      const order = item.example.learningPath?.order;
      return (
        <>
          <span className="rb-start-row-kind">{item.starter ? `Lab ${item.starter.labNumber}` : order !== undefined ? `Path ${order}` : 'Starter'}</span>
          <span className="rb-start-row-main">
            <strong>{item.example.name}</strong>
            <small>{item.example.concept}</small>
          </span>
          <span className="rb-start-row-meta">
            <span>{facts.modules > 0 ? `${facts.modules} module${facts.modules === 1 ? '' : 's'}` : item.example.vectors.length > 0 ? `${item.example.vectors.length} cases` : 'No cases'}</span>
            <code>{facts.inputs} in · {facts.outputs} out</code>
          </span>
        </>
      );
    }
    case 'recent':
      return (
        <>
          <span className="rb-start-row-kind">Saved</span>
          <span className="rb-start-row-main">
            <strong>{item.project.projectName}</strong>
            <small>Saved {relativeTime(item.project.savedAtIso)}</small>
          </span>
          <span className="rb-start-row-meta">
            <code>{item.project.projectHash.slice(0, 8)}</code>
          </span>
        </>
      );
    case 'recover':
      return (
        <>
          <span className="rb-start-row-kind">Snapshot</span>
          <span className="rb-start-row-main">
            <strong>Recovery snapshot</strong>
            <small>Written before the last project replacement</small>
          </span>
          <span className="rb-start-row-meta" />
        </>
      );
  }
};

const Preview: React.FC<{
  item: Item;
  primary: { label: string; run: () => void; testId: string } | null;
  peekRecentProject?: (projectId: string) => StartCenterPeek | null;
  recoveryLabel: string | null;
  boardLabel: string;
  fpgaPart: string;
}> = ({ item, primary, peekRecentProject, recoveryLabel, boardLabel, fpgaPart }) => {
  const recentId = item.kind === 'recent' ? item.project.projectId : null;
  const peek = useMemo(() => (recentId && peekRecentProject ? peekRecentProject(recentId) : null), [peekRecentProject, recentId]);
  const example = item.kind === 'lab' ? item.example : item.kind === 'starter' ? item.example : null;
  const circuit = example?.circuit ?? peek?.circuit ?? null;
  const hierarchy = example?.hierarchy ?? peek?.hierarchy ?? null;
  const ioLabels = example ? ioLabelsOf(example) : peek?.ioLabels ?? new Map<string, string>();
  const moduleNames = circuit ? moduleNamesOf(circuit, hierarchy) : new Map<string, string>();
  const facts = circuit ? circuitFacts(circuit, hierarchy) : null;
  const title =
    item.kind === 'lab' ? item.lab.title
    : item.kind === 'guided' ? item.task.title
    : item.kind === 'starter' ? item.example.name
    : item.kind === 'recent' ? item.project.projectName
    : 'Recovery snapshot';

  return (
    <div className="rb-start-preview-body">
      <header className="rb-start-preview-head">
        <div>
          <h2 className="rb-start-preview-title">{title}</h2>
          <p className="rb-start-preview-sub">
            {item.kind === 'lab' ? `Lab ${item.lab.labNumber} · ${DIFFICULTY_LABEL[item.lab.difficulty] ?? item.lab.difficulty} · ${boardLabel}`
            : item.kind === 'guided' ? `Guided scratch lab · ${boardLabel}`
            : item.kind === 'starter' ? `${item.example.course} · ${item.example.lab} · ${item.example.concept}`
            : item.kind === 'recent' ? `Saved ${relativeTime(item.project.savedAtIso)} · ${item.project.projectHash.slice(0, 12)}`
            : recoveryLabel ?? 'Snapshot'}
          </p>
        </div>
        {primary ? (
          <button type="button" className="wb-btn wb-btn--primary rb-start-primary" onClick={primary.run} data-testid={primary.testId}>
            {primary.label}
          </button>
        ) : null}
      </header>

      {circuit && circuit.nodes.length > 0 ? (
        <div className="rb-start-figure" data-testid="ide-project-start-figure">
          <ArchitecturePreview circuit={circuit} ioLabelByNodeId={ioLabels} moduleNameByNodeId={moduleNames} />
        </div>
      ) : item.kind === 'guided' ? (
        <div className="rb-start-figure rb-start-figure--truth" data-testid="ide-project-start-figure">
          <table className="rb-start-truth">
            <thead>
              <tr>
                {item.task.inputs.map((signal) => <th key={signal.label}>{signal.label}</th>)}
                {item.task.outputs.map((signal) => <th key={signal.label} className="is-out">{signal.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {item.task.truthTable.slice(0, 8).map((row, index) => (
                <tr key={index}>
                  {item.task.inputs.map((signal) => <td key={signal.label}>{String((row as unknown as Record<string, unknown>)[signal.label] ?? '')}</td>)}
                  {item.task.outputs.map((signal) => <td key={signal.label} className="is-out">{String((row as unknown as Record<string, unknown>)[signal.label] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rb-start-figure rb-start-figure--empty">
          {item.kind === 'recent' ? (circuit ? 'Empty circuit — nothing placed yet.' : 'Preview unavailable for this saved project.') : 'A snapshot of the project as it was before the last replacement.'}
        </div>
      )}

      <dl className="rb-start-facts">
        <div><dt>Target</dt><dd><code>{peek?.board ?? boardLabel} · {peek?.part ?? fpgaPart}</code></dd></div>
        {facts ? <div><dt>Ports</dt><dd><code>{facts.inputs} in · {facts.outputs} out</code></dd></div> : null}
        {facts ? <div><dt>Parts</dt><dd><code>{facts.parts} · {facts.nets} nets{facts.modules ? ` · ${facts.modules} modules` : ''}</code></dd></div> : null}
        {example ? <div><dt>Cases</dt><dd><code>{example.vectors.length > 0 ? `${example.vectors.length} provided` : 'you author them'}</code></dd></div> : null}
        {peek?.caseCount !== undefined ? <div><dt>Cases</dt><dd><code>{peek.caseCount}</code></dd></div> : null}
        {peek?.lastRun ? <div><dt>Last run</dt><dd><code>{peek.lastRun.status.toUpperCase()}{peek.lastRun.stale ? ' · stale' : ''}</code></dd></div> : null}
        {peek?.top ? <div><dt>Top</dt><dd><code>{peek.top}</code></dd></div> : null}
      </dl>

      {item.kind === 'lab' ? (
        <div className="rb-start-brief">
          <div><h3>Build</h3><p>{item.lab.build}</p></div>
          <div><h3>Submit</h3><p>{item.lab.submit}</p></div>
          <div><h3>Proof scope</h3><p>{formatGannonPilotProofScope(item.lab.proofScope)}</p></div>
          {item.example ? <div><h3>Provided</h3><p>{item.example.summary}</p></div> : null}
          {item.example?.goals?.length ? (
            <div>
              <h3>You will</h3>
              <ol>{item.example.goals.map((goal) => <li key={goal}>{goal}</li>)}</ol>
            </div>
          ) : null}
          {item.example ? <div><h3>Expected behavior</h3><p>{item.example.expectedBehavior}</p></div> : null}
        </div>
      ) : item.kind === 'guided' ? (
        <div className="rb-start-brief">
          <div><h3>Assignment</h3><p>{item.task.assignment}</p></div>
          <div><h3>Build</h3><p>{item.task.buildGoal}</p></div>
          <div><h3>Submit</h3><p>{item.task.submitGoal}</p></div>
          <div><h3>Evidence</h3><p>{item.task.evidenceBoundary}</p></div>
        </div>
      ) : item.kind === 'starter' ? (
        <div className="rb-start-brief">
          <div><h3>Provided</h3><p>{item.example.summary}</p></div>
          {item.example.goals?.length ? (
            <div>
              <h3>You will</h3>
              <ol>{item.example.goals.map((goal) => <li key={goal}>{goal}</li>)}</ol>
            </div>
          ) : null}
          <div><h3>Expected behavior</h3><p>{item.example.expectedBehavior}</p></div>
          {item.example.learningPath?.openProof ? <div><h3>Open proof</h3><p>{item.example.learningPath.openProof}</p></div> : null}
        </div>
      ) : null}

      <p className="rb-start-boundary">Browser simulation and package generation only. Vivado synthesis, bitstream and board observation stay outside RedByte.</p>
    </div>
  );
};
