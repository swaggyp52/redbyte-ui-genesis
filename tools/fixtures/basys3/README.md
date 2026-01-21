# Basys 3 smoke fixture

This fixture bitstream emits RedByte SAMPLE frames over UART after a STREAM_START frame.
It does not include student logic; it exists to validate the bridge pipeline:
`/devices -> /program -> /run -> /stream -> /stop`.

## UART mapping

- UART RX: `RsRx` (B18)
- UART TX: `RsTx` (A18)
- Baud: 115200 8N1

## Build (Vivado)

From this directory:

```
vivado -mode batch -source build_vivado.tcl
```

Output:

```
tools/fixtures/basys3/rb_wrapper_smoke.bit
```

## Notes

- SAMPLE payload is constant JSON with `led=1`.
- LED0 lights when STREAM_START is received.
- Use the RedByte `/run` endpoint in `mode: "hardware"` to begin streaming.
