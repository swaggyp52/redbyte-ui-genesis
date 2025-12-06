# RedByte OS Architecture

## Kernel layer
- **Event bus:** `src/kernel/EventBus.ts` defines a lightweight publish/subscribe bus used to broadcast window lifecycle and layout events across the OS.【F:src/kernel/EventBus.ts†L1-L36】
- **Process tracking:** `src/kernel/ProcessManager.ts` listens to event bus notifications to synthesize a simulated process table, updating CPU/memory metrics and state transitions for window-backed processes.【F:src/kernel/ProcessManager.ts†L1-L116】
- **Kernel provider:** `src/kernel/KernelProvider.tsx` wraps the UI to expose notifications, kernel settings, and the current process list. It also converts window events into user-facing notifications and bootstraps the virtual file system on load.【F:src/kernel/KernelProvider.tsx†L1-L122】【F:src/kernel/KernelProvider.tsx†L156-L189】

## Desktop shell
- **Window manager:** `src/os/core/SystemProvider.tsx` owns the master list of open windows, routes focus/resize/snap actions, and emits window events to the kernel bus for telemetry and notifications.【F:src/os/core/SystemProvider.tsx†L1-L155】
- **Shell surface:** `src/os/desktop/DesktopShell.tsx` renders the desktop chrome, sidebar app launcher, and window frames. It respects layout preferences from `SettingsContext` and spawns app components defined in the app registry.【F:src/os/desktop/DesktopShell.tsx†L1-L139】【F:src/os/desktop/DesktopShell.tsx†L141-L204】

## Application layer
- **Registry:** `src/os/apps/index.ts` enumerates OS apps (Launchpad, Terminal, Notification Center, Agents, File Explorer, Logic Designer, CPU Designer, Notes, System Monitor, Settings) with labels, hints, and multi-instance rules. The `loadApp` helper resolves the React component for a given ID.【F:src/os/apps/index.ts†L1-L60】
- **App windows:** Each registry entry maps to a `src/os/apps/*.tsx` component rendered inside a `WindowFrame` by the desktop shell, giving every tool a consistent windowed surface.【F:src/os/desktop/DesktopShell.tsx†L143-L204】

## Contexts
- **Settings context:** The desktop shell uses settings to choose layout mode and grid size for window snapping and sizing, ensuring consistent behavior across windows.【F:src/os/desktop/DesktopShell.tsx†L11-L34】
- **Project context:** `src/os/context/ProjectContext.tsx` holds the active hardware design state (logic gates, CPU units, historical snapshots) and exposes add/remove helpers used by design apps.【F:src/os/context/ProjectContext.tsx†L1-L128】【F:src/os/context/ProjectContext.tsx†L142-L223】

## Simulation and world modules
- **2D redstone simulator:** `src/sim/RedstoneEngine.ts` provides grid creation, cell editing, and a step function that evaluates sources, wires, gates, and outputs for each tick.【F:src/sim/RedstoneEngine.ts†L1-L104】
- **Logic export & mapping:** `src/logic/LogicExport.ts` and `src/logic/LogicToRedstone.ts` convert logical templates into Verilog-style text or block placements suitable for redstone layouts.【F:src/logic/LogicExport.ts†L1-L103】【F:src/logic/LogicToRedstone.ts†L1-L74】
- **3D world simulation:** `src/world3d/Redstone3DEngine.ts` advances a voxel-based world by computing dust power propagation and evaluating non-wire components, storing snapshots for analysis.【F:src/world3d/Redstone3DEngine.ts†L1-L100】【F:src/world3d/Redstone3DEngine.ts†L102-L168】
- **Bridges:** `src/world3d/RedstoneBuilder.ts` maps logic templates into block placements through a registered 3D world handle, while `src/world3d/BlueprintBridge.ts` moves designs between 2D redstone grids and voxel layers, persisting slices as named blueprints.【F:src/world3d/RedstoneBuilder.ts†L1-L26】【F:src/world3d/BlueprintBridge.ts†L1-L91】【F:src/world3d/BlueprintBridge.ts†L93-L136】

## Data flow highlights
- Design apps consume `ProjectContext` to add or remove gates and CPU units, updating the shared project state and rolling history snapshots for later export or analysis.【F:src/os/apps/LogicDesigner.tsx†L1-L74】【F:src/os/apps/CpuDesigner.tsx†L1-L70】【F:src/os/context/ProjectContext.tsx†L142-L223】
- Logic templates can be transformed into redstone block lists via `mapLogicToRedstone`, then injected into a 3D world through `buildLogicInto3D`, enabling ProjectContext-managed designs to be visualized in simulation space.【F:src/logic/LogicToRedstone.ts†L48-L74】【F:src/world3d/RedstoneBuilder.ts†L12-L26】
- The 3D voxel world can import/export 2D blueprints, allowing data to circulate between the grid simulator, the world renderer, and any stored blueprint assets.【F:src/world3d/BlueprintBridge.ts†L44-L91】【F:src/world3d/BlueprintBridge.ts†L93-L136】
