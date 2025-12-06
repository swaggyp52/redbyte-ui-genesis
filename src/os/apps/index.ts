import React, { ComponentType } from "react";
import { LaunchpadApp } from "./Launchpad";
import TerminalApp from "./Terminal";
import { NotificationCenterApp } from "./NotificationCenter";
import { AgentPanelApp } from "./AgentPanel";
import FileExplorer from "./FileExplorer";
import LogicDesigner from "./LogicDesigner";
import CPUDesigner from "./CpuDesigner";
import NotesApp from "./Notes";
import SystemMonitor from "./SystemMonitor";
import SettingsApp from "./Settings";

export type AppId = string;

export interface AppDefinition {
    id: AppId;
    label: string;
    hint: string;
    component: ComponentType;
    allowMultiple?: boolean;
}

export const OS_APPS: AppDefinition[] = [
    {
        id: "launchpad",
        label: "Launchpad",
        hint: "Overview of installed RedByte OS modules",
        component: LaunchpadApp,
        allowMultiple: false,
    },
    {
        id: "terminal",
        label: "Neon Terminal",
        hint: "Run commands inside the virtual workstation",
        component: TerminalApp,
        allowMultiple: true,
    },
    {
        id: "notifications",
        label: "Notification Center",
        hint: "Review recent system alerts and messages",
        component: NotificationCenterApp,
        allowMultiple: false,
    },
    {
        id: "agents",
        label: "Agents",
        hint: "Dispatch and inspect registered AI agents",
        component: AgentPanelApp,
        allowMultiple: false,
    },
    {
        id: "files",
        label: "File Explorer",
        hint: "Project structure and assets overview",
        component: FileExplorer,
        allowMultiple: true,
    },
    {
        id: "logic",
        label: "Logic Designer",
        hint: "Visual gate layout and wiring prototype",
        component: LogicDesigner,
        allowMultiple: false,
    },
    {
        id: "cpu",
        label: "CPU Designer",
        hint: "Define CPU units and architecture blocks",
        component: CPUDesigner,
        allowMultiple: false,
    },
    {
        id: "notes",
        label: "Notes",
        hint: "Scratchpad for ideas and session notes",
        component: NotesApp,
        allowMultiple: true,
    },
    {
        id: "monitor",
        label: "System Monitor",
        hint: "Live resource telemetry and process stats",
        component: SystemMonitor,
        allowMultiple: false,
    },
    {
        id: "settings",
        label: "Settings",
        hint: "Configure layout, grid, and system prefs",
        component: SettingsApp,
        allowMultiple: false,
    },
];

export function loadApp(id: AppId) {
    const app = OS_APPS.find(a => a.id === id);
    return (
        app?.component ||
        (() => React.createElement("div", { className: "p-3 text-xs text-red-200" }, `Unknown App: ${id}`))
    );
}
