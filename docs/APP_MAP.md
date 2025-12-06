# OS Application Map

| App | Purpose | Primary Files |
| --- | --- | --- |
| Launchpad | Shows a quick catalog of available RedByte OS tools for fast launching. | `src/os/apps/Launchpad.tsx` rendered via registry entry in `src/os/apps/index.ts`. |
| Neon Terminal | Simple interactive command console supporting help, echo, time, and about commands. | `src/os/apps/Terminal.tsx`; registered in `src/os/apps/index.ts`. |
| Notification Center | Lists kernel notifications generated from window lifecycle events. | `src/os/apps/NotificationCenter.tsx`; events surfaced through `src/kernel/KernelProvider.tsx`. |
| Agents | Surface for dispatching or inspecting registered AI agents. | `src/os/apps/AgentPanel.tsx`; registration in `src/os/apps/index.ts`. |
| File Explorer | Presents project files and assets within a windowed browser. | `src/os/apps/FileExplorer.tsx`; exposed through `src/os/apps/index.ts`. |
| Logic Designer | Adds/removes logic gates stored in `ProjectContext` as the data backbone for circuit design. | `src/os/apps/LogicDesigner.tsx` consuming `src/os/context/ProjectContext.tsx`. |
| CPU Designer | Manages CPU unit inventory (ALU, registers, control, etc.) in the shared project state. | `src/os/apps/CpuDesigner.tsx` using `src/os/context/ProjectContext.tsx`. |
| Notes | Scratchpad for jotting down ideas during a session. | `src/os/apps/Notes.tsx`; wired in `src/os/apps/index.ts`. |
| System Monitor | Visualizes process telemetry synthesized by the kernel process manager. | `src/os/apps/SystemMonitor.tsx` paired with `src/kernel/ProcessManager.ts`. |
| Settings | Adjusts layout preferences like grid snapping and layout mode for the desktop shell. | `src/os/apps/Settings.tsx` with settings consumed by `src/os/desktop/DesktopShell.tsx`. |

## Data flow note
App state is synchronized via contexts and the kernel bus: design apps mutate `ProjectContext`, monitoring apps read kernel-managed processes and notifications, and the shell uses settings to determine how app windows are positioned when spawned from the registry.【F:src/os/context/ProjectContext.tsx†L142-L223】【F:src/kernel/ProcessManager.ts†L1-L116】【F:src/os/desktop/DesktopShell.tsx†L11-L34】【F:src/os/apps/index.ts†L1-L60】
