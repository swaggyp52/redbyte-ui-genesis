import React, { useState, useEffect } from "react";
import "./index.css";
import LoadingScreen from "./os/ui/LoadingScreen";
import LoginScreen from "./os/ui/LoginScreen";
import DesktopShell from "./os/desktop/DesktopShell";
import { SettingsProvider } from "./os/context/SettingsContext";
import { ProjectProvider } from "./os/context/ProjectContext";
import { LearningProvider } from "./os/context/LearningContext";

const App: React.FC = () => {
  const [phase, setPhase] = useState<"boot" | "login" | "desktop">("boot");
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("login"), 900);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (name: string) => {
    setUser(name || "operator");
    setPhase("desktop");
  };

  return (
    <SettingsProvider>
      <ProjectProvider>
        <LearningProvider>
          {phase === "boot" && <LoadingScreen />}
          {phase === "login" && <LoginScreen onLogin={handleLogin} />}
          {phase === "desktop" && <DesktopShell user={user || "operator"} />}
        </LearningProvider>
      </ProjectProvider>
    </SettingsProvider>
  );
};

export default App;
