import { useState, useEffect } from 'react';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

/**
 * Hook to detect current breakpoint based on window width
 * Mobile: < 640px
 * Tablet: 640px - 1024px
 * Desktop: >= 1024px
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
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
export function useIsMobile(): boolean {
  const breakpoint = useBreakpoint();
  return breakpoint !== 'desktop';
}

/**
 * Returns true if current breakpoint is mobile
 */
export function useIsSmallScreen(): boolean {
  const breakpoint = useBreakpoint();
  return breakpoint === 'mobile';
}
