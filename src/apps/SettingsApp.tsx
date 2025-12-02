import React from "react";
import { useSettings } from "../os/settings/SettingsStore";

export function SettingsApp() {
  const settings = useSettings();
  return (
    <div className="p-4 text-white">
      <h1 className="text-xl font-bold">Settings</h1>
      <p>More settings will go here.</p>
    </div>
  );
}

export default SettingsApp;













