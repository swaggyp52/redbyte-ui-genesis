# Spartan-3E smoke fixture

This fixture bitstream emits RedByte SAMPLE frames over UART after a STREAM_START frame.
It validates the bridge pipeline without student HDL.

## UART mapping

- UART RX: `rs232_dce_rxd` (R7)
- UART TX: `rs232_dce_txd` (M14)
- Baud: 115200 8N1

## Build (ISE)

Create a new ISE project with these settings:

- Top module: `rb_wrapper_smoke_spartan3e`
- Source file: `rb_wrapper_smoke.v`
- Constraints: `packages/board-models/spartan3e-starter/pinmap.ise.ucf`
- Device: use your kit part (XC3S500E or XC3S1200E)

Generate the programming file and save the `.bit` as:

```
tools/fixtures/spartan3e/rb_wrapper_smoke.bit
```

## Notes

- SAMPLE payload is constant JSON with `led=1`.
- LED0 lights when STREAM_START is received.
