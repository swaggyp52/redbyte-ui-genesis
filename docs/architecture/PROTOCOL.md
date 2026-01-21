# RedByte Hardware Bridge Protocol (RBHB) v1

**Status**: DRAFT
**Version**: 1.0.0

This document defines the contract between the FPGA implementation (Wrapper) and the Host Runtime (Bridge).

## 1. Physical Layer (UART)

*   **Baud Rate**: 115200 (default), 921600 (high-speed).
*   **Format**: 8N1 (8 data bits, No parity, 1 stop bit).
*   **Flow Control**: None (Application-level framing).

## 2. Framing (RBHB)

All packets sent from FPGA to Host must use the RBHB framing.

```
[MAGIC: 4 bytes] [VER: 1 byte] [TYPE: 1 byte] [LEN: 2 bytes] [PAYLOAD: N bytes] [CRC: 4 bytes]
```

*   **MAGIC**: `0x52 0x42 0x48 0x42` ("RBHB" in ASCII).
*   **VER**: `0x01` (Protocol Version 1).
*   **TYPE**:
    *   `0x10` (STREAM_START)
    *   `0x11` (STREAM_STOP) - *Note: Stop frame payload is optional/empty.*
    *   `0x12` (SAMPLE)
    *   `0x02` (IDENTIFY)
*   **LEN**: 16-bit Little Endian unsigned integer (Payload length in bytes).
*   **PAYLOAD**: `LEN` bytes of data.
*   **CRC**: 32-bit CRC (currently ignored by bridge but reserved for integrity).

## 3. Payloads

All payloads are **JSON Strings**.

### 3.1. IDENTIFY (Type 0x02)

Sent by the FPGA upon reset or request.

```json
{
  "kind": "identify",
  "board_model_id": "basys3",
  "bridge_proto": 1,
  "wrapper_version": "0.1.0",
  "pinmap_hash": "hex_string",
  "features": ["io_stream_v1"],
  "design": {
    "design_hash": "hex_string",
    "build_id": "string"
  }
}
```

*   **Required Fields**: `kind`, `board_model_id`, `wrapper_version`.

### 3.2. SAMPLE (Type 0x12)

Sent periodically during streaming.

```json
{
  "t_ms": "0x00000064",
  "io": {
    "sw": "0x000F",
    "btn": "0x01",
    "led": "0x000F",
    "seg": null,
    "an": null
  }
}
```

*   **t_ms**:
    *   **MUST** be present.
    *   **Format**: Hex string (`"0x..."`), Decimal string (`"100"`), or Number (`100`).
    *   **Semantics**: Millisoconds since boot/reset, derived from board clock.
*   **io**:
    *   **sw**: 16-bit hex string.
    *   **btn**: 5-bit or 8-bit hex string.
    *   **led**: 16-bit hex string.

## 4. Host (Bridge) Behavior

### 4.1. Timestamp Normalization
The bridge `sample` event (SSE) **must** normalize `t_ms` to a Number.
If `t_ms` is missing or unparseable, field is `null`.

### 4.2. "No Data" Policy
If the bridge is in `running` state but receives no valid RBHB frames for >500ms, it must emit status `running_no_data`.

## 5. Wrapper Responsibilities

1.  **Clock Derivation**: Wrapper must derive `t_ms` from the board's native clock (e.g. 100MHz for Basys3 = 100,000 cycles/ms).
2.  **Atomicity**: Sample framing must be atomic; no interleaved bytes.
3.  **Determinism**: JSON payloads must be fixed-width/stable for a given build configuration.
