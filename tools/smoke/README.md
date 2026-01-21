# RedByte FPGA Bridge Smoke Test (Ticket 8)

This is the Week 1 board sanity check for Basys 3 and Spartan-3E.

It proves end-to-end:

1. `/devices` detects and merges UART+JTAG
2. `/program` programs the UART wrapper smoke fixture
3. `/devices` re-identifies (best effort) and pinmap gate is enforced by bridge
4. `/run mode=hardware` starts UART stream
5. `/stream` (SSE) yields real `sample` events
6. `/stop` shuts down cleanly
7. Script prints PASS/FAIL with actionable diagnostics and a link to `/log`

## Prereqs

- `rb-fpga-bridge` running locally (default: `http://127.0.0.1:4242`)
- A Digilent board connected (Basys 3 or Spartan-3E)
- Fixture bitstream built:
  - `tools/fixtures/basys3/rb_wrapper_smoke.bit`
  - `tools/fixtures/spartan3e/rb_wrapper_smoke.bit`

See fixture build notes:

- `tools/fixtures/basys3/README.md`
- `tools/fixtures/spartan3e/README.md`

## Run (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -Board basys3
powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -Board spartan3e
```

If multiple devices are present:

```powershell
powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -DeviceId board-2100001234 -Board basys3
```

Override bridge URL:

```powershell
powershell -ExecutionPolicy Bypass -File tools\smoke\smoke.ps1 -BridgeUrl http://127.0.0.1:4242 -Board basys3
```

## Debugging failures

- List recent program logs: `GET /logs`
- Fetch a log by id: `GET /log?id=program-...log`

Common failure modes:

- No device detected: check USB cable, drivers, and ensure JTAG + UART are present.
- /program fails: see `/log?id=...` for the exact djtgcfg command and output.
- running_no_data: wrapper not streaming or UART pin mapping/baud mismatch.

