// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NarrativeEventId } from './narrativeEvents';

const STORAGE_KEY = 'rb:narrative:v1';

/**
 * Persistent state for narrative events
 */
interface NarrativeState {
  // When each event was first shown (ISO date)
  shownEvents: Record<string, string>;
  // Last time any narrative was shown (for cooldown)
  lastShownAt: string | null;
  // How many narratives user has dismissed
  dismissedCount: number;

  // Actions
  markAsShown: (eventId: NarrativeEventId) => void;
  hasBeenShown: (eventId: NarrativeEventId) => boolean;
  updateLastShown: () => void;
  incrementDismissed: () => void;
  reset: () => void; // For dev/testing
}

export const useNarrativeStore = create<NarrativeState>()(
  persist(
    (set, get) => ({
      shownEvents: {},
      lastShownAt: null,
      dismissedCount: 0,

      markAsShown: (eventId) => {
        const now = new Date().toISOString();
        set((state) => ({
          shownEvents: {
            ...state.shownEvents,
            [eventId]: now,
          },
          lastShownAt: now,
        }));
      },

      hasBeenShown: (eventId) => {
        return eventId in get().shownEvents;
      },

      updateLastShown: () => {
        set({ lastShownAt: new Date().toISOString() });
      },

      incrementDismissed: () => {
        set((state) => ({ dismissedCount: state.dismissedCount + 1 }));
      },

      reset: () => {
        set({
          shownEvents: {},
          lastShownAt: null,
          dismissedCount: 0,
        });
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
