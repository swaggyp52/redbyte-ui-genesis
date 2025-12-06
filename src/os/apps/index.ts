import FileExplorer from "./FileExplorer";
import LogicDesigner from "./LogicDesigner";
import CPUDesigner from "./CPUDesigner";
import Terminal from "./Terminal";
import Notes from "./Notes";
import SystemMonitor from "./SystemMonitor";
import Settings from "./Settings";

export type AppId =
    | "file"
    | "logic"
    | "cpu"
    | "terminal"
    | "notes"
    | "monitor"
    | "settings";

export interface AppDefinition {
    id: AppId;
    label: string;
    hint: string;
    allowMultiple: boolean;
    component: React.FC<any>;
}

export const OS_APPS: AppDefinition[] = [
    { id: "file",     label: "File Explorer",  hint: "browse project tree",    allowMultiple: false, component: FileExplorer },
    { id: "logic",    label: "Logic Designer", hint: "gates & circuits",       allowMultiple: true,  component: LogicDesigner },
    { id: "cpu",      label: "CPU Designer",   hint: "components & units",     allowMultiple: true,  component: CPUDesigner },
    { id: "terminal", label: "Terminal",       hint: "shell & tools",          allowMultiple: true,  component: Terminal },
    { id: "notes",    label: "Notes",          hint: "scratchpad",             allowMultiple: true,  component: Notes },
    { id: "monitor",  label: "System Monitor", hint: "graphs & diagnostics",   allowMultiple: false, component: SystemMonitor },
    { id: "settings", label: "Settings",       hint: "theme & layout config",  allowMultiple: false, component: Settings },
];

export function loadApp(id: AppId) {
    const app = OS_APPS.find(a => a.id === id);
    return app ? app.component : () => <div />;
}
