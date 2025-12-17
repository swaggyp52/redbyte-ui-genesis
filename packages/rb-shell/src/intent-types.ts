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
}

export type Intent = OpenWithIntent;
