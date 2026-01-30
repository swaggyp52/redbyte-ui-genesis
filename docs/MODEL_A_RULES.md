# Model A Architecture Rules: Hardware & Lab Synchronization

To maintain "Ship-Grade" stability and prevent race conditions or duplicate hardware sessions, all developers MUST adhere to the following rules when interacting with the hardware layer.

## 1. The Hardware Singleton Rule

**NEVER** instantiate `HardwareClient` or `BridgeAgent` directly.

- **Source of Truth**: Always use the singleton exported from `@redbyte/rb-apps/services/hardwareClient`.
- **Reasoning**: Multiple clients competing for the same COM port will cause silent bridge failures and protocol corruption.

## 2. Store Authority

- **Primary State**: `useHardwareSessionStore` is the administrative authority for active sessions and auto-adoption.
- **3D Sync**: `useLabStore` handles the projection of hardware state into the visual layer.
- **Interconnect**: Use `HardwareClientTransport` to bridge high-frequency I/O between the global client and localized lab stores.

## 3. High-Resolution Recording

All hardware I/O events MUST be logged with `window.rbTickCount` synchronization.

- **Event Types**: Use `hw_io` for pin level changes and `hw_connect` for session lifecycle.
- **Trace Format**: Adhere to `HardwareTraceV1` (NDJSON) for all external evidence capsules.

## 4. Interaction Invariants

- **Vertical Lock**: 3D Nodes (Basys3, Uno) must have fixed Y-axes in the lab environment to prevent alignment clipping.
- **Auto-Adopt**: All real-world hardware connections MUST automatically spawn their 3D counterparts if configured in `LabTemplate`.

## 5. Error Handling

- **No Silent Failures**: All connection errors must overflow to the `TruthHUD` or a global error boundary.
- **Recovery**: If the bridge disconnects, the system must enter `fallback:mock` mode gracefully without crashing the UI.

---
*Signed, Antigravity (Quality Shield)*
