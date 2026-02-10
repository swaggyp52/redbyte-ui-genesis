import { useState, useEffect } from 'react';
/**
 * Hook to detect current breakpoint based on window width
 * Mobile: < 640px
 * Tablet: 640px - 1024px
 * Desktop: >= 1024px
 */
export function useBreakpoint() {
    const [breakpoint, setBreakpoint] = useState('desktop');
    useEffect(() => {
        const updateBreakpoint = () => {
            const width = window.innerWidth;
            if (width < 640) {
                setBreakpoint('mobile');
            }
            else if (width < 1024) {
                setBreakpoint('tablet');
            }
            else {
                setBreakpoint('desktop');
            }
        };
        updateBreakpoint();
        window.addEventListener('resize', updateBreakpoint);
        return () => window.removeEventListener('resize', updateBreakpoint);
    }, []);
    return breakpoint;
}
/**
 * Returns true if current breakpoint is mobile or tablet
 */
export function useIsMobile() {
    const breakpoint = useBreakpoint();
    return breakpoint !== 'desktop';
}
/**
 * Returns true if current breakpoint is mobile
 */
export function useIsSmallScreen() {
    const breakpoint = useBreakpoint();
    return breakpoint === 'mobile';
}
