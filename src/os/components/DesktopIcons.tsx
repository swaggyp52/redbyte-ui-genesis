import React from "react";
import { AppRegistry } from "../state/apps";
import { useWindowManager } from "../state/windowStore";
import "./desktopicons.css";

export default function DesktopIcons() {
  const open = useWindowManager(s => s.openWindow);

  return (
    <div className="rb-icon-wrap">
      {AppRegistry.map(app => (
        <div key={app.id} className="rb-icon" onClick={() => open(app.id)}>
          <div className="rb-icon-square">
            <span>{app.title[0]}</span>
          </div>
          <p>{app.title}</p>
        </div>
      ))}
    </div>
  );
}

