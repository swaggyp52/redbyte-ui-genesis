# RedByte FPGA Bridge

Hardware-in-the-loop telemetry bridge for Digilent Basys 3 FPGA board.

## Features

- **Auto-detection**: Automatically finds Basys 3 via FTDI USB-UART
- **Mock mode**: Test without physical hardware
- **WebSocket streaming**: Real-time data to browser
- **HTTP API**: Port selection and status endpoints

## Quick Start

### Mock Mode (No Hardware)

```bash
# Terminal 1: Start bridge
pnpm --filter @redbyte/fpga-bridge dev:mock

# Terminal 2: Test HTTP API
curl http://localhost:4242/health
curl http://localhost:4242/ports
```

### Real Hardware

1. Plug in Basys 3 board
2. Start bridge:
```bash
pnpm --filter @redbyte/fpga-bridge dev
```

Bridge will auto-detect the board via FTDI VID/PID.

### Manual Port Selection

```bash
# Set environment variable
$env:REDBYTE_FPGA_PORT = "COM5"
pnpm --filter @redbyte/fpga-bridge dev
```

## API Endpoints

- `GET /health` - Bridge status
- `GET /ports` - List available serial ports with scores
- `POST /connect` - Connect to specific port
- `WS ws://localhost:4243` - WebSocket telemetry stream

## Telemetry Protocol

**Format:** `RB1 SW=<16bit> BTN=<5bit> LED=<16bit> TICK=<counter>`

**Example:**
```
RB1 SW=0000000010110011 BTN=00101 LED=0000000010110011 TICK=1234
```

**WebSocket Messages:**
```json
{
  "type": "uart",
  "raw": "RB1 SW=...",
  "SW": "0000000010110011",
  "BTN": "00101",
  "LED": "0000000010110011",
  "TICK": "1234",
  "ts": 1737000000000
}
```

## Board Configuration

See `boards/basys3.json` for hardware specifications:
- 16 slide switches (SW0-SW15)
- 5 push buttons (BTNC, BTNU, BTND, BTNL, BTNR)
- 16 LEDs (LD0-LD15)
- 4-digit 7-segment display
- 100MHz clock
- VGA, PMOD, USB-JTAG interfaces

## Environment Variables

- `RB_FPGA_MOCK=1` - Enable mock mode (simulates hardware)
- `RB_FPGA_HTTP_PORT=4242` - HTTP API port
- `RB_FPGA_WS_PORT=4243` - WebSocket port
- `RB_FPGA_BAUD=115200` - UART baud rate
- `REDBYTE_FPGA_PORT=COM5` - Force specific port

## Integration with RedByte UI

The web app connects to `ws://localhost:4243` for live hardware telemetry.

Example client (React):
```typescript
const ws = new WebSocket('ws://localhost:4243');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'uart') {
    // Update UI with msg.SW, msg.LED, msg.BTN
  }
};
```

## Development

```bash
# Install dependencies
pnpm install

# Run in mock mode
pnpm --filter @redbyte/fpga-bridge dev:mock

# Run with real hardware
pnpm --filter @redbyte/fpga-bridge dev
```

## Future Enhancements

- Logic analyzer capture mode (triggered waveform dumps)
- Probe negotiation (RedByte requests specific signals)
- Compressed waveform streaming
- Support for additional FPGA boards
