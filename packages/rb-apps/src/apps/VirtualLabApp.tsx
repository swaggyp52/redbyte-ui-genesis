// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { Suspense } from 'react';
import type { RedByteApp } from '../types';

// IMPORTANT: keep @redbyte/rb-logic-3d out of the boot graph.
// Virtual Lab is 3D-heavy and must only load when explicitly opened.
const VirtualLabAppLazy = React.lazy(async () => {
  if (import.meta.env.DEV) {
    console.log('[lazy] Loading VirtualLabAppImpl (logic-3d stack)');
  }
  const mod = await import('./VirtualLabAppImpl');
  return { default: mod.default };
});

interface VirtualLabAppProps {
  resourceId?: string;
  resourceType?: 'file' | 'folder';
  windowId?: string;
}

const VirtualLabAppStub: React.FC<VirtualLabAppProps> = (props) => (
  <Suspense
    fallback={
      <div className="h-full w-full flex items-center justify-center text-[11px] text-gray-400 bg-[#111]">
        Loading Virtual Lab…
      </div>
    }
  >
    <VirtualLabAppLazy {...props} />
  </Suspense>
);

export const VirtualLabApp: RedByteApp = {
  manifest: {
    id: 'virtual-lab',
    name: 'Virtual Bench',
    iconId: 'tool-build',
    category: 'tools',
    defaultSize: { width: 1200, height: 800 },
    minSize: { width: 800, height: 600 },
    hidden: true,
  },
  component: VirtualLabAppStub,
};
