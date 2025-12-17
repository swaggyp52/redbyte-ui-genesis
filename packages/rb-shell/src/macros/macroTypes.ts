// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Command } from '../CommandPalette';
import type { OpenWithIntent } from '../intent-types';

export type MacroStep =
  | { type: 'command'; commandId: Command }
  | { type: 'openApp'; appId: string; props?: Record<string, unknown> }
  | { type: 'intent'; intent: OpenWithIntent }
  | { type: 'switchWorkspace'; workspaceId: string };

export interface Macro {
  id: string;
  name: string;
  steps: MacroStep[];
}

export type MacroExecutionResult =
  | { success: true }
  | { success: false; error: string; stepIndex: number };
