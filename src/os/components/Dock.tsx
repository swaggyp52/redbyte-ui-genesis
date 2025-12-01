import React from "react";
import { AppRegistry } from "../state/apps";
import { useWindowManager } from "../state/windowStore";

interface DockProps {
  onLaunchpad?: () => void;
}

const Dock: React.FC<DockProps> = ({ onLaunchpad }) => {
  const open = useWindowManager((s: any) => s.openWindow);

  return (
    <div className="rb-dock-shell">
      <div className="rb-dock">
        <button
          type="button"
          className="rb-dock-item rb-dock-item-launchpad"
          onClick={onLaunchpad}
        >
          <span className="rb-dock-icon">◎</span>
          <span className="rb-dock-label">Launchpad</span>
        </button>

        <span className="rb-dock-divider" />

        {AppRegistry.map((app) => (
          <button
            key={app.id}
            type="button"
            className="rb-dock-item"
            onClick={() => open(app.id)}
          >
            <span className="rb-dock-icon">
              {app.icon ?? "▢"}
            </span>
            <span className="rb-dock-label">{app.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dock;

