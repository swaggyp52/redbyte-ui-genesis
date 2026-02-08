// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
export function usePageVisibility() {
    const [visible, setVisible] = useState(() => {
        if (typeof document === 'undefined')
            return true;
        return document.visibilityState === 'visible';
    });
    useEffect(() => {
        if (typeof document === 'undefined')
            return;
        const handleVis = () => {
            setVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVis);
        return () => document.removeEventListener('visibilitychange', handleVis);
    }, []);
    return visible;
}
