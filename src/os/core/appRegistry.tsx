import React from "react";
import { AppId } from "./SystemProvider";
import { NotesApp } from "../../apps/NotesApp";
import { TerminalApp } from "../../apps/TerminalApp";
import { SettingsApp } from "../../apps/SettingsApp";
import { SystemMonitorApp } from "../../apps/SystemMonitorApp";
import { FileExplorerApp } from "../../apps/FileExplorerApp";
import { RedstoneSimApp } from "../../apps/RedstoneSimApp";
import { RedstoneLabApp } from "../../apps/RedstoneLabApp";
import { SignalScopeApp } from "../../apps/SignalScopeApp";
import { World3DApp } from "../../apps/World3DApp";
import { WorldMap2DApp } from "../../apps/WorldMap2DApp";
import { RedstoneStatsApp } from "../../apps/RedstoneStatsApp";
import { AnalyzerApp } from "../../apps/AnalyzerApp";

export function getAppComponent(appId: AppId): React.ComponentType {
  switch (appId) {
    case "notes":
      return NotesApp;
    case "terminal":
      return TerminalApp;
    case "settings":
      return SettingsApp;
    case "sysmon":
      return SystemMonitorApp;
    case "files":
      return FileExplorerApp;
    case "sim":
      return RedstoneSimApp;
    case "lab":
      return RedstoneLabApp;
    case "scope":
      return SignalScopeApp;
    case "world3d":
      return World3DApp;
    case "map2d":
      return WorldMap2DApp;
    case "rstats":
      return RedstoneStatsApp;
    case "analyzer":
      return AnalyzerApp;
    default:
      return () => <div>Unknown app</div>;
  }
}




