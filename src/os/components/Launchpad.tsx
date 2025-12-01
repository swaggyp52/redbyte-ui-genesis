import React from "react";
import { AppRegistry } from "../state/apps";
import { useWindowManager } from "../state/windowStore";

interface LaunchpadProps {
  onClose: () => void;
}

const Launchpad: React.FC<LaunchpadProps> = ({ onClose }) => {
  const open = useWindowManager((s: any) => s.openWindow);

  const handleOpen = (id: string) => {
    open(id);
    onClose();
  };

  return (
    <div className="rb-launchpad-overlay" onClick={onClose}>
      <div
        className="rb-launchpad"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rb-launchpad-header">
          <div>
            <div className="rb-launchpad-title">Launchpad</div>
            <div className="rb-launchpad-subtitle">
              All systems & tools in one grid.
            </div>
          </div>
          <button
            type="button"
            className="rb-launchpad-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="rb-launchpad-grid">
          {AppRegistry.map((app) => (
            <button
              key={app.id}
              type="button"
              className="rb-launchpad-app"
              onClick={() => handleOpen(app.id)}
            >
              <div className="rb-launchpad-app-icon">
                {app.icon ?? "▢"}
              </div>
              <div className="rb-launchpad-app-title">
                {app.title}
              </div>
              {app.description && (
                <div className="rb-launchpad-app-sub">
                  {app.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Launchpad;
