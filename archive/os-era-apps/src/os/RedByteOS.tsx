import React from "react";
import DesktopShell from "./desktop/DesktopShell";
import { ProjectProvider } from "./context/ProjectContext";

export default function RedByteOS() {
    return (
        <ProjectProvider>
            <DesktopShell user="operator" />
        </ProjectProvider>
    );
}
