import Overview from "../../pages/Overview";
import Terminal from "../../pages/Terminal";
import Playground from "../../pages/Playground";
import SystemKit from "../../pages/SystemKit";
import HUD from "../../pages/HUD";

export const AppRegistry = [
  {
    id: "overview",
    title: "Overview",
    shortLabel: "Overview",
    component: Overview,
  },
  {
    id: "terminal",
    title: "Terminal",
    shortLabel: "Term",
    component: Terminal,
  },
  {
    id: "playground",
    title: "Playground",
    shortLabel: "Play",
    component: Playground,
  },
  {
    id: "systemkit",
    title: "System Kit",
    shortLabel: "System",
    component: SystemKit,
  },
  {
    id: "hud",
    title: "HUD",
    shortLabel: "HUD",
    component: HUD,
  },
];
