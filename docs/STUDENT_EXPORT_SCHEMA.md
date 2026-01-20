# RedByte Student Export Schema (RB Zip v2)

This document defines the v2 `.rb-lab.zip` structure used by the FPGA bridge MVP.

## File Structure

```
<lab>.rb-lab.zip
├── manifest.json
├── trace/
│   └── hw_trace.ndjson
├── bitstream/
│   └── design.bit
├── meta/
│   └── board_profile.json
└── integrity/
    ├── capsule.json
    └── signature.sig
```

Notes:
- `bitstream/design.bit` is optional. If omitted, `manifest.json` must indicate `bitstream_present: false`.
- `integrity/signature.sig` is optional for student exports (unsigned by default).

## manifest.json (v2)

Required fields:

```
{
  "schema_version": "v2",
  "redbyte_version": "...",
  "lab_id": "...",
  "lab_version": "...",
  "scaffold_hash": "...",
  "board": "basys3",
  "bin_size_ms": 20,
  "trace_summary": {
    "events": 0,
    "crc_failures": 0
  },
  "bitstream_present": false
}
```

## trace/hw_trace.ndjson

NDJSON with one event per line:

```
{"hw_tick":0,"mono_seq":1,"digital":123,"analog":[...],"ts_wall":1705600000000}
```

## meta/board_profile.json

Defines signal names and UART settings:

```
{
  "board": "basys3",
  "uart_baud": 115200,
  "digital_signals": {
    "0": "SW0",
    "1": "SW1",
    "2": "BTN0"
  },
  "analog_signals": {
    "0": "ComparatorOut",
    "1": "LDR_Level"
  }
}
```

## integrity/capsule.json

Canonical hash capsule used for signatures:

```
{
  "algo": "sha256",
  "files": [
    { "path": "manifest.json", "hash": "..." }
  ]
}
```

Capsule rules:
- Paths must use forward slashes.
- Entries are sorted lexicographically by `path`.
- Capsule JSON is serialized with no extra whitespace.

## integrity/signature.sig

Ed25519 signature over the exact UTF-8 bytes of `integrity/capsule.json`.

Signature status meanings:
- `Unsigned`: signature file missing.
- `Valid`: signature matches a trusted public key and capsule hashes match.
- `Invalid`: signature missing or does not validate against trusted keys.
