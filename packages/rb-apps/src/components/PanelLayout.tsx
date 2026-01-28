import React from 'react';

interface PanelLayoutProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    className?: string;
    headerClassName?: string;
    bodyClassName?: string;
}

/**
 * A standardized layout container for panels that ensures proper scrolling behavior.
 * Enforces the "Single Scroll Region" pattern:
 * - Root: flex col, min-h-0, h-full (fills parent)
 * - Header: shrink-0 (never collapses)
 * - Body: flex-1, min-h-0, overflow-auto (scrolls internally)
 */
export const PanelLayout: React.FC<PanelLayoutProps> = ({
    children,
    header,
    className = '',
    headerClassName = '',
    bodyClassName = '',
}) => {
    return (
        <div className={`flex flex-col h-full min-h-0 min-w-0 bg-gray-900 ${className}`}>
            {header && (
                <div className={`shrink-0 border-b border-gray-800 p-4 ${headerClassName}`}>
                    {header}
                </div>
            )}
            <div className={`flex-1 min-h-0 min-w-0 overflow-auto p-4 ${bodyClassName}`}>
                {children}
            </div>
        </div>
    );
};
