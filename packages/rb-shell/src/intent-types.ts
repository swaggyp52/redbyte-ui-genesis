// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export interface OpenWithIntent {
  type: 'open-with';
  payload: {
    sourceAppId: string;
    targetAppId: string;
    resourceId: string;
    resourceType: 'file' | 'folder';
  };
  routingHint?: {
    preferNewWindow?: boolean; // PHASE_AC: if true, always create new window (ignores reuse policy)
  };
}

export type Intent = OpenWithIntent;
