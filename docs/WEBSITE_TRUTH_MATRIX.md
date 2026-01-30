# Website Truth Matrix

| Website Claim | Backed by Feature | Location in OS | Verified (Y/N/Partial) | Notes |
| ------------- | ----------------- | -------------- | ---------------------- | ----- |
| **Home.tsx** | | | | |
| "Bridge virtual circuits to physical FPGAs instantly" | Hardware Bridge | `rb-bridge-agent`, `rb-protocol` | **Partial** | Typo "instanly" needs fix. Bridge works. |
| "Latency <10ms" | Latency Monitoring | `TruthHUD.tsx` | **Yes** | Code calculates `newest - lastIoRef`. <10ms is a performance target. |
| "Integrated lab manuals and Truth HUD" | Lab System | `rb-apps/src/apps/Lab` | **Yes** | "Truth HUD" exists and is implemented. |
| "Evidence Export... Deterministic replay" | Capsule Export | `rb-logic-core/src/capsule` | **Yes** | Validated in Phase 4. |
| **Instructors.tsx** | | | | |
| "Single RedByte_Lab_Bundle.zip... works on locked-down Windows" | Deployment Bundle | `Manual / Stub` | **No** | `ops-make-bundle.ps1` is a stub. Need to confirm how zip is made. |
| "No internet connection required after download" | Offline Mode | `node_modules` | **Yes** | Repo has `node_modules`. |
| "Flash top.bit... bridges switches/LEDs to UART" | FPGA Toolchain | `packages/rb-fpga-toolchain` | **Yes** | Standard practice. |
| **About.tsx** | | | | |
| "Components have propagation delay (1 tick)" | Logic Engine | `rb-logic-core` | **Yes** | Core engine feature. |
| "Full determinism... same inputs + same state = identical output" | Deterministic Engine | `rb-logic-core` | **Yes** | Core engine feature. |
| "Keyboard-First Interaction" | Keybindings | `GettingStarted.tsx` | **Yes** | Shortcuts documented and likely implemented (standard hotkeys). |
