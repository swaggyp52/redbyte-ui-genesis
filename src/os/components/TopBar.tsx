import React, { useEffect, useState } from "react";

interface TopBarProps {
  onLaunchpad?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onLaunchpad }) => {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="rb-topbar">
      <div className="rb-topbar-left">
        <span className="rb-topbar-orb" />
        <span className="rb-topbar-brand">REDBYTE OS • Desktop</span>
        <span className="rb-topbar-tag">ONLINE</span>
      </div>

      <div className="rb-topbar-center">
        <button
          className="rb-topbar-mission"
          onClick={onLaunchpad}
          type="button"
        >
          ⌘ Launchpad
        </button>
      </div>

      <div className="rb-topbar-right">
        <span className="rb-topbar-signal">
          <span className="rb-signal-dot" />
          <span className="rb-signal-dot" />
          <span className="rb-signal-dot" />
        </span>
        <span className="rb-topbar-time">{time}</span>
      </div>
    </header>
  );
};

export default TopBar;

