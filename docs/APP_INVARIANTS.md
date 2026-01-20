# App Invariants

Each app is a typed view over the global state machine. Apps may only mutate
the state they explicitly own and must emit explicit artifacts.

## Logic Playground
- Reads: circuit state, example library, file system (rblogic files)
- Mutates: circuit store, probe store, settings (tick rate)
- Outputs: `rb-debug-bundle.json`, `.rbproj.zip`, optional `.rblogic` files
- Invariant: all circuit mutations are explicit; no hidden auto-edits

## Student Lab
- Reads: lab template, bridge telemetry, trace events
- Mutates: connection state, trace recording state
- Outputs: `.rb-lab.zip` bundle (schema v2)
- Invariant: export uses deterministic bundle paths and capsule signing rules

## Submission Inspector
- Reads: bundle contents (manifest, trace, integrity, bitstream)
- Mutates: replay cursor only (no mutation of bundle data)
- Outputs: grading report JSON
- Invariant: evaluation is pure and reproducible from bundle inputs

## Terminal
- Reads: settings, file list, app registry
- Mutates: settings (theme, wallpaper, tick rate) only via explicit commands
- Outputs: command log entries
- Invariant: no shell execution; allowlist only

## Files
- Reads/Writes: virtual filesystem store
- Outputs: explicit file entries only (no implicit overwrites)
