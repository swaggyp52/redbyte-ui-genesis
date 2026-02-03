# RedByte Arduino Firmware

Default firmware for Arduino Uno integration with RedByte Platform.

## Protocol

The firmware implements a simple serial protocol at 115200 baud:

### Commands

- **PING** - Heartbeat check (responds with "PONG")
- **GET** - Request current pin states
- **SET <pin> <value>** - Set digital output (0=LOW, 1=HIGH)
- **PIN <pin> <mode>** - Configure pin mode (0=INPUT, 1=OUTPUT, 2=INPUT_PULLUP)

### Response Format

JSON state updates sent every 100ms or on change:

```json
{
  "D2": 0,
  "D3": 1,
  "D4": 0,
  ...
  "A0": 512,
  "A1": 768,
  ...
}
```

## Uploading

### Via Arduino IDE

1. Open `redbyte_io_protocol.ino` in Arduino IDE
2. Select **Tools → Board → Arduino Uno**
3. Select **Tools → Port → (your COM port)**
4. Click **Upload**

### Via arduino-cli

```bash
arduino-cli compile --fqbn arduino:avr:uno redbyte_io_protocol
arduino-cli upload -p COM3 --fqbn arduino:avr:uno redbyte_io_protocol
```

### Via RedByte Platform

Use the **Hardware Panel** → **Upload Firmware** button to flash this firmware automatically.

## Pin Mapping

- **Digital I/O**: D2-D13 (12 pins)
- **Analog Input**: A0-A5 (6 pins, 10-bit ADC)
- **Built-in LED**: D13

## Hardware Requirements

- Arduino Uno (ATmega328P)
- USB cable for serial communication
- Driver: CH340/CH341 or FTDI depending on board revision

## Troubleshooting

### No response from Arduino

1. Check COM port is correct
2. Verify baud rate is 115200
3. Press reset button on Arduino
4. Re-upload firmware

### Pin states not updating

1. Check pin mode is configured correctly
2. Verify external circuitry (pullup/pulldown resistors)
3. Use `GET` command to force state refresh

### Serial buffer overflow

- Commands must be terminated with `\n` or `\r`
- Maximum command length: 64 characters
- Send commands at < 10 Hz to avoid buffer overrun

## License

Copyright © 2026 Connor Angiel — RedByte OS Genesis
