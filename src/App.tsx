import React, { useState } from "react";
import BootScreen from "./os/boot/BootScreen";
import LoginScreen from "./os/login/LoginScreen";
import DesktopShell from "./os/desktop/DesktopShell";
import "./global.css";

type Phase = "boot" | "login" | "desktop";

const App: React.FC = () => {
  const [phase, setPhase] = useState<Phase>("boot");
  const [user, setUser] = useState<string>("1642");

  return (
    <div className="h-screen w-screen overflow-hidden bg-black text-slate-50">
      {phase === "boot" && (
        <BootScreen onComplete={() => setPhase("login")} />
      )}

      {phase === "login" && (
        <LoginScreen
          onSuccess={(handle: string) => {
            setUser(handle || "operator");
            setPhase("desktop");
          }}
        />
      )}

      {phase === "desktop" && <DesktopShell user={user} />}
    </div>
  );
};

export default App;
