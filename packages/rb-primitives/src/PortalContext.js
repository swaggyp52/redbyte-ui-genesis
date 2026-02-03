import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { createContext, useContext } from 'react';
const PortalContext = createContext({ container: null });
/**
 * Provider to specify a window-scoped portal target.
 * Modals and Portals will look for this container before falling back to document.body.
 */
export const PortalProvider = ({ container, children }) => {
    return (_jsx(PortalContext.Provider, { value: { container }, children: children }));
};
export function usePortalContainer() {
    return useContext(PortalContext).container;
}
