# Basys3 Open Buildpack v0 (Developer Notes)

This is the minimal buildpack contract for the Golden Demo path (`Switches -> LEDs`) on Basys3.

## Scope

- Board: `basys3` only
- Backend: `buildpack-open`
- Goal: produce deterministic `out/top.bit` for implement runs

## Required buildpack manifest shape

Create `buildpack.json` at the root of the buildpack archive/folder:

```json
{
  "name": "basys3-open-toolchain",
  "version": "0.1.0-dev",
  "platformKey": "win32-x64",
  "contractId": "basys3-f4pga-v0",
  "files": [
    { "path": "bin/f4pga.exe", "sha256": "<sha256>" },
    { "path": "share/xc7/devdb.dat", "sha256": "<sha256>" }
  ],
  "tools": [
    { "name": "f4pga", "relPath": "bin/f4pga.exe", "version": "0.1.0-dev" }
  ]
}
```

Notes:
- `files[]` is authoritative for integrity verification.
- `tools[]` is authoritative for resolver-selected executable paths.
- `platformKey` must match runtime (`<process.platform>-<process.arch>`).
- `contractId` is the planner signature for Basys3 buildpack-open selection.

## Expected planner command contract (`buildpack-open`)

Planner emits:
- `f4pga build --flow xc7 --part xc7a35tcpg236-1 --top <top> --sources <sources> --xdc <constraints> --out out`
- `f4pga build --stage place_route --out out`
- `f4pga build --stage bitstream --out out`

Expected output paths:
- `out/top.eblif`
- `out/top.fasm`
- `out/top.bit`

## Local install workflow (`file://`)

Fixture location:

- `packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`

### 1) Refresh manifest hashes

Run:

- `node packages/rb-fpga-bridge/scripts/buildpack-hash.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`

This updates `buildpack.json.files[]` with deterministic sorted SHA256 entries (normalized `/` paths).

### 2) Create zip

Use the zip command printed by the hash script. Default output path:

- `packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev-win32-x64.zip`

### 2b) One-command hash + zip

Run:

- `node packages/rb-fpga-bridge/scripts/buildpack-zip.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`

Or via package script:

- `pnpm --filter @redbyte/fpga-bridge run buildpack:zip -- packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`

The script:

- updates `buildpack.json.files[]` hashes
- writes deterministic zip to `packages/rb-fpga-bridge/buildpacks/dist/<name>-<version>-<platformKey>.zip`
- prints zip SHA256
- prints `file://` install URL for Toolchain Setup.

### 2c) Release check (fail-fast)

Run:

- `node packages/rb-fpga-bridge/scripts/buildpack-release-check.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`
- `pnpm --filter @redbyte/fpga-bridge run buildpack:check -- packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev`

Optional dev-only skip for placeholder binaries:

- `node packages/rb-fpga-bridge/scripts/buildpack-release-check.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev --skip-tool-exec`

Release zip flow (enforces release-check first):

- `node packages/rb-fpga-bridge/scripts/buildpack-zip.js packages/rb-fpga-bridge/buildpacks/basys3-open-toolchain-0.1.0-dev --release`

### 3) Install from Toolchain Setup

In Toolchain Setup, use buildpack install with a local URL:

   - `file:///C:/path/to/basys3-open-toolchain-0.1.0-dev.zip`

### 4) Verify

Re-run Verify Setup and confirm:

- buildpack status is installed + verified
- implement plan resolves to `buildpack-open`
- selected buildpack version is shown in Setup/HDL plan summary.

## Golden Demo acceptance (manual)

1. Insert `Switches -> LEDs` example and Basys3 preset.
2. Plan Implementation selects `buildpack-open`.
3. Implement run completes and outputs manifest includes `bitstream`.
4. Program generated bitstream succeeds on Basys3.

## Golden Demo acceptance (scripted)

Run on a controlled machine with bridge running:

- `node packages/rb-fpga-bridge/scripts/golden-demo-acceptance.js --buildpackZip file:///C:/path/to/basys3-open-toolchain-0.1.0-dev-win32-x64.zip --board basys3 --mode buildpack-open --detect 1 --program 1`
- `pnpm --filter @redbyte/fpga-bridge run golden:accept -- --buildpackZip file:///C:/path/to/basys3-open-toolchain-0.1.0-dev-win32-x64.zip --board basys3 --mode buildpack-open --detect 1 --program 1`

What it validates:

- buildpack install + probe
- implement-plan backend resolves to `buildpack-open`
- implement run produces bitstream output endpoint
- program-bitstream run succeeds (when hardware connected)
- baseline evidence artifacts are written to `artifacts/golden-demo/<hash>/`
