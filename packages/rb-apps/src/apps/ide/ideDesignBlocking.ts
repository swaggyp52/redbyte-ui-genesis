import type { RBProject } from '../../export/projectFormat';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { deriveDesignCompilerDiagnostics } from './designCompilerDiagnostics';
import {
  buildIdeExportProject,
  deriveIdeLiveScheduleContract,
  type IdeBlockingDesignIssue,
  type IdeExportState,
} from './ideExportProject';
import { elaborateProjectHierarchy } from './projectHierarchy';
import type { ProjectRuntimeState } from './projectRuntime';
import { isDesignOwnedExportDiagnostic } from './projectWorkflowAuthority';
import { buildExportViewModel } from './viewmodels/buildExportViewModel';
import { getActiveScenario } from './verifyScenario';

/**
 * IdeApp `blockingDesignIssue`: a design-owned export blocker first, then a blocking compiler
 * diagnostic. While one exists the workbench refuses checked (Compare) runs.
 *
 * Separate from ideExportProject because the export view model value-imports runtime helpers
 * (and with them the runtime store): it is offered through `@redbyte/rb-apps/runtime`, never
 * through the pure domain entry.
 */
export function deriveIdeBlockingDesignIssue(
  state: IdeExportState & Pick<ProjectRuntimeState, 'verifyLastRun'>,
  project: RBProject = buildIdeExportProject(state),
  liveSchedule: VerifyScheduleContract = deriveIdeLiveScheduleContract(project),
): IdeBlockingDesignIssue | null {
  const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  const exportViewModel = buildExportViewModel(project, state.verifyLastRun ?? undefined, activeScenario ?? undefined);
  const exportDiagnostic = exportViewModel.errors.find(
    (diagnostic) => diagnostic.canonical.blocking && isDesignOwnedExportDiagnostic(diagnostic.code, liveSchedule.timingMode),
  );
  if (exportDiagnostic) {
    return { title: exportDiagnostic.title, message: exportDiagnostic.message, hint: exportDiagnostic.fix ?? exportDiagnostic.hint[0] };
  }
  const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
  const compilerDiagnostic = deriveDesignCompilerDiagnostics({ ...project, circuit: simulationCircuit }).find(
    (diagnostic) => diagnostic.blocking || diagnostic.severity === 'error',
  );
  if (!compilerDiagnostic) return null;
  return { title: compilerDiagnostic.title, message: compilerDiagnostic.message, hint: compilerDiagnostic.hint[0] };
}
