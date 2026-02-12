import React from "react";
import { Shell } from "@redbyte/rb-shell";
import { ToolchainSetupComponent } from "@redbyte/rb-apps/apps/ToolchainSetupApp";
import "./index.css";

const App: React.FC = () => {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname === "/toolchain" || pathname === "/setup") {
      return <ToolchainSetupComponent />;
    }
  }

  return <Shell />;
};

export default App;
