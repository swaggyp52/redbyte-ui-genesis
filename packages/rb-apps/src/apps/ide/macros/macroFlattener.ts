import type { RBProject } from '../../../export/projectFormat';

export function flattenProjectMacros(project: RBProject): RBProject {
  if (!project.macros || project.macros.length === 0) {
    return project;
  }

  const flattened: RBProject = {
    ...project,
  };

  delete flattened.macros;

  return flattened;
}