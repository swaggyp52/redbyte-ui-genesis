// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Button } from '@redbyte/rb-primitives';

export interface Track {
  id: string;
  title: string;
  description: string;
}

export interface Lesson {
  id: string;
  title: string;
}

export interface HelpSidebarProps {
  // Track selection mode
  tracks?: Track[];
  onSelectTrack?: (trackId: string) => void;

  // Lesson navigation mode
  selectedTrack?: Track;
  lessons?: Lesson[];
  currentLessonIndex?: number;
  completedLessons?: Set<string>;
  onSelectLesson?: (index: number) => void;
  onBackToTracks?: () => void;
}

/**
 * HelpSidebar - Track picker and lesson list
 * Two modes: track selection or lesson navigation
 */
export const HelpSidebar: React.FC<HelpSidebarProps> = ({
  tracks,
  onSelectTrack,
  selectedTrack,
  lessons,
  currentLessonIndex,
  completedLessons,
  onSelectLesson,
  onBackToTracks,
}) => {
  return (
    <div>
      <h1 className="text-2xl mb-4 text-cyan-400">Logic Help</h1>
      <p className="text-sm text-gray-400 mb-6">Learn digital logic from gates to CPUs</p>

      {!selectedTrack && tracks && onSelectTrack ? (
        // Track Selection Mode
        <div>
          <h2 className="text-base mb-4">Choose a Track:</h2>
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              className="w-full p-4 mb-3 bg-slate-800 border border-slate-700 rounded-md text-gray-200 cursor-pointer text-left transition-all hover:bg-slate-700 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <div className="text-lg mb-1">{track.title}</div>
              <div className="text-xs text-gray-400">{track.description}</div>
            </button>
          ))}
        </div>
      ) : selectedTrack && lessons && onBackToTracks && onSelectLesson !== undefined ? (
        // Lesson Navigation Mode
        <div>
          <Button
            onClick={onBackToTracks}
            variant="ghost"
            size="sm"
            className="mb-4 border border-slate-700 text-cyan-400"
          >
            ← Back to Tracks
          </Button>

          <h2 className="text-base mb-4">{selectedTrack.title}</h2>

          <div>
            {lessons.map((lesson, index) => {
              const isCompleted = completedLessons?.has(lesson.id);
              const isCurrent = index === currentLessonIndex;

              return (
                <div key={lesson.id} className="mb-1">
                  <button
                    onClick={() => onSelectLesson(index)}
                    className={`w-full px-3 py-2 rounded text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isCurrent
                        ? 'bg-cyan-900/30 border border-cyan-500 text-cyan-300 font-medium'
                        : 'text-gray-300 hover:bg-slate-700'
                    }`}
                  >
                    <span className="mr-2">{isCompleted ? '✓' : '○'}</span>
                    {lesson.id}: {lesson.title}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
