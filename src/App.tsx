import React, { useState } from "react";
import BootScreen from "./os/boot/BootScreen";
import LoginScreen from "./os/login/LoginScreen";
import DesktopShell from "./os/desktop/DesktopShell";
import "./global.css";

type AppPhase = "boot" | "login" | "desktop";

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>("boot");
  const [user, setUser] = useState<string>("operator");

  const handleBootComplete = () => {
    setPhase("login");
  };

  const handleLoginSuccess = (handle: string) => {
    setUser(handle);
    setPhase("desktop");
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 overflow-hidden">
      {phase === "boot" && <BootScreen onComplete={handleBootComplete} />}
      {phase === "login" && <LoginScreen onSuccess={handleLoginSuccess} />}
      {phase === "desktop" && <DesktopShell user={user} />}
    </div>
  );
};

export default App;
