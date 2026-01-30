# RedByte OS Genesis — Ship-Grade System Map

## App Inventory

### Shell Apps (20 registered)

| App ID | Display Name | Package | Category |
|--------|-------------|---------|----------|
| terminal | Terminal | rb-apps | System |
| settings | Settings | rb-apps | System |
| files | Files | rb-apps | System |
| logic-playground | Logic Playground | rb-apps | **Flagship** |
| ece-lab | ECE 347 Lab | rb-apps | Educational |
| virtual-lab | Virtual Lab | rb-apps | Educational |
| app-store | App Store | rb-apps | System |
| welcome | Welcome | rb-apps | Onboarding |
| start-here | Start Here | rb-apps | Tutorial |
| launcher | Launcher | rb-apps | System |
| system-log | System Log | rb-apps | Debug |
| text-viewer | Text Viewer | rb-apps | Utility |
| logic-help | Logic Help | rb-apps | Help |
| user-manual | User Manual | rb-apps | Documentation |
| hardware-panel | Hardware Panel | rb-apps | FPGA |
| fpga-proof-viewer | FPGA Proof Viewer | rb-apps | Debug |
| lab-examiner | Lab Examiner | rb-apps | Instructor |
| instructor | Instructor Dashboard | rb-apps | Instructor |
| instructor-run-detail | Run Detail | rb-apps | Instructor |
| submission-inspector | Submission Inspector | rb-apps | Inspector |

### Workspace Packages (31 total)

**Core Logic**: rb-logic-core, rb-logic-view, rb-logic-adapter, rb-logic-3d, rb-analog-sim
**Shell/UI**: rb-shell, rb-theme, rb-tokens, rb-icons, rb-primitives, rb-windowing
**Hardware**: rb-protocol, rb-bridge-agent, rb-fpga-bridge, rb-fpga-bridge-contract (legacy)
**Crypto/Proof**: rb-fpga-signing, rb-fpga-proof-core, rb-fpga-grading
**Apps**: rb-apps (mega-package, 11 workspace deps)
**Tooling**: rb-fpga-toolchain, config, board-models
**Frontend**: playground, manual-site, studio, docs

## Core Services

### Recorder Service
- **Store**: `useRunRecorderStore` (packages/rb-apps/src/stores/runRecorderStore.ts)
- **Types**: `RunRecord`, `RunStimulusEvent`, `RunTraceSample` (packages/rb-apps/src/recording/runRecord.ts)
- **Utils**: digest, normalize, mismatch report (packages/rb-apps/src/recording/runRecordUtils.ts)
- **Modes**: idle → armed → recording → idle; idle → replaying → idle

### Evidence Export Service
- **Export**: `exportEvidenceCapsule()` (packages/rb-apps/src/utils/evidenceExport.ts)
- **Verify**: `verifyEvidenceBundle()` (packages/rb-apps/src/utils/verifyEvidence.ts)
- **Viewer Store**: `useEvidenceViewerStore` (packages/rb-apps/src/stores/evidenceViewerStore.ts)
- **Output**: `.rb-lab.zip` containing manifest.json + proofs/capsule.json + proofs/trace.ndjson

### Lab Runtime Grading
- **Evaluator**: `evaluateAtTick()` (packages/rb-logic-3d/src/lab-model/labEvaluator.ts)
- **Templates**: `VIRTUAL_LAB_TEMPLATES` (packages/rb-apps/src/apps/virtual-lab-templates.ts)
- **Check types**: digital_level, blink, serial_matches_pin
- **Output**: `GradeReport` with score 0-100, per-check results, evidence links

### Bridge Client/Server Protocol
- **Protocol Package**: @redbyte/rb-protocol (packages/rb-protocol/src/bridge.ts)
- **Bridge Agent**: Express + WS server (packages/rb-bridge-agent/src/index.ts)
- **Client Singleton**: HardwareClient (packages/rb-apps/src/services/hardwareClient.ts)
- **Session Store**: useHardwareSessionStore (packages/rb-apps/src/stores/hardwareSessionStore.ts)
- **Message Types**: PING, CONNECT, DISCONNECT, GET_PINS, SET_PINS, VERIFY_DEVICE, LIST_DEVICES, UPLOAD_SKETCH

## Zustand Store Map

| Store | Location | Determinism-Critical | Controls |
|-------|----------|---------------------|----------|
| useCircuitStore | rb-apps (lazy) | **YES** | Circuit nodes, connections, undo/redo, engine |
| useLabStore | rb-logic-3d/lab-model/store.ts | **YES** | Graph, timeline, snapshots, simulation, integrity |
| useRunRecorderStore | rb-apps/stores/runRecorderStore.ts | **YES** | Recording mode, stimulus, trace, replay, verification |
| useProbeStore | rb-apps (lazy) | **YES** | Oscilloscope probes, sampling |
| useOscilloscopeStore | rb-apps (lazy) | No | UI state: pause, time window, cursor |
| useHardwareSessionStore | rb-apps/stores/hardwareSessionStore.ts | No | Bridge status, device list, sessions |
| useFileSystemStore | rb-apps | No | Virtual filesystem, files, content |
| useWindowStore | rb-windowing | No | Window positions, z-index, focus |
| useLayoutStore | rb-apps (lazy) | No | Perspective, dock tabs, split mode |
| useViewStateStore | rb-apps | No | Selection, hover, focus, auto-probe |
| useChipStore | rb-apps (lazy) | No | Custom chip definitions |
| useHierarchyStore | rb-apps | No | Chip navigation stack |
| useThemeStore | rb-shell | No | Wallpaper, theme variant |
| useToastStore | rb-primitives | No | Toast notifications |
| useEvidenceViewerStore | rb-apps/stores/evidenceViewerStore.ts | No | Evidence bundle, verification status |

## Pipeline Diagrams

### Evidence Pipeline

```mermaid
flowchart LR
    A[Student interacts<br/>with circuit] -->|input_toggled<br/>hw_io events| B[RunRecorderStore]
    B -->|trace samples<br/>every tick| C[Trace Buffer]
    B -->|stimulus events| D[Stimulus Buffer]

    E[Student clicks<br/>Stop Recording] --> F[stopRecording]
    F -->|normalize + digest| G[RunRecord]
    G -->|circuitSnapshot<br/>engineConfig<br/>probes| G

    H[Student clicks<br/>Export Capsule] --> I[exportEvidenceCapsule]
    I -->|manifest.json| J[ZIP Builder]
    I -->|proofs/capsule.json| J
    I -->|proofs/trace.ndjson| J
    J --> K[.rb-lab.zip download]

    K -->|Import| L[Submission Inspector]
    L -->|Parse ZIP| M{ZIP Parser<br/>MISSING}
    M -->|capsule.json| N[Capsule View]
    M -->|verify hash| O[Integrity Check]
    N --> P[PASS / FAIL verdict]

    style M fill:#f44,color:#fff
```

### Hardware Pipeline

```mermaid
flowchart LR
    A[UI: HardwareSessionStore] -->|boot / setMode auto| B[HardwareClient<br/>Singleton]
    B -->|HTTP GET /health| C[Bridge Agent<br/>Express Server]
    B -->|HTTP GET /devices| C
    B -->|WebSocket connect| D[WS Server<br/>:4242/ws]

    D -->|CONNECT msg| E{Port Mutex<br/>MISSING}
    E -->|acquire lock| F[Backend Factory]
    F -->|ArduinoUnoBackend| G[SerialPort<br/>COM6]
    F -->|Basys3Backend| H[SerialPort<br/>COM7]

    G -->|IO data| I[Parser]
    H -->|IO data| I
    I -->|WS broadcast| D
    D -->|IO snapshot| B
    B -->|subscribeIO| J[HardwareSessionStore]
    J -->|session status| K[TruthHUD]
    J -->|auto-adopt| L[HardwareAutoAdopt<br/>→ 3D Node Spawn]

    B -->|subscribeIO| M[HardwareClientTransport]
    M -->|poll| N[LabStore<br/>simulation.pinStates]

    style E fill:#f44,color:#fff
```

### 3D Lab Pipeline

```mermaid
flowchart TD
    A[LabStore<br/>graph + timeline + simulation] -->|nodes| B[Rb3DSceneLab]
    A -->|wires| C[WireMesh]
    A -->|pinStates| D[PartMesh<br/>LED/Switch visuals]

    B -->|selection| E[TransformControls]
    E -->|onMouseUp| F[updateNodePose]
    F -->|sanitize quaternion<br/>validate graph| A

    A -->|every 200 ticks| G[Snapshot]
    G -->|fingerprintState async| H[Timeline]
    H -->|deriveStateAtTick| I[Replay Scrubber]

    A -->|integrityError?| J{Recovery}
    J -->|rollback to<br/>lastGoodSnapshot| A

    K[HardwareClientTransport] -->|poll| L[propagatePinDiffs<br/>BFS wire adjacency]
    L --> A

    M[Export Capsule] -->|graph + timeline| N[LabCapsule JSON]

    O[Layout Persistence<br/>MISSING] -.->|should save to<br/>localStorage| A

    style O fill:#f44,color:#fff
```
