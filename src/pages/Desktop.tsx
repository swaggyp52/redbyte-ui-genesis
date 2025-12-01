import React from "react";
import BackgroundEngine from "../os/components/BackgroundEngine";
import DesktopIcons from "../os/components/DesktopIcons";
import OSWindowHost from "../os/components/OSWindowHost";

export default function Desktop() {
  return (
    <div className="relative h-screen w-screen">
      <BackgroundEngine />
      <DesktopIcons />
      <OSWindowHost />
    </div>
  );
}
