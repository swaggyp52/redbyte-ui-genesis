import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { createContext, useContext } from 'react';
const ShellContext = createContext(null);
export const ShellProvider = ({ value, children, }) => {
    return _jsx(ShellContext.Provider, { value: value, children: children });
};
export function useShell() {
    const ctx = useContext(ShellContext);
    if (!ctx) {
        throw new Error('useShell must be used within ShellProvider');
    }
    return ctx;
}
