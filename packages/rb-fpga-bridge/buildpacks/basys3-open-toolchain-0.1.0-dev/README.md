# Basys3 Open Toolchain Buildpack (Dev Fixture)

This fixture is a **dev-only** buildpack seed for Basys3 (`xc7a35t`).

## Purpose

- Validate buildpack install/verify wiring.
- Validate planner command path resolution (`source: buildpack`).
- Validate deterministic checksum generation for `buildpack.json`.

It is intentionally minimal and does **not** include a complete open FPGA toolchain.

## Contents

- `buildpack.json`: manifest template (`name/version/platformKey/contractId/tools/files`).
- `bin/*`: placeholder executable paths for platform layout.
- `share/`, `licenses/`: placeholders for future assets/licenses.

## Populate + hash workflow

1. Replace placeholder binaries/assets with real payload files.
2. Run:
   - `node packages/rb-fpga-bridge/scripts/buildpack-hash.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`
   - release validation:
     - `node packages/rb-fpga-bridge/scripts/buildpack-release-check.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev --skip-tool-exec`
   - or one-command package:
     - `node packages/rb-fpga-bridge/scripts/buildpack-zip.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`
3. Zip the folder using the printed command.
4. Install via Toolchain Setup using a `file://` URL.
