import { useCallback, useEffect, useRef, useState } from 'react';

export function useLauncherSearchToggle() {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return;
      if (target?.isContentEditable) return;

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsLauncherOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const closeLauncher = useCallback(() => {
    setIsLauncherOpen(false);

    setTimeout(() => {
      shellRef.current?.focus();
    }, 0);
  }, []);

  return { isLauncherOpen, closeLauncher, shellRef } as const;
}
