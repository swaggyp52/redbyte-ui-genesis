# Terminal Contract

The RedByte Terminal is a controlled command runner, not a shell. It exposes a
fixed allowlist of synchronous commands and cannot execute arbitrary programs.

## Command model
- Commands are synchronous and deterministic.
- Commands operate on explicit targets (apps, files, settings).
- No implicit working directory or ambient shell state.

## Command log
- Every command is logged with sequence + timestamp.
- Storage keys:
  - `rb:terminal:log:v1`
  - `rb:terminal:log:seq:v1`
- Log entry shape:
  - `seq` (monotonic number)
  - `ts_wall` (ISO-8601 string)
  - `command` (string)
- Retention: last 200 entries.

## Allowed commands (v1)
- help
- clear
- about
- status
- apps list
- theme list|current|set <variant>
- wallpaper set <id>
- files list|open|delete <fileId>
- examples list|load <exampleId>
- ticks set <number>
- log [count]
- audit export
- restart
