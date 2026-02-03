/**
 * Arduino Device Detection Utility
 * 
 * PHASE 1 Task 1.5: Arduino Integration
 * 
 * Implements VID/PID-based detection for Arduino boards.
 * Maps USB Vendor/Product IDs to specific Arduino models.
 * 
 * Reference: https://github.com/arduino/Arduino/wiki/Arduino-Hardware
 */

import type { BridgeDevice } from '@redbyte/rb-protocol';

/**
 * Known Arduino USB VID/PID combinations
 * 
 * Sources:
 * - Arduino.cc official boards use VID 0x2341
 * - Clone boards often use CH340 (0x1a86) or FTDI (0x0403)
 */
export interface ArduinoIdentifier {
  vid: string;       // Vendor ID (hex string)
  pid: string;       // Product ID (hex string)
  model: string;     // Arduino model name
  chipset: string;   // USB-to-serial chipset
}

export const KNOWN_ARDUINO_BOARDS: ArduinoIdentifier[] = [
  // Arduino Uno (Official)
  { vid: '2341', pid: '0043', model: 'Arduino Uno', chipset: 'ATmega16U2' },
  { vid: '2341', pid: '0001', model: 'Arduino Uno', chipset: 'ATmega16U2' },
  { vid: '2A03', pid: '0043', model: 'Arduino Uno', chipset: 'ATmega16U2' },
  
  // Arduino Uno (CH340 Clone)
  { vid: '1a86', pid: '7523', model: 'Arduino Uno (CH340)', chipset: 'CH340' },
  
  // Arduino Nano (Official)
  { vid: '2341', pid: '0043', model: 'Arduino Nano', chipset: 'FTDI' },
  { vid: '0403', pid: '6001', model: 'Arduino Nano (FTDI)', chipset: 'FTDI FT232' },
  
  // Arduino Nano (CH340 Clone)
  { vid: '1a86', pid: '7523', model: 'Arduino Nano (CH340)', chipset: 'CH340' },
  
  // Arduino Mega 2560
  { vid: '2341', pid: '0042', model: 'Arduino Mega 2560', chipset: 'ATmega16U2' },
  { vid: '2A03', pid: '0042', model: 'Arduino Mega 2560', chipset: 'ATmega16U2' },
  
  // Arduino Leonardo
  { vid: '2341', pid: '8036', model: 'Arduino Leonardo', chipset: 'ATmega32U4' },
  { vid: '2341', pid: '0036', model: 'Arduino Leonardo', chipset: 'ATmega32U4' },
];

/**
 * Detect Arduino board model from USB VID/PID
 * 
 * @param vid - Vendor ID (hex string, e.g., "2341" or "0x2341")
 * @param pid - Product ID (hex string)
 * @returns Arduino identifier or null if not recognized
 */
export function detectArduinoModel(vid: string, pid: string): ArduinoIdentifier | null {
  // Normalize VID/PID (remove 0x prefix if present, convert to lowercase)
  const normalizedVid = vid.replace(/^0x/i, '').toLowerCase();
  const normalizedPid = pid.replace(/^0x/i, '').toLowerCase();
  
  return KNOWN_ARDUINO_BOARDS.find(
    board => board.vid.toLowerCase() === normalizedVid && board.pid.toLowerCase() === normalizedPid
  ) || null;
}

/**
 * Check if a device is an Arduino based on VID/PID
 * 
 * @param vid - Vendor ID
 * @param pid - Product ID
 * @returns true if device matches known Arduino VID/PID
 */
export function isArduinoDevice(vid: string, pid: string): boolean {
  return detectArduinoModel(vid, pid) !== null;
}

/**
 * Enhanced device detection with manufacturer string fallback
 * 
 * If VID/PID detection fails, attempts to identify Arduino by
 * manufacturer string (e.g., "Arduino LLC", "Arduino Srl").
 * 
 * @param device - Bridge device object
 * @returns Detected model or null
 */
export function identifyArduino(device: BridgeDevice): ArduinoIdentifier | null {
  // Try VID/PID detection first (most reliable)
  if (device.manufacturer) {
    // Extract VID/PID from manufacturer string if embedded
    // Example: "Arduino LLC (www.arduino.cc) [2341:0043]"
    const vidPidMatch = device.manufacturer.match(/\[([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\]/);
    if (vidPidMatch) {
      const detected = detectArduinoModel(vidPidMatch[1], vidPidMatch[2]);
      if (detected) return detected;
    }
  }
  
  // Fallback: Manufacturer string heuristics
  const mfg = device.manufacturer?.toLowerCase() || '';
  if (mfg.includes('arduino')) {
    // Generic Arduino detection
    if (mfg.includes('uno')) {
      return { vid: 'unknown', pid: 'unknown', model: 'Arduino Uno', chipset: 'Unknown' };
    } else if (mfg.includes('nano')) {
      return { vid: 'unknown', pid: 'unknown', model: 'Arduino Nano', chipset: 'Unknown' };
    } else if (mfg.includes('mega')) {
      return { vid: 'unknown', pid: 'unknown', model: 'Arduino Mega 2560', chipset: 'Unknown' };
    } else {
      return { vid: 'unknown', pid: 'unknown', model: 'Arduino (Generic)', chipset: 'Unknown' };
    }
  }
  
  // CH340 chipset (common in Arduino clones)
  if (mfg.includes('ch340') || mfg.includes('qinheng')) {
    return { vid: '1a86', pid: '7523', model: 'Arduino Uno (CH340)', chipset: 'CH340' };
  }
  
  return null;
}

/**
 * Get friendly display name for Arduino device
 * 
 * @param device - Bridge device
 * @returns User-friendly name (e.g., "Arduino Uno on COM3")
 */
export function getArduinoDisplayName(device: BridgeDevice): string {
  const identified = identifyArduino(device);
  if (identified) {
    return `${identified.model} on ${device.port}`;
  }
  return `Arduino on ${device.port}`;
}

/**
 * Get FQBN (Fully Qualified Board Name) for arduino-cli uploads
 * 
 * @param model - Arduino model name
 * @returns FQBN string for arduino-cli
 */
export function getArduinoFQBN(model: string): string {
  if (model.includes('Uno')) {
    return 'arduino:avr:uno';
  } else if (model.includes('Nano')) {
    return 'arduino:avr:nano';
  } else if (model.includes('Mega')) {
    return 'arduino:avr:mega';
  } else if (model.includes('Leonardo')) {
    return 'arduino:avr:leonardo';
  }
  // Default to Uno if unknown
  return 'arduino:avr:uno';
}
