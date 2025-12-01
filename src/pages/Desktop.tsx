import React, { useState } from "react";

import BackgroundEngine from "../os/components/BackgroundEngine";
import DesktopIcons from "../os/components/DesktopIcons";
import OSWindowHost from "../os/components/OSWindowHost";
import Dock from "../os/components/Dock";
import TopBar from "../os/components/TopBar";
import Launchpad from "../os/components/Launchpad";

import "../os/styles/engine.css";
import "../styles/desktop.css";

export default function Desktop() {
  const [showLaunchpad, setShowLaunchpad] = useState(false);

  return (
    <div className="rb-desktop-root">
      {/* Background / engine */}
      <BackgroundEngine />

      {/* Top status bar */}
      <TopBar onLaunchpad={() => setShowLaunchpad(true)} />

      {/* Desktop icons / shortcuts */}
      <DesktopIcons />

      {/* Window manager host */}
      <OSWindowHost />

      {/* Dock */}
      <Dock onLaunchpad={() => setShowLaunchpad(true)} />

      {/* Launchpad overlay */}
      {showLaunchpad && (
        <Launchpad onClose={() => setShowLaunchpad(false)} />
      )}
    <BackgroundEngine /></div>
  );
}

