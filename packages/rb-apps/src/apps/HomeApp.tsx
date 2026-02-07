// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useCallback, useEffect, useState } from 'react';
import type { RedByteApp } from '../types';
import { Icon } from '@redbyte/rb-icons';
import { isCEMode } from '../utils/ceMode';
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
const MAX_RECENT = 5;

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

const HomeAppContent: React.FC<HomeAppProps> = ({ onOpenApp }) => {
  const ceMode = isCEMode();
  const missions = ceMode ? CE_MISSIONS : STUDIO_MISSIONS;
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);

  // Refresh recent list when window regains focus (other apps may have updated it)
  useEffect(() => {
    const handler = () => setRecent(loadRecent());
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

  const handleRecent = useCallback(
    (entry: RecentEntry) => {
      // Find the matching mission and re-execute its action
      const mission = missions.find((m) => m.id === entry.appId);
      if (mission && onOpenApp) {
        mission.action(onOpenApp);
      }
    },
    [missions, onOpenApp],
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

        {/* Mission cards */}
        <div className={styles.grid}>
          {missions.map((mission) => (
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
