import type { AppDefinition } from "./types";
import { RootConsole } from "../root/RootConsole";
import { LaunchpadApp } from "../apps/Launchpad";
import { NotificationCenterApp } from "../apps/NotificationCenter";
import { AgentPanelApp } from "../apps/AgentPanel";
import { SettingsApp } from "../apps/Settings";
import { TerminalApp } from "../apps/Terminal";
import { SystemMonitorApp } from "../apps/SystemMonitor";

const PlaceholderApp: React.FC = () => {
  return (
    <div className="text-xs text-slate-300 space-y-1">
      <p className="font-semibold text-slate-100">Coming soon</p>
      <p className="text-slate-400">
        This app has been registered but not wired up yet.
      </p>
    </div>
  );
};

export const apps: AppDefinition[] = [
  {
    id: "launchpad",
    name: "Launchpad",
    group: "system",
    entry: LaunchpadApp,
    description: "Grid view of installed OS apps.",
    icon: "◻︎",
  },
  {
    id: "root-console",
    name: "/root console",
    group: "system",
    entry: RootConsole,
    description: "System logs, services, and deploy status.",
    icon: "⌥",
  },
  {
    id: "system-monitor",
    name: "System Monitor",
    group: "system",
    entry: SystemMonitorApp,
    description: "Synthetic CPU, memory, disk and agent stats.",
    icon: "☲",
  },
  {
    id: "notifications",
    name: "Notification Center",
    group: "system",
    entry: NotificationCenterApp,
    description: "Synthetic notification feed for OS events.",
    icon: "✶",
  },
  {
    id: "agents",
    name: "Agents",
    group: "agents",
    entry: AgentPanelApp,
    description: "View and simulate agent executions.",
    icon: "λ",
  },
  {
    id: "settings",
    name: "Settings",
    group: "system",
    entry: SettingsApp,
    description: "Themes and workspace preferences.",
    icon: "⚙︎",
  },
  {
    id: "terminal",
    name: "Neon Terminal",
    group: "dev",
    entry: TerminalApp,
    description: "Simulated shell for RedByte OS.",
    icon: ">_",
  },
  {
    id: "dev-placeholder",
    name: "Dev Tools",
    group: "dev",
    entry: PlaceholderApp,
    description: "Future developer utilities.",
    icon: "⌗",
  },
];




















