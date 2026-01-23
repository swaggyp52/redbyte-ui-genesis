// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePortalContainer } from './PortalContext';

export interface PortalProps {
  children: ReactNode;
  container?: Element | null;
}

/**
 * Portal component that renders children into document.body by default.
 * This ensures modals and overlays escape local stacking contexts.
 * Can be scoped to a window using PortalProvider.
 */
export function Portal({ children, container: explicitContainer }: PortalProps) {
  const [mounted, setMounted] = useState(false);
  const contextContainer = usePortalContainer();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const target = explicitContainer || contextContainer || document.body;

  if (import.meta.env.DEV) {
    const isOsMode = !!document.querySelector('[data-rb-shell-root]');
    if (isOsMode && !contextContainer && !explicitContainer) {
      console.warn(
        '[RedByte] Portal mounting to document.body in OS mode! ' +
        'This will likely cause a Modal Capture Bug. ' +
        'Ensure your component is wrapped in a PortalProvider (usually via ShellWindow).'
      );
    }
  }

  return createPortal(children, target);
}
