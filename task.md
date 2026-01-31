# Sprint 2 Task 2B: Arduino Instrument Panel

## Status

- [x] Define Arduino Profile
  - [x] Add `arduino.json` to `rb-board-profiles` (if needed) or verify existing one
- [x] Implement Arduino Instrument View
  - [x] Create `ArduinoInstrument.tsx` (Split pane: Mapping/Channels vs Plots/Controls)
  - [x] Implement Strip Chart Component (SVG/Canvas)
  - [x] Implement Controls (PWM Slider, Digital Toggle)
- [x] Update DeployMode
  - [x] Add Board Selector (Basys3 / Arduino)
  - [x] Switch view based on project board profile
- [x] Evidence Capture
  - [x] Implement "Capture Snapshot" button
  - [x] Persist telemetry in evidence
- [x] Verification
  - [x] Map Analog Channel -> Plot updates
  - [x] PWM Control -> Signal update
  - [x] Export/Import restores telemetry
