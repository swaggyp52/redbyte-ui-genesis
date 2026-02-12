// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { RedByteApp } from '../types';
import { Icon } from '@redbyte/rb-icons';
import { loadExampleAsProject, type ExampleId } from '../examples';
import { isCEMode } from '../utils/ceMode';
import { getRedByteUiMode } from '../utils/uiMode';
import {
  clearProjectAutosaveByProjectId,
  loadRecentProjects,
  type RecentProjectEntryV1,
} from '../utils/rbprojAutosave';
import { labProjectToRBProject } from '../utils/labProjectRbprojAdapter';
import { LAB_STARTER_KITS, type LabStarterInstructions, type LabStarterKit } from '../starterKits/labStarterKits';
import {
  createInstructorProjectArchiveBytes,
  createInstructorPack,
  downloadInstructorPack,
  loadImportedStarterPacks,
  parseInstructorPack,
  removeImportedStarterPack,
  upsertImportedStarterPack,
  type ImportedStarterPackRecord,
} from '../starterKits/instructorPack';
import styles from './HomeApp.module.css';

// ---------------------------------------------------------------------------
// Recent activity (localStorage-backed, lightweight)
// ---------------------------------------------------------------------------

interface RecentEntry {
  appId: string;
  label: string;
  iconId: string;
  ts: number;
}

const RECENT_KEY = 'rb:home:recent';
const QUICKSTART_DISMISSED_KEY = 'rb:home:quickstart-dismissed:v1';
const MAX_RECENT = 5;
const STARTER_RECENT_PREFIX = 'starter:';
const IMPORTED_STARTER_RECENT_PREFIX = 'instructor-pack:';

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(entry: Omit<RecentEntry, 'ts'>) {
  const list = loadRecent().filter((r) => r.appId !== entry.appId || r.label !== entry.label);
  list.unshift({ ...entry, ts: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function loadQuickstartDismissed(): boolean {
  try {
    return localStorage.getItem(QUICKSTART_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistQuickstartDismissed(value: boolean): void {
  try {
    localStorage.setItem(QUICKSTART_DISMISSED_KEY, value ? '1' : '0');
  } catch {
    // no-op in non-browser or blocked localStorage contexts
  }
}

// ---------------------------------------------------------------------------
// Mission definitions
// ---------------------------------------------------------------------------

interface Mission {
  id: string;
  title: string;
  description: string;
  iconName: string;
  primary?: boolean;
  action: (onOpenApp: NonNullable<HomeAppProps['onOpenApp']>) => void;
}

interface RecentProjectOpenRequest {
  projectId: string;
  targetAppId: 'logic-playground' | 'ece-lab';
}

const CE_MISSIONS: Mission[] = [
  {
    id: 'ce-labs',
    title: 'My Labs',
    description: 'View assignments, build circuits, run test vectors, and submit evidence.',
    iconName: 'book',
    primary: true,
    action: (open) => open('labs'),
  },
  {
    id: 'ce-practice',
    title: 'Practice',
    description: 'Open a blank circuit to experiment freely.',
    iconName: 'logic',
    action: (open) => open('logic-playground'),
  },
  {
    id: 'ce-examples',
    title: 'Examples',
    description: 'Browse pre-built circuits to learn from.',
    iconName: 'circuit-board',
    action: (open) => open('logic-playground', { showExamples: true }),
  },
];

const STUDIO_MISSIONS: Mission[] = [
  {
    id: 'studio-build',
    title: 'Build a Full Adder',
    description: 'Open the classic full adder example and explore how carry propagation works.',
    iconName: 'logic',
    primary: true,
    action: (open) => open('logic-playground', { initialExampleId: '08_full-adder', dockTab: 'learn' }),
  },
  {
    id: 'studio-labs',
    title: 'Run a Lab',
    description: 'Guided assignments with step-by-step verification and hardware integration.',
    iconName: 'book',
    action: (open) => open('labs'),
  },
  {
    id: 'studio-learn',
    title: 'Learn Logic',
    description: 'Step-by-step guided examples: NOT gates, adders, latches, and more.',
    iconName: 'graduation-cap',
    action: (open) => open('logic-playground', { dockTab: 'learn', dockSubview: 'lessons' }),
  },
  {
    id: 'studio-export',
    title: 'Export Work',
    description: 'Review and inspect submission bundles, or start a new export.',
    iconName: 'file-export',
    action: (open) => open('submission-inspector'),
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HomeAppProps {
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
  onOpenStarterProject?: (starter: {
    exampleId: ExampleId;
    targetAppId: 'logic-playground' | 'ece-lab';
    starterId?: string;
    instructions?: LabStarterInstructions;
  }) => void | Promise<void>;
  onOpenInstructorPackProject?: (starter: {
    starterId: string;
    targetAppId: 'logic-playground' | 'ece-lab';
    packId: string;
    projectArchiveBase64: string;
    instructions: LabStarterInstructions;
  }) => void | Promise<void>;
  onOpenRecentProject?: (request: RecentProjectOpenRequest) => void | Promise<void>;
}

function buildStarterOpenRequest(starter: LabStarterKit): {
  exampleId: ExampleId;
  targetAppId: 'logic-playground' | 'ece-lab';
  starterId: string;
  instructions: LabStarterInstructions;
} {
  return {
    exampleId: starter.exampleId as ExampleId,
    targetAppId: starter.targetApp,
    starterId: starter.id,
    instructions: starter.instructions,
  };
}

function buildImportedStarterOpenRequest(pack: ImportedStarterPackRecord): {
  starterId: string;
  targetAppId: 'logic-playground' | 'ece-lab';
  packId: string;
  projectArchiveBase64: string;
  instructions: LabStarterInstructions;
} {
  return {
    starterId: pack.starter.id,
    targetAppId: pack.starter.targetApp,
    packId: pack.packId,
    projectArchiveBase64: pack.projectArchiveBase64,
    instructions: pack.starter.instructions,
  };
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatSubmissionSummary(entry: RecentProjectEntryV1): string | null {
  const bundleId = typeof entry.lastSubmissionBundleId === 'string' ? entry.lastSubmissionBundleId.trim() : '';
  if (bundleId.length === 0) return null;
  const shortBundleId = bundleId.length > 12 ? `${bundleId.slice(0, 12)}…` : bundleId;
  if (typeof entry.lastSubmissionAtMs === 'number') {
    return `Last submitted ${timeAgo(entry.lastSubmissionAtMs)} (${shortBundleId})`;
  }
  return `Last submitted (${shortBundleId})`;
}

const HomeAppContent: React.FC<HomeAppProps> = ({
  onOpenApp,
  onOpenStarterProject,
  onOpenInstructorPackProject,
  onOpenRecentProject,
}) => {
  const ceMode = isCEMode();
  const uiMode = useMemo(() => getRedByteUiMode(), []);
  const missions = ceMode ? CE_MISSIONS : STUDIO_MISSIONS;
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  const [recentProjects, setRecentProjects] = useState<RecentProjectEntryV1[]>(() => loadRecentProjects());
  const [importedStarterPacks, setImportedStarterPacks] = useState<ImportedStarterPackRecord[]>(() =>
    loadImportedStarterPacks(),
  );
  const [quickstartDismissed, setQuickstartDismissed] = useState<boolean>(loadQuickstartDismissed);
  const [activeStarterInstructions, setActiveStarterInstructions] = useState<{
    starter: LabStarterKit;
    source: 'built-in' | 'imported';
    packId?: string;
  } | null>(null);
  const [starterPackStatus, setStarterPackStatus] = useState<string | null>(null);
  const [isInstructorPackDropActive, setIsInstructorPackDropActive] = useState(false);
  const showExamplesFirst = recent.length === 0;

  const orderedMissions = useMemo(() => {
    if (!showExamplesFirst) return missions;

    const examplesIndex = missions.findIndex((mission) => mission.id.includes('examples'));
    if (examplesIndex <= 0) return missions;

    const reordered = [...missions];
    const [examplesMission] = reordered.splice(examplesIndex, 1);
    return [
      { ...examplesMission, primary: true },
      ...reordered.map((mission, index) => (index === 0 ? { ...mission, primary: false } : mission)),
    ];
  }, [missions, showExamplesFirst]);
  const visibleMissions = useMemo(() => {
    if (uiMode !== 'student') return orderedMissions;
    return orderedMissions.filter((mission) => mission.id !== 'studio-export');
  }, [orderedMissions, uiMode]);

  // Refresh recent list when window regains focus (other apps may have updated it)
  useEffect(() => {
    const handler = () => {
      setRecent(loadRecent());
      setRecentProjects(loadRecentProjects());
      setImportedStarterPacks(loadImportedStarterPacks());
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const handleMission = useCallback(
    (mission: Mission) => {
      if (!onOpenApp) return;
      pushRecent({ appId: mission.id, label: mission.title, iconId: mission.iconName });
      setRecent(loadRecent());
      mission.action(onOpenApp);
    },
    [onOpenApp],
  );

  const handleBuiltInStarter = useCallback(
    (starter: LabStarterKit) => {
      if (starter.exampleId != null && onOpenStarterProject) {
        void onOpenStarterProject(buildStarterOpenRequest(starter));
      } else if (onOpenApp) {
        onOpenApp(starter.targetApp);
      } else {
        return;
      }
      pushRecent({ appId: `${STARTER_RECENT_PREFIX}${starter.id}`, label: starter.title, iconId: 'circuit-board' });
      setRecent(loadRecent());
    },
    [onOpenApp, onOpenStarterProject],
  );

  const handleImportedStarter = useCallback(
    (pack: ImportedStarterPackRecord) => {
      if (onOpenInstructorPackProject) {
        void onOpenInstructorPackProject(buildImportedStarterOpenRequest(pack));
      } else if (onOpenApp) {
        onOpenApp(pack.starter.targetApp);
      } else {
        return;
      }
      pushRecent({
        appId: `${IMPORTED_STARTER_RECENT_PREFIX}${pack.packId}`,
        label: pack.starter.title,
        iconId: 'archive',
      });
      setRecent(loadRecent());
    },
    [onOpenApp, onOpenInstructorPackProject],
  );

  const handleExportStarterPack = useCallback(
    async (starter: LabStarterKit) => {
      if (starter.exampleId == null) {
        setStarterPackStatus(`Cannot export ${starter.title}: missing example source.`);
        return;
      }
      try {
        const project = loadExampleAsProject(starter.exampleId);
        const rbProject = labProjectToRBProject(project);
        const projectArchiveBytes = await createInstructorProjectArchiveBytes(rbProject);
        const bundle = await createInstructorPack({
          starter,
          projectArchiveBytes,
          rubric: {
            schema_version: 'rb_instructor_rubric_v1',
            labId: starter.labId,
            rubric: starter.instructions.rubric,
          },
        });
        downloadInstructorPack(bundle);
        setStarterPackStatus(`Exported ${bundle.filename}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown export error';
        setStarterPackStatus(`Instructor pack export failed: ${message}`);
      }
    },
    [],
  );

  const handleImportInstructorPackFile = useCallback(async (file: File) => {
    try {
      const parsed = await parseInstructorPack(file);
      const next = upsertImportedStarterPack(parsed);
      setImportedStarterPacks(next);
      setStarterPackStatus(`Imported instructor pack: ${parsed.starter.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      setStarterPackStatus(`Instructor pack import failed: ${message}`);
    }
  }, []);

  const handleImportInstructorPack = useCallback(async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip';
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        void handleImportInstructorPackFile(file);
      };
      input.click();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      setStarterPackStatus(`Instructor pack import failed: ${message}`);
    }
  }, [handleImportInstructorPackFile]);

  const handleDeleteImportedStarter = useCallback((packId: string) => {
    setImportedStarterPacks(removeImportedStarterPack(packId));
  }, []);

  const handleOpenStarterInstructions = useCallback(
    (starter: LabStarterKit, source: 'built-in' | 'imported', packId?: string) => {
      setActiveStarterInstructions({ starter, source, packId });
    },
    [],
  );

  const handleOpenStarterFromInstructions = useCallback(() => {
    if (!activeStarterInstructions) return;
    if (activeStarterInstructions.source === 'imported') {
      const pack = importedStarterPacks.find((entry) => entry.packId === activeStarterInstructions.packId);
      if (pack) {
        handleImportedStarter(pack);
      }
    } else {
      handleBuiltInStarter(activeStarterInstructions.starter);
    }
    setActiveStarterInstructions(null);
  }, [activeStarterInstructions, handleBuiltInStarter, handleImportedStarter, importedStarterPacks]);

  const handleInstructorPackDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!isInstructorPackDropActive) {
      setIsInstructorPackDropActive(true);
    }
  }, [isInstructorPackDropActive]);

  const handleInstructorPackDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsInstructorPackDropActive(false);
  }, []);

  const handleInstructorPackDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsInstructorPackDropActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    void handleImportInstructorPackFile(file);
  }, [handleImportInstructorPackFile]);

  const handleOpenRecentProject = useCallback(
    (entry: RecentProjectEntryV1) => {
      const targetAppId: 'logic-playground' | 'ece-lab' = entry.appHint === 'ece-lab' ? 'ece-lab' : 'logic-playground';
      if (onOpenRecentProject) {
        void onOpenRecentProject({ projectId: entry.projectId, targetAppId });
      } else if (onOpenApp) {
        onOpenApp(targetAppId);
      }
    },
    [onOpenApp, onOpenRecentProject],
  );

  const handleDeleteRecentProject = useCallback((projectId: string) => {
    clearProjectAutosaveByProjectId(projectId);
    setRecentProjects(loadRecentProjects());
  }, []);

  const handleDismissQuickstart = useCallback(() => {
    setQuickstartDismissed(true);
    persistQuickstartDismissed(true);
  }, []);

  const handleRecent = useCallback(
    (entry: RecentEntry) => {
      if (entry.appId.startsWith(STARTER_RECENT_PREFIX)) {
        const starter = LAB_STARTER_KITS.find((candidate) => `${STARTER_RECENT_PREFIX}${candidate.id}` === entry.appId);
        if (starter?.exampleId != null && onOpenStarterProject) {
          void onOpenStarterProject(buildStarterOpenRequest(starter));
        } else if (starter && onOpenApp) {
          onOpenApp(starter.targetApp);
        }
        return;
      }

      if (entry.appId.startsWith(IMPORTED_STARTER_RECENT_PREFIX)) {
        const packId = entry.appId.slice(IMPORTED_STARTER_RECENT_PREFIX.length);
        const starterPack = importedStarterPacks.find((pack) => pack.packId === packId);
        if (starterPack) {
          handleImportedStarter(starterPack);
        }
        return;
      }

      // Find the matching mission and re-execute its action
      const mission = missions.find((m) => m.id === entry.appId);
      if (mission && onOpenApp) {
        mission.action(onOpenApp);
      }
    },
    [handleImportedStarter, importedStarterPacks, missions, onOpenApp, onOpenStarterProject],
  );

  return (
    <div className={styles.container} data-testid="home-screen">
      <div className={styles.inner}>
        <header className={styles.brand}>
          <h1 className={styles.title}>
            {ceMode ? 'Welcome to Your Lab' : 'RedByte'}
          </h1>
          <p className={styles.tagline}>
            {ceMode
              ? 'Build, simulate, and submit digital logic circuits.'
              : 'The operating system for computer engineering education.'}
          </p>
        </header>

        {showExamplesFirst && !quickstartDismissed && (
          <div className={styles.quickstartBanner} data-testid="home-quickstart-banner">
            <div className={styles.quickstartTitle}>Quickstart</div>
            <ol className={styles.quickstartSteps}>
              <li>Open a lab starter</li>
              <li>Run simulation and inspect outputs</li>
              <li>Generate a submission bundle</li>
            </ol>
            <button
              type="button"
              className={styles.quickstartDismiss}
              onClick={handleDismissQuickstart}
              data-testid="home-quickstart-dismiss"
            >
              Dismiss
            </button>
          </div>
        )}

        <div
          className={`${styles.startersSection} ${isInstructorPackDropActive ? styles.starterDropActive : ''}`}
          data-testid="home-starters"
          onDragOver={handleInstructorPackDragOver}
          onDragLeave={handleInstructorPackDragLeave}
          onDrop={handleInstructorPackDrop}
        >
          <div className={styles.startersHeaderRow}>
            <h2 className={styles.startersTitle}>Lab Starters</h2>
            <div className={styles.startersHeaderActions}>
              {showExamplesFirst && (
                <span className={styles.startersHint} data-testid="home-no-recent-hint">
                  No recent projects found - start here.
                </span>
              )}
              <button
                type="button"
                className={styles.starterSecondaryButton}
                onClick={() => {
                  void handleImportInstructorPack();
                }}
                data-testid="home-import-instructor-pack"
              >
                Import Instructor Pack
              </button>
            </div>
          </div>
          <div className={styles.starterDropHint} data-testid="home-instructor-pack-dropzone">
            Drag and drop an Instructor Pack ZIP here, or use Import Instructor Pack.
          </div>
          {starterPackStatus ? (
            <div className={styles.starterStatus} data-testid="home-instructor-pack-status">
              {starterPackStatus}
            </div>
          ) : null}
          <div className={styles.startersGrid}>
            {LAB_STARTER_KITS.map((starter) => (
              <div
                key={starter.id}
                className={styles.starterCard}
              >
                <div className={styles.starterHeader}>
                  <span className={styles.starterName}>{starter.title}</span>
                  <span className={styles.starterTarget}>
                    {starter.targetApp === 'ece-lab' ? 'ECE Lab' : 'Playground'}
                  </span>
                </div>
                <p className={styles.starterGoal}>{starter.learningGoal}</p>
                <p className={styles.starterTask}>{starter.whatToDo}</p>
                <div className={styles.starterActions}>
                  <button
                    type="button"
                    className={styles.starterActionButton}
                    onClick={() => handleBuiltInStarter(starter)}
                    data-testid={`home-starter-${starter.id}`}
                  >
                    Open + Start Lab
                  </button>
                  <button
                    type="button"
                    className={styles.starterSecondaryButton}
                    onClick={() => handleOpenStarterInstructions(starter, 'built-in')}
                    data-testid={`home-starter-instructions-${starter.id}`}
                  >
                    View Instructions
                  </button>
                  {uiMode === 'ta' ? (
                    <button
                      type="button"
                      className={styles.starterSecondaryButton}
                      onClick={() => {
                        void handleExportStarterPack(starter);
                      }}
                      data-testid={`home-starter-export-pack-${starter.id}`}
                    >
                      Export Pack
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {importedStarterPacks.length > 0 ? (
            <div className={styles.importedStarterSection} data-testid="home-imported-starters">
              <h3 className={styles.importedStarterTitle}>Imported by Instructor</h3>
              <div className={styles.startersGrid}>
                {importedStarterPacks.map((pack) => (
                  <div key={pack.packId} className={styles.starterCard} data-testid={`home-imported-starter-${pack.packId}`}>
                    <div className={styles.starterHeader}>
                      <span className={styles.starterName}>{pack.starter.title}</span>
                      <span className={styles.starterTarget}>Imported</span>
                    </div>
                    <p className={styles.starterGoal}>{pack.starter.learningGoal}</p>
                    <p className={styles.starterTask}>{pack.starter.whatToDo}</p>
                    <div className={styles.starterActions}>
                      <button
                        type="button"
                        className={styles.starterActionButton}
                        onClick={() => handleImportedStarter(pack)}
                        data-testid={`home-imported-starter-open-${pack.packId}`}
                      >
                        Open + Start Lab
                      </button>
                      <button
                        type="button"
                        className={styles.starterSecondaryButton}
                        onClick={() => handleOpenStarterInstructions(pack.starter, 'imported', pack.packId)}
                        data-testid={`home-imported-starter-instructions-${pack.packId}`}
                      >
                        View Instructions
                      </button>
                      {uiMode === 'ta' ? (
                        <button
                          type="button"
                          className={styles.starterSecondaryButton}
                          onClick={() => handleDeleteImportedStarter(pack.packId)}
                          data-testid={`home-imported-starter-delete-${pack.packId}`}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.recentProjectsSection} data-testid="home-recent-projects">
          <div className={styles.recentProjectsHeaderRow}>
            <h2 className={styles.recentProjectsTitle}>Recent Projects</h2>
            <span className={styles.recentProjectsHint}>Restore autosaved work or clear stale entries.</span>
          </div>
          {recentProjects.length === 0 ? (
            <div className={styles.recentProjectsEmpty} data-testid="home-recent-projects-empty">
              No autosaved projects found yet.
            </div>
          ) : (
            <div className={styles.recentProjectsList}>
              {recentProjects.map((project) => {
                const projectTestId = project.projectId.replace(/[^a-z0-9_-]/gi, '-');
                const submissionSummary = formatSubmissionSummary(project);
                return (
                  <div
                    key={project.projectId}
                    className={styles.recentProjectRow}
                    data-testid={`home-recent-project-${projectTestId}`}
                  >
                    <div className={styles.recentProjectMeta}>
                      <span className={styles.recentProjectName}>{project.name}</span>
                      <span className={styles.recentProjectDetail}>
                        {project.appHint === 'ece-lab' ? 'ECE Lab' : 'Logic Playground'}
                        {project.hasUnsaved ? ' · Unsaved work available' : ' · Ready'}
                      </span>
                      {submissionSummary ? (
                        <span
                          className={styles.recentProjectSubmission}
                          data-testid={`home-recent-project-submission-${projectTestId}`}
                        >
                          {submissionSummary}
                        </span>
                      ) : null}
                    </div>
                    <div className={styles.recentProjectActions}>
                      <button
                        type="button"
                        className={styles.recentProjectActionButton}
                        onClick={() => handleOpenRecentProject(project)}
                        data-testid={`home-recent-project-open-${projectTestId}`}
                      >
                        {project.hasUnsaved ? 'Restore' : 'Open'}
                      </button>
                      <button
                        type="button"
                        className={styles.recentProjectDeleteButton}
                        onClick={() => handleDeleteRecentProject(project.projectId)}
                        data-testid={`home-recent-project-delete-${projectTestId}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mission cards */}
        <div className={styles.grid}>
          {visibleMissions.map((mission) => (
            <button
              key={mission.id}
              type="button"
              className={mission.primary ? styles.cardPrimary : styles.card}
              onClick={() => handleMission(mission)}
              data-testid={`home-mission-${mission.id}`}
            >
              <div className={styles.cardIcon}>
                <Icon name={mission.iconName} size={18} />
              </div>
              <div className={styles.cardTitle}>{mission.title}</div>
              <p className={styles.cardBody}>{mission.description}</p>
            </button>
          ))}
        </div>

        {/* Recent activity */}
        {recent.length > 0 && (
          <div className={styles.recentSection}>
            <h2 className={styles.recentTitle}>Recent</h2>
            <div className={styles.recentList}>
              {recent.map((entry, i) => (
                <button
                  key={`${entry.appId}-${i}`}
                  type="button"
                  className={styles.recentItem}
                  onClick={() => handleRecent(entry)}
                >
                  <Icon name={entry.iconId} size={14} />
                  <span className={styles.recentItemName}>{entry.label}</span>
                  <span className={styles.recentItemMeta}>{timeAgo(entry.ts)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.footer}>
          RedByte OS Genesis · {import.meta.env.MODE}
        </div>
      </div>
      {activeStarterInstructions ? (
        <div className={styles.instructionsOverlay} data-testid="home-starter-instructions-modal">
          <div className={styles.instructionsModal}>
            <div className={styles.instructionsHeader}>
              <h2 className={styles.instructionsTitle}>{activeStarterInstructions.starter.title}</h2>
              <button
                type="button"
                className={styles.instructionsClose}
                onClick={() => setActiveStarterInstructions(null)}
              >
                Close
              </button>
            </div>
            <p className={styles.instructionsGoal}>{activeStarterInstructions.starter.instructions.learningGoal}</p>
            <div className={styles.instructionsMeta}>
              <span className={styles.instructionsMetaItem}>Lab ID: {activeStarterInstructions.starter.instructions.labId}</span>
              <span className={styles.instructionsMetaItem}>
                Estimated time: {activeStarterInstructions.starter.instructions.timeEstimate}
              </span>
            </div>
            <div className={styles.instructionsSection}>
              <h3 className={styles.instructionsSectionTitle}>Do this</h3>
              <ul className={styles.instructionsList}>
                {activeStarterInstructions.starter.instructions.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
            <div className={styles.instructionsSection}>
              <h3 className={styles.instructionsSectionTitle}>Common mistakes</h3>
              <ul className={styles.instructionsList}>
                {activeStarterInstructions.starter.instructions.commonMistakes.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
            <div className={styles.instructionsSection}>
              <h3 className={styles.instructionsSectionTitle}>What to submit</h3>
              <ul className={styles.instructionsList}>
                {activeStarterInstructions.starter.instructions.submit.map((submitStep) => (
                  <li key={submitStep}>{submitStep}</li>
                ))}
              </ul>
            </div>
            <div className={styles.instructionsSection}>
              <h3 className={styles.instructionsSectionTitle}>Rubric hooks</h3>
              <ul className={styles.instructionsList}>
                {activeStarterInstructions.starter.instructions.rubric.map((hook) => (
                  <li key={hook}>{hook}</li>
                ))}
              </ul>
            </div>
            <div className={styles.instructionsActions}>
              <button
                type="button"
                className={styles.starterActionButton}
                onClick={handleOpenStarterFromInstructions}
                data-testid="home-starter-instructions-open"
              >
                Open + Start Lab
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const HomeApp: RedByteApp = {
  manifest: {
    id: 'home',
    name: 'Home',
    iconId: 'neon-wave',
    category: 'system',
    singleton: true,
    defaultSize: {
      width: 640,
      height: 520,
    },
  },
  component: HomeAppContent,
};
