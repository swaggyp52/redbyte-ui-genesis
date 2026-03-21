/**
 * ProjectMode — Manage project metadata, file tree, import/export status, and base settings.
 *
 * When the IDE is in "Project" mode, the right dock shows the learn/lessons tab
 * and the user can manage project properties, load lab templates, and view file status.
 *
 * The canvas remains visible (all modes share the canvas).
 */

import React from 'react';
import { useIde } from '../IdeContext';
import { deriveFileTreeManifest } from '../../../export/fileTreeManifest';
import { FileTree } from '../../../components/FileTree';

export interface ProjectModeProps {
  /** Current lab's starter instructions (if any) */
  pinnedStarterInstructions: {
    labId: string;
    title: string;
    timeEstimate: string;
    learningGoal: string;
    steps: string[];
    submit: string[];
  } | null;
  /** Open the lab selector modal */
  onOpenLabSelector: () => void;
}

/**
 * ProjectMode renders the project-management overlay content.
 * Shows project metadata, file tree manifest, and lab selector.
 */
export const ProjectMode: React.FC<ProjectModeProps> = ({
  pinnedStarterInstructions,
  onOpenLabSelector,
}) => {
  const { projectName, projectId, isDirty, buildProject } = useIde();
  const project = buildProject();
  const manifest = deriveFileTreeManifest(project);

  return (
    <div data-testid="ide-mode-project" className="absolute top-3 left-3 z-20 max-w-sm pointer-events-auto">
      <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-4 py-3 text-xs shadow-lg max-h-96 overflow-y-auto">
        <div className="text-[10px] uppercase tracking-wide text-cyan-300 mb-1">Project</div>
        <div className="text-sm font-semibold text-white truncate">{projectName}</div>
        <div className="text-[10px] text-slate-500 font-mono mt-1 truncate">{projectId}</div>
        {isDirty && (
          <div className="mt-1 text-[10px] text-amber-400">Unsaved changes</div>
        )}
        {pinnedStarterInstructions && (
          <div className="mt-2 text-[10px] text-slate-400">
            Lab: {pinnedStarterInstructions.labId} — {pinnedStarterInstructions.title}
          </div>
        )}
        <button
          type="button"
          onClick={onOpenLabSelector}
          className="mt-2 px-3 py-1.5 rounded bg-slate-800 border border-slate-600 text-[11px] text-cyan-300 hover:bg-slate-700 transition-colors"
        >
          Load Lab Template
        </button>
        <FileTree manifest={manifest} />
      </div>
    </div>
  );
};
