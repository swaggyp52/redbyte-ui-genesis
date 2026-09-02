import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ConstraintSetsDocument } from './constraintSets';
import type { NativeVisualModuleDefinition } from './projectHierarchy';
import { TOP_MODULE_ID } from './projectHierarchy';
import type { ProjectSourceModel } from './projectSourceModel';
import type { VerifyScenario } from './verifyScenario';
import {
  documentKey,
  documentMode,
  type WorkbenchDocument,
} from './workbenchDocuments';
import { useWorkbenchDocuments } from './workbenchDocumentStore';
import type { IdeMode } from './workflowStages';

/**
 * Document host — binds the typed document store to the workbench's existing
 * owners. It never becomes an authority of its own:
 *
 *   - `currentMode` stays owned by IdeApp; activating a tab asks IdeApp to
 *     change mode (and applies the tab's parameter through the real owner:
 *     hierarchy.setActiveModule, scenarios.switchScenario,
 *     constraintSets.setActive).
 *   - When an owner changes on its own (rail click, command, Back/Forward, a
 *     surface drilling into a module), the host reconciles: it activates that
 *     workspace's remembered document or opens the default one, and it keeps
 *     the active schematic/scenario tab truthful to the active module/scenario.
 *   - Project load/replace prunes tabs whose referenced objects are gone.
 */
export interface WorkbenchDocumentHostInput {
  readonly activeMode: IdeMode;
  readonly setCurrentMode: (mode: IdeMode) => void;
  readonly projectId: string;
  readonly hasCircuit: boolean;
  readonly topEntityName: string;
  readonly activeModuleId: string;
  readonly setActiveModule: (moduleId: string) => void;
  readonly modules: readonly NativeVisualModuleDefinition[];
  readonly scenarios: readonly VerifyScenario[];
  readonly activeScenarioId: string | null;
  readonly switchScenario: (scenarioId: string) => void;
  readonly isSequential: boolean;
  readonly constraintSets: ConstraintSetsDocument;
  readonly setActiveConstraintSet: (id: string) => void;
  readonly sourceModel: ProjectSourceModel;
  readonly boardLabel: string;
}

export interface WorkbenchDocumentHost {
  readonly open: readonly WorkbenchDocument[];
  readonly activeKey: string;
  readonly activeDocument: WorkbenchDocument | null;
  readonly activate: (key: string) => void;
  readonly close: (key: string) => void;
  /** Open (or focus) a document and switch to its workspace. */
  readonly openDocument: (doc: WorkbenchDocument) => void;
  readonly labelFor: (doc: WorkbenchDocument) => string | null;
}

export function useWorkbenchDocumentHost(input: WorkbenchDocumentHostInput): WorkbenchDocumentHost {
  const {
    activeMode,
    setCurrentMode,
    projectId,
    hasCircuit,
    topEntityName,
    activeModuleId,
    setActiveModule,
    modules,
    scenarios,
    activeScenarioId,
    switchScenario,
    isSequential,
    constraintSets,
    setActiveConstraintSet,
    sourceModel,
    boardLabel,
  } = input;

  const open = useWorkbenchDocuments((state) => state.open);
  const activeKey = useWorkbenchDocuments((state) => state.activeKey);
  const storeOpen = useWorkbenchDocuments((state) => state.openDocument);
  const storeActivate = useWorkbenchDocuments((state) => state.activateDocument);
  const storeClose = useWorkbenchDocuments((state) => state.closeDocument);
  const storeActivateForMode = useWorkbenchDocuments((state) => state.activateForMode);
  const storeSync = useWorkbenchDocuments((state) => state.syncToProject);
  const storeReset = useWorkbenchDocuments((state) => state.reset);

  const activeDocument = useMemo(
    () => open.find((doc) => documentKey(doc) === activeKey) ?? null,
    [activeKey, open]
  );

  // While a tab activation is being applied through the owners, the
  // mode-reconciliation effect must not fight it.
  const applyingRef = useRef<WorkbenchDocument | null>(null);

  const activeConstraintSetId = constraintSets.activeId ?? 'default';
  const defaultScenarioId = activeScenarioId ?? scenarios[0]?.id ?? null;

  const makeDefault = useCallback(
    (mode: IdeMode): WorkbenchDocument | null => {
      switch (mode) {
        case 'project':
          return { kind: 'project-overview' };
        case 'design':
          return { kind: 'schematic', moduleId: activeModuleId || TOP_MODULE_ID };
        case 'verify':
          return defaultScenarioId
            ? { kind: isSequential ? 'timing' : 'cases', scenarioId: defaultScenarioId }
            : null;
        case 'hardware':
          return { kind: 'board-io', constraintSetId: activeConstraintSetId };
        case 'export':
          return { kind: 'package-artifact' };
        case 'import':
          return null;
      }
    },
    [activeConstraintSetId, activeModuleId, defaultScenarioId, isSequential]
  );

  /** Push a document's parameter into its canonical owner. */
  const applyDocument = useCallback(
    (doc: WorkbenchDocument) => {
      switch (doc.kind) {
        case 'schematic':
          if (doc.moduleId !== activeModuleId) setActiveModule(doc.moduleId);
          break;
        case 'cases':
        case 'timing':
        case 'waveform':
          if (doc.scenarioId !== activeScenarioId && scenarios.some((s) => s.id === doc.scenarioId)) {
            switchScenario(doc.scenarioId);
          }
          break;
        case 'board-io':
          if (
            doc.constraintSetId !== 'default' &&
            doc.constraintSetId !== constraintSets.activeId &&
            constraintSets.sets.some((set) => set.id === doc.constraintSetId)
          ) {
            setActiveConstraintSet(doc.constraintSetId);
          }
          break;
        default:
          break;
      }
    },
    [activeModuleId, activeScenarioId, constraintSets, scenarios, setActiveConstraintSet, setActiveModule, switchScenario]
  );

  const activate = useCallback(
    (key: string) => {
      const doc = open.find((entry) => documentKey(entry) === key);
      if (!doc) return;
      applyingRef.current = doc;
      storeActivate(key);
      applyDocument(doc);
      setCurrentMode(documentMode(doc));
    },
    [applyDocument, open, setCurrentMode, storeActivate]
  );

  const openDocument = useCallback(
    (doc: WorkbenchDocument) => {
      applyingRef.current = doc;
      storeOpen(doc);
      applyDocument(doc);
      setCurrentMode(documentMode(doc));
    },
    [applyDocument, setCurrentMode, storeOpen]
  );

  const close = useCallback(
    (key: string) => {
      const wasActive = key === activeKey;
      storeClose(key);
      if (!wasActive) return;
      const next = useWorkbenchDocuments.getState();
      const nextDoc = next.open.find((entry) => documentKey(entry) === next.activeKey);
      if (nextDoc) {
        applyingRef.current = nextDoc;
        applyDocument(nextDoc);
        setCurrentMode(documentMode(nextDoc));
      }
    },
    [activeKey, applyDocument, setCurrentMode, storeClose]
  );

  // A new project identity starts with a fresh document set.
  const seenProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (seenProjectRef.current === null) {
      seenProjectRef.current = projectId;
      return;
    }
    if (seenProjectRef.current === projectId) return;
    seenProjectRef.current = projectId;
    storeReset();
  }, [projectId, storeReset]);

  // Prune tabs whose referenced objects are gone.
  useEffect(() => {
    storeSync({
      moduleIds: new Set(modules.map((module) => module.id)),
      scenarioIds: new Set(scenarios.map((scenario) => scenario.id)),
      fileIds: new Set(sourceModel.files.map((file) => file.id)),
      constraintSetIds: new Set(constraintSets.sets.map((set) => set.id)),
    });
  }, [constraintSets.sets, modules, scenarios, sourceModel.files, storeSync]);

  // Mode changed by an owner (rail, command, Back/Forward): reconcile the tabs.
  useEffect(() => {
    const applying = applyingRef.current;
    if (applying) {
      if (documentMode(applying) === activeMode) applyingRef.current = null;
      return;
    }
    if (!hasCircuit && activeMode !== 'project') {
      // No project boundary yet — only the overview is an honest document.
      return;
    }
    storeActivateForMode(activeMode, () => makeDefault(activeMode));
  }, [activeMode, hasCircuit, makeDefault, storeActivateForMode]);

  // The active module inside Design is the schematic document.
  useEffect(() => {
    if (activeMode !== 'design') return;
    const key = documentKey({ kind: 'schematic', moduleId: activeModuleId });
    if (useWorkbenchDocuments.getState().activeKey === key) return;
    storeOpen({ kind: 'schematic', moduleId: activeModuleId });
  }, [activeMode, activeModuleId, storeOpen]);

  // The active scenario inside Simulate is the cases/timing/waveform document.
  useEffect(() => {
    if (activeMode !== 'verify' || !activeScenarioId) return;
    const current = useWorkbenchDocuments.getState();
    const active = current.open.find((entry) => documentKey(entry) === current.activeKey);
    if (
      active &&
      (active.kind === 'cases' || active.kind === 'timing' || active.kind === 'waveform') &&
      active.scenarioId === activeScenarioId
    ) {
      return;
    }
    const preferredKind = active && (active.kind === 'waveform' || active.kind === 'timing' || active.kind === 'cases')
      ? active.kind
      : isSequential
        ? 'timing'
        : 'cases';
    storeOpen({ kind: preferredKind, scenarioId: activeScenarioId });
  }, [activeMode, activeScenarioId, isSequential, storeOpen]);

  const labelFor = useCallback(
    (doc: WorkbenchDocument): string | null => {
      switch (doc.kind) {
        case 'project-overview':
          return 'Overview';
        case 'architecture':
          return 'Architecture';
        case 'runs':
          return 'Runs';
        case 'sources':
          return 'Sources';
        case 'compile-order':
          return 'Compile Order';
        case 'source-file': {
          const file = sourceModel.files.find((entry) => entry.id === doc.fileId);
          return file ? file.path.split('/').pop() ?? file.path : null;
        }
        case 'schematic': {
          if (doc.moduleId === TOP_MODULE_ID) return topEntityName;
          const module = modules.find((entry) => entry.id === doc.moduleId);
          return module ? module.displayName || module.name : null;
        }
        case 'cases':
        case 'timing':
        case 'waveform': {
          const scenario = scenarios.find((entry) => entry.id === doc.scenarioId);
          if (!scenario) return null;
          const suffix = doc.kind === 'cases' ? 'Cases' : doc.kind === 'timing' ? 'Timing' : 'Waveform';
          return `${scenario.name} — ${suffix}`;
        }
        case 'board-io': {
          const set = constraintSets.sets.find((entry) => entry.id === doc.constraintSetId);
          const boardName = boardLabel.charAt(0).toUpperCase() + boardLabel.slice(1);
          return set ? `${set.name} — ${boardName} I/O` : `${boardName} I/O`;
        }
        case 'package-artifact':
          return 'Package';
        case 'handoff':
          return 'Handoff';
      }
    },
    [boardLabel, constraintSets.sets, modules, scenarios, sourceModel.files, topEntityName]
  );

  return { open, activeKey, activeDocument, activate, close, openDocument, labelFor };
}
