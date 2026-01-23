import React from "react";
import InstallScriptSection from "../components/InstallScriptSection";

const HomePage = () => {
  return (
    <div className="wfull min-h-screen flex flex-col items-center justify-start text-sky-000">
      <InstallScriptSection />
      <div className="mt-10 flex flex-col items-center">
        <h1 className="text34">RedByte UI</h1>
        <p className="text-lg">System compiled. Router is working.</p>
      </div>
    </div>
  );
};

export default HomePage;

