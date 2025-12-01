import React from "react";
import BackgroundEngine from "../os/components/BackgroundEngine";
import DesktopIcons from "../os/components/DesktopIcons";
import OSWindowHost from "../os/components/OSWindowHost";

const Desktop = () => {
  return (
    <div className="rb-desktop">
      <BackgroundEngine />
      <DesktopIcons />
      <OSWindowHost />
    </div>
  );
};

export default Desktop;
