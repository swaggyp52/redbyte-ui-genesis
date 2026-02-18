// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// XDC Pin Parser — deterministically extract PACKAGE_PIN assignments from Vivado XDC.
//
// Scope (v1): parse get_ports + PACKAGE_PIN only.
// Ignored with warnings: IOSTANDARD, PULLUP, DRIVE, SLEW, clocks, etc.
// Unsupported pins: warn but don't crash.

// ─── Types ────────────────────────────────────────────────────────────────────

export type XdcPinMap = Record<string, string>; // portName -> PACKAGE_PIN

export interface XdcParseResult {
  pinMap: XdcPinMap;
  warnings: string[];
}

// ─── Basys3 Pin Reference ─────────────────────────────────────────────────────

/**
 * Basys3 allowed pins (subset for v1).
 * Maps common names to actual PACKAGE_PIN values.
 */
const BASYS3_ALLOWED_PINS = new Set([
  // Switches
  'V17', 'V16', 'W16', 'W17', 'W15', 'V15', 'W14', 'W13',
  // LEDs
  'U16', 'E19', 'U19', 'V19', 'W18', 'U18', 'U17', 'U14',
  // Buttons
  'D19', 'D20', 'L20', 'L19',
  // Clock
  'W5',
  // UART
  'D10', 'A9',
  // Pmod
  'C17', 'D18', 'E18', 'G17', 'D17', 'E17', 'F18', 'G18',
  'D14', 'F16', 'G16', 'H14', 'E16', 'F13', 'G13', 'H16',
  // Add more as needed
]);

// ─── Parser ────────────────────────────────────────────────────────────────────

/**
 * Deterministically parse Vivado XDC for pin assignments.
 * Returns: { portName -> PACKAGE_PIN } mapping + warnings.
 *
 * Handles:
 *   set_property PACKAGE_PIN V17 [get_ports {SW0}]
 *   set_property PACKAGE_PIN V17 [get_ports SW0]
 *   set_property PACKAGE_PIN V17 [get_ports { sw[0] }]
 *   ... with spacing / tab / line continuation variants
 */
export function parseXdcPins(xdcText: string): XdcParseResult {
  const pinMap: XdcPinMap = {};
  const warnings: string[] = [];

  // Normalize: remove extra whitespace, handle line continuations
  let normalized = xdcText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#')) // Skip comments and empty
    .join(' ');

  // Match: set_property PACKAGE_PIN <pin> [get_ports { <name> }]
  // Handles: {SW0}, { sw[0] }, SW0, etc.
  const regex =
    /set_property\s+PACKAGE_PIN\s+(\w+)\s+\[get_ports\s*(\{[^\}]*\}|[^\]]+)\s*\]/gi;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const pin = match[1].trim();
    let portName = match[2].trim();

    // Normalize port name: strip braces and extra whitespace
    portName = portName.replace(/[\{\}]/g, '').trim();

    // Warn if pin not in Basys3 set
    if (!BASYS3_ALLOWED_PINS.has(pin)) {
      warnings.push(`Unsupported pin '${pin}'`);
    }

    // Store mapping (last one wins if duplicates)
    pinMap[portName] = pin;
  }

  // Warn for unsupported directives (simple heuristic)
  const unsupportedPatterns = [
    { pattern: /IOSTANDARD/i, msg: 'IOSTANDARD ignored (v1 does not configure voltage standards)' },
    { pattern: /PULLUP|PULLDOWN/i, msg: 'Pull-ups/downs ignored (v1 does not configure pulls)' },
    { pattern: /DRIVE|SLEW/i, msg: 'Drive strength / slew ignored (v1 does not configure output strength)' },
    { pattern: /create_clock|set_clock/i, msg: 'Clock constraints ignored (v1 does not configure clocks)' },
  ];

  for (const { pattern, msg } of unsupportedPatterns) {
    if (pattern.test(xdcText)) {
      warnings.push(msg);
    }
  }

  return { pinMap, warnings };
}
