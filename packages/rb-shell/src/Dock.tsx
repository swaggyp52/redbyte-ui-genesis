import React from 'react';

export interface DockItemProps {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

export interface DockProps {
  items: DockItemProps[];
}

/**
 * Dock - Application launcher dock
 *
 * Displays pinned applications and allows launching them.
 * Positioned at the bottom of the screen.
 */
export const Dock: React.FC<DockProps> = ({ items }) => {
  return (
    <div
      className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-[var(--rb-color-neutral-800)]/80 backdrop-blur-md rounded-[var(--rb-radius-2xl)] px-[var(--rb-spacing-3)] py-[var(--rb-spacing-2)] shadow-[var(--rb-shadow-2xl)] flex gap-[var(--rb-spacing-2)]"
      role="toolbar"
      aria-label="Application Dock"
      data-testid="dock"
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick}
          className="group flex flex-col items-center justify-center w-16 h-16 rounded-[var(--rb-radius-lg)] hover:bg-[var(--rb-color-neutral-700)] transition-colors duration-[var(--rb-duration-fast)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-color-accent-500)]"
          aria-label={item.label}
          title={item.label}
        >
          {item.icon && (
            <div className="w-8 h-8 text-[var(--rb-color-neutral-100)] group-hover:scale-110 transition-transform duration-[var(--rb-duration-fast)]">
              {item.icon}
            </div>
          )}
        </button>
      ))}
    </div>
  );
};
