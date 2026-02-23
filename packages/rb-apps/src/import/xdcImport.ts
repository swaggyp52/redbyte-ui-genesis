// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// XDC Pin Parser - deterministically extract PACKAGE_PIN assignments from Vivado XDC.
//
// Scope (v1): parse get_ports + PACKAGE_PIN assignments.
// Ignored with warnings: IOSTANDARD, PULLUP, DRIVE, SLEW, clocks, etc.
// Unsupported pins: warn but do not crash.

import { BASYS3_ALLOWED_PACKAGE_PINS, normalizeBasys3PinAlias } from '../fpga/boards/basys3/basys3Pins';

export type XdcPinMap = Record<string, string>; // portName -> PACKAGE_PIN

export type PinConfidence = 'strong' | 'weak';
// strong = parsed pin is in BASYS3_ALLOWED_PACKAGE_PINS
// weak   = parsed pin is recognized syntax but NOT in BASYS3_ALLOWED_PACKAGE_PINS

export interface XdcPinEntry {
  packagePin: string;
  confidence: PinConfidence;
  line?: number; // 1-based line number of the set_property statement in the original XDC source
}

export interface XdcParseResult {
  pinMap: XdcPinMap;
  pinEntries: Record<string, XdcPinEntry>;   // portName -> { packagePin, confidence }
  warnings: string[];
}

function normalizePortToken(token: string): string {
  return token.replace(/[{}]/g, '').trim();
}

function maybePushUnsupportedPinWarning(warnings: string[], pin: string): void {
  if (BASYS3_ALLOWED_PACKAGE_PINS.has(pin)) return;
  warnings.push(`Unsupported pin '${pin}'`);
}

/**
 * Pre-scans the raw XDC source line-by-line and returns a map of
 * portName → 1-based line number for each set_property PACKAGE_PIN statement.
 * This runs on the original text (before normalization) so line offsets are preserved.
 */
function scanXdcLineNumbers(xdcText: string): Record<string, number> {
  const lineByPort: Record<string, number> = {};
  const lines = xdcText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    // Pattern 1: set_property PACKAGE_PIN V17 [get_ports {portName}]
    const direct = /set_property\s+PACKAGE_PIN\s+\S+\s+\[get_ports\s*(\{[^}]*\}|\S+)\s*\]/i.exec(line);
    if (direct) {
      const portName = direct[1].replace(/[{}\s]/g, '');
      if (portName) lineByPort[portName] = i + 1;
    }
    // Pattern 2: set_property -dict { PACKAGE_PIN ... } [get_ports {portName}]
    const dictMatch = /set_property\s+-dict\s+\{[^}]*\}\s+\[get_ports\s*(\{[^}]*\}|\S+)\s*\]/i.exec(line);
    if (dictMatch) {
      const portName = dictMatch[1].replace(/[{}\s]/g, '');
      if (portName) lineByPort[portName] = i + 1;
    }
  }
  return lineByPort;
}

export function parseXdcPins(xdcText: string): XdcParseResult {
  const pinMap: XdcPinMap = {};
  const pinEntries: Record<string, XdcPinEntry> = {};
  const warnings: string[] = [];

  const lineByPort = scanXdcLineNumbers(xdcText);

  const normalized = xdcText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .join(' ');

  const upsertPin = (rawPin: string, rawPortToken: string) => {
    const pin = normalizeBasys3PinAlias(rawPin);
    const portName = normalizePortToken(rawPortToken);
    if (portName.length === 0 || pin.length === 0) return;

    maybePushUnsupportedPinWarning(warnings, pin);
    pinMap[portName] = pin;
    const confidence: PinConfidence = BASYS3_ALLOWED_PACKAGE_PINS.has(pin) ? 'strong' : 'weak';
    pinEntries[portName] = { packagePin: pin, confidence, line: lineByPort[portName] };
  };

  // Pattern: set_property PACKAGE_PIN V17 [get_ports {SW0}]
  const directRegex =
    /set_property\s+PACKAGE_PIN\s+([A-Za-z0-9_]+)\s+\[get_ports\s*(\{[^}]*\}|[^\]]+)\s*\]/gi;
  let match: RegExpExecArray | null;
  while ((match = directRegex.exec(normalized)) !== null) {
    upsertPin(match[1], match[2]);
  }

  // Pattern: set_property -dict { PACKAGE_PIN V17 IOSTANDARD LVCMOS33 } [get_ports {sw[0]}]
  const dictRegex =
    /set_property\s+-dict\s+\{([^}]*)\}\s+\[get_ports\s*(\{[^}]*\}|[^\]]+)\s*\]/gi;
  while ((match = dictRegex.exec(normalized)) !== null) {
    const dictBody = match[1];
    const portToken = match[2];
    const pinMatch = dictBody.match(/\bPACKAGE_PIN\s+([A-Za-z0-9_]+)\b/i);
    if (!pinMatch) continue;
    upsertPin(pinMatch[1], portToken);
  }

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

  return { pinMap, pinEntries, warnings };
}
