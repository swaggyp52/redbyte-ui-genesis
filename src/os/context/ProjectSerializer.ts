import { ProjectState } from './ProjectContext';

export function exportProjectToBlob(project: ProjectState): Blob {
  const json = JSON.stringify(project, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export function downloadProject(project: ProjectState) {
  const blob = exportProjectToBlob(project);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = project.name.replace(/[^a-z0-9_\-]+/gi, '_') + '.redproj';
  a.click();
  URL.revokeObjectURL(url);
}

export function importProject(jsonString: string): ProjectState {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project file');
  }
  if (!parsed.id || !parsed.createdAt) {
    throw new Error('Missing metadata');
  }
  return parsed as ProjectState;
}
