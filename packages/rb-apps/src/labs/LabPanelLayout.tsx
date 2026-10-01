import React from 'react';

interface LabPanelLayoutProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    className?: string;
    headerClassName?: string;
    bodyClassName?: string;
}

/**
 * Presentation owned by the retained guided-lab consumers. JSX and defaults
 * preserve the removed PanelLayout's header/body scroll contract exactly.
 * This component does not register a surface or own any lab/runtime state.
 */
export const LabPanelLayout: React.FC<LabPanelLayoutProps> = ({
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
