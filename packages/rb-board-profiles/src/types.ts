// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Board Profile Types
 */

export interface BoardProfile {
  schemaVersion: string;
  id: string;
  name: string;
  vendor: string;
  fpga: string;
  components: {
    leds: BoardComponent[];
    switches: BoardComponent[];
    buttons: BoardComponent[];
  };
}

export interface BoardComponent {
  id: string;
  pin: string;
  type: 'input' | 'output';
  label?: string;
}
