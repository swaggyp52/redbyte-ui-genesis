// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Command } from '../CommandPalette';
import type { OpenWithIntent } from '../intent-types';
import type { MacroExecutionResult } from './macroTypes';
import { useMacroStore } from './macroStore';

export interface MacroExecutionContext {
  executeCommand: (command: Command) => void;
  openWindow: (appId: string, props?: Record<string, unknown>) => void;
  dispatchIntent: (intent: OpenWithIntent) => void;
  switchWorkspace: (workspaceId: string) => boolean;
  getApp: (appId: string) => unknown;
}

export function executeMacro(macroId: string, context: MacroExecutionContext): MacroExecutionResult {
  const macro = useMacroStore.getState().getMacro(macroId);

  if (!macro) {
    return { success: false, error: 'Macro not found', stepIndex: -1 };
  }

  for (let i = 0; i < macro.steps.length; i++) {
    const step = macro.steps[i];

    try {
      switch (step.type) {
        case 'command': {
          context.executeCommand(step.commandId);
          break;
        }

        case 'openApp': {
          const app = context.getApp(step.appId);
          if (!app) {
            return { success: false, error: `Unknown app: ${step.appId}`, stepIndex: i };
          }
          context.openWindow(step.appId, step.props);
          break;
        }

        case 'intent': {
          context.dispatchIntent(step.intent);
          break;
        }

        case 'switchWorkspace': {
          const success = context.switchWorkspace(step.workspaceId);
          if (!success) {
            return { success: false, error: `Unknown workspace: ${step.workspaceId}`, stepIndex: i };
          }
          break;
        }

        default: {
          return { success: false, error: `Unknown step type`, stepIndex: i };
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stepIndex: i,
      };
    }
  }

  return { success: true };
}
