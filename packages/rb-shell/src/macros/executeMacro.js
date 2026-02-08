// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useMacroStore } from './macroStore';
export function executeMacro(macroId, context) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                stepIndex: i,
            };
        }
    }
    return { success: true };
}
