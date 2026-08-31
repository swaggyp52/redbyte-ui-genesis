import React from 'react';
import {
  deriveCompileOrder,
  filesByFileset,
  isEmptyProjectSourceModel,
  type FilesetKind,
  type ProjectSourceModel,
  type SourceFile,
} from '../projectSourceModel';
import { capabilityFor } from '../languageCapability';

/**
 * Source files document — a read-only projection of the project store's
 * first-class source/fileset authority (`sourceModel`). It never owns source
 * truth; it lists the source files grouped by fileset with each file's language
 * capability tier (so the workbench never over-claims what it can do with an
 * imported file) and the derived HDL compile order. Absent for projects that
 * carry no sources (native visual designs).
 */

export interface ProjectSourceFilesProps {
  readonly sourceModel: ProjectSourceModel;
}

const FILESET_TITLES: Record<FilesetKind, string> = {
  design: 'Design',
  simulation: 'Simulation',
  constraint: 'Constraints',
  utility: 'Utility',
};

const FILESET_ORDER: readonly FilesetKind[] = ['design', 'simulation', 'constraint', 'utility'];

function tierBadge(file: SourceFile): { label: string; tone: string; title: string } {
  const capability = capabilityFor(file.language);
  const toneByTier: Record<string, string> = {
    'structural-subset': 'ok',
    'ports-only': 'warn',
    'read-only': 'muted',
    'opaque-preserved': 'muted',
    unsupported: 'muted',
  };
  const labelByTier: Record<string, string> = {
    'structural-subset': 'reconstructable',
    'ports-only': 'ports only',
    'read-only': 'read-only',
    'opaque-preserved': 'preserved',
    unsupported: 'unsupported',
  };
  return {
    label: labelByTier[capability.tier] ?? capability.tier,
    tone: toneByTier[capability.tier] ?? 'muted',
    title: capability.notes,
  };
}

export const ProjectSourceFiles: React.FC<ProjectSourceFilesProps> = ({ sourceModel }) => {
  if (isEmptyProjectSourceModel(sourceModel)) return null;

  const grouped = filesByFileset(sourceModel);
  const compileOrder = deriveCompileOrder(sourceModel);

  return (
    <section className="ide-project-sources" data-testid="ide-project-sources" aria-label="Source files">
      <header className="ide-project-sources-head">
        <span>Source files</span>
        <strong data-testid="ide-project-sources-count">
          {sourceModel.files.length} file{sourceModel.files.length === 1 ? '' : 's'}
        </strong>
      </header>

      {sourceModel.topEntity ? (
        <p className="ide-project-sources-top" data-testid="ide-project-sources-top">
          Top entity: <code>{sourceModel.topEntity}</code>
        </p>
      ) : null}

      {FILESET_ORDER.filter((kind) => grouped[kind].length > 0).map((kind) => (
        <div key={kind} className="ide-project-sources-group" data-testid={`ide-project-sources-group-${kind}`}>
          <p className="ide-project-explorer-heading">{FILESET_TITLES[kind]}</p>
          <ul className="ide-project-sources-list">
            {grouped[kind].map((file) => {
              const badge = tierBadge(file);
              return (
                <li
                  key={file.id}
                  className="ide-project-source-row"
                  data-testid={`ide-project-source-${file.id}`}
                  data-language={file.language}
                >
                  <span className="ide-project-source-path"><code>{file.path}</code></span>
                  <span
                    className={`ide-project-source-tier is-${badge.tone}`}
                    data-testid={`ide-project-source-tier-${file.id}`}
                    title={badge.title}
                  >
                    {badge.label}
                  </span>
                  {file.library !== 'work' ? (
                    <span className="ide-project-source-lib">lib {file.library}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {compileOrder.length > 0 ? (
        <div
          className="ide-project-sources-compile"
          data-testid="ide-project-sources-compile-order"
          aria-label="Source compile order"
        >
          <span>Compile order</span>
          <ol>
            {compileOrder.map((file, index) => (
              <li key={file.id}>
                <code>{index + 1}</code> {file.path}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
};
