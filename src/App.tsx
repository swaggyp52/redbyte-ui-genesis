import React from "react";
import { BootScreen } from "./os/boot/BootScreen";
import { Desktop } from "./os/desktop/Desktop";
import { ThemeProvider } from "./theme/ThemeProvider";
import { SystemProvider } from "./os/core/SystemProvider";
import { KernelProvider } from "./kernel/KernelProvider";

export default function App() {
  return (
    <ThemeProvider>
      <KernelProvider>
        <SystemProvider>
          <BootScreen />
          <Desktop />
        </SystemProvider>
      </KernelProvider>
    </ThemeProvider>
  );
}
