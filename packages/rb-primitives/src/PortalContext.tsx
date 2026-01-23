// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { createContext, useContext, type ReactNode } from 'react';

interface PortalContextValue {
    /** The DOM element to portal into. If null, defaults to document.body. */
    container: Element | null;
}

const PortalContext = createContext<PortalContextValue>({ container: null });

export interface PortalProviderProps {
    container: Element | null;
    children: ReactNode;
}

/**
 * Provider to specify a window-scoped portal target.
 * Modals and Portals will look for this container before falling back to document.body.
 */
export const PortalProvider: React.FC<PortalProviderProps> = ({ container, children }) => {
    return (
        <PortalContext.Provider value={{ container }}>
            {children}
        </PortalContext.Provider>
    );
};

export function usePortalContainer(): Element | null {
    return useContext(PortalContext).container;
}
