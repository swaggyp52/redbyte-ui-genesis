import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginScreen from "../os/login/LoginScreen";
import DesktopShell from "../os/desktop/DesktopShell";

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/desktop" element={<DesktopShell />} />
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
