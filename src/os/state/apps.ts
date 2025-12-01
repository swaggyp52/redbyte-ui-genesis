import Terminal from "../../pages/Terminal";
import Playground from "../../pages/Playground";
import SystemKit from "../../pages/SystemKit";
import HUD from "../../pages/HUD";
import Overview from "../../pages/Overview";

export const AppRegistry = [
  {
    id: "overview",
    title: "Overview",
    component: Overview,
    icon: "☰",
    description: "Mission briefing for RedByte OS.",
  },
  {
    id: "terminal",
    title: "Terminal",
    component: Terminal,
    icon: "⌨",
    description: "System shell & command surface.",
  },
  {
    id: "playground",
    title: "Playground",
    component: Playground,
    icon: "⚙",
    description: "Build, test, and break things safely.",
  },
  {
    id: "systemkit",
    title: "System Kit",
    component: SystemKit,
    icon: "🧩",
    description: "Diagnostics and internal tooling.",
  },
  {
    id: "hud",
    title: "HUD",
    component: HUD,
    icon: "👁",
    description: "Live telemetry and overlays.",
  },
];
