// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { Button } from '@redbyte/rb-primitives';

export interface LessonNavProps {
  currentIndex: number;
  totalLessons: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onMarkComplete?: () => void;
  isCompleted?: boolean;
  className?: string;
}

/**
 * LessonNav - Navigation controls for moving between lessons
 * Provides Previous/Next buttons and completion marking
 */
export const LessonNav: React.FC<LessonNavProps> = ({
  currentIndex,
  totalLessons,
  onPrevious,
  onNext,
  onMarkComplete,
  isCompleted,
  className = '',
}) => {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalLessons - 1;

  return (
    <div className={`flex justify-between items-center pt-6 mt-8 border-t border-slate-700 ${className}`}>
      <div>
        {!isFirst && onPrevious && (
          <Button onClick={onPrevious} variant="secondary" size="md">
            ← Previous
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        {onMarkComplete && (
          <Button
            onClick={onMarkComplete}
            variant={isCompleted ? 'ghost' : 'primary'}
            size="md"
            className={isCompleted ? 'text-green-400 border-green-500' : ''}
          >
            {isCompleted ? '✓ Completed' : 'Mark Complete'}
          </Button>
        )}

        {!isLast && onNext && (
          <Button onClick={onNext} variant="primary" size="md">
            Next →
          </Button>
        )}
      </div>
    </div>
  );
};
