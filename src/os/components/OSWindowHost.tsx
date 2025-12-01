import React from "react";
import { useWindowManager } from "../state/windowStore";
import OSWindow from "../../components/os/Window";
import "./oswindowhost.css";

export default function OSWindowHost() {
  const windows = useWindowManager((s) => s.windows);

  return (
    <div className="rb-window-host">
      {windows.map((win) => (
        <OSWindow key={win.id} win={win} />
      ))}
    </div>
  );
}
