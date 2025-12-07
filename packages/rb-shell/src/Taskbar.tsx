import React from 'react';
import { WindowMinimizeIcon } from '@redbyte/rb-icons';

export interface TaskbarItemProps {
  id: string;
  title: string;
  isFocused: boolean;
  isMinimized: boolean;
  onFocus: () => void;
  onMinimize: () => void;
}

export interface TaskbarProps {
  items: TaskbarItemProps[];
}

/**
 * Taskbar - Shows running applications
 *
 * Displays currently running applications with focus indicators
 * and minimize/restore functionality.
 */
export const Taskbar: React.FC<TaskbarProps> = ({ items }) => {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-12 bg-[var(--rb-color-neutral-900)]/90 backdrop-blur-md border-b border-[var(--rb-color-neutral-800)] flex items-center px-[var(--rb-spacing-4)] gap-[var(--rb-spacing-2)]"
      role="toolbar"
      aria-label="Taskbar"
      data-testid="taskbar"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-[var(--rb-spacing-2)] px-[var(--rb-spacing-3)] py-[var(--rb-spacing-1)] rounded-[var(--rb-radius-md)] transition-colors duration-[var(--rb-duration-fast)] ${
            item.isFocused
              ? 'bg-[var(--rb-color-accent-700)]'
              : 'bg-[var(--rb-color-neutral-800)] hover:bg-[var(--rb-color-neutral-700)]'
          }`}
        >
          <button
            onClick={item.onFocus}
            className="text-[var(--rb-font-size-sm)] text-[var(--rb-color-neutral-100)] focus:outline-none"
            aria-label={`Focus ${item.title}`}
          >
            {item.title}
          </button>
          <button
            onClick={item.onMinimize}
            className="w-4 h-4 text-[var(--rb-color-neutral-400)] hover:text-[var(--rb-color-neutral-100)] transition-colors duration-[var(--rb-duration-fast)] focus:outline-none"
            aria-label={item.isMinimized ? `Restore ${item.title}` : `Minimize ${item.title}`}
          >
            <WindowMinimizeIcon />
          </button>
        </div>
      ))}
    </div>
  );
};
