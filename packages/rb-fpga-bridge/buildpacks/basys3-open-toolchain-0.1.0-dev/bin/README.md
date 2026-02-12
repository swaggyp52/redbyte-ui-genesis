# Bin Layout

Place platform-specific tool executables under:

- `bin/win32-x64/`
- `bin/linux-x64/`
- `bin/darwin-arm64/`
- `bin/darwin-x64/`

Current manifest (`buildpack.json`) targets `win32-x64` and expects:

- `bin/win32-x64/f4pga.exe`
