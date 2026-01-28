import type { LabTemplate } from '@redbyte/rb-logic-3d';

export const VIRTUAL_LAB_TEMPLATES: LabTemplate[] = [
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'virtual_lab_blink',
    lab_version: '1.0.0',
    name: 'Blink LED',
    summary: 'Blink D13 LED at a 2-second period.',
    required_parts: [
      { type: 'arduino-nano', min: 1, max: 1 },
      { type: 'led-5mm', min: 1, max: 1 },
      { type: 'resistor-dip', min: 1, max: 1 }
    ],
    required_nets: [
      {
        id: 'led_signal',
        label: 'LED anode to D13',
        pins: [
          { part: 'arduino-nano', pins: ['D13'] },
          { part: 'led-5mm', pins: ['anode'] }
        ]
      },
      {
        id: 'led_ground',
        label: 'LED cathode to GND',
        pins: [
          { part: 'arduino-nano', pins: ['GND'] },
          { part: 'led-5mm', pins: ['cathode'] }
        ]
      }
    ],
    behavior_checks: [
      {
        id: 'blink_d13',
        type: 'blink',
        pin: { part: 'arduino-nano', pins: ['D13'] },
        period_ticks: 40,
        tolerance_ticks: 6,
        min_cycles: 3,
        hint: 'Use delay(1000) between HIGH/LOW writes.'
      }
    ]
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'virtual_lab_button_toggle',
    lab_version: '1.0.0',
    name: 'Button Toggles LED',
    summary: 'Press the button to toggle the LED on D13.',
    required_parts: [
      { type: 'arduino-nano', min: 1, max: 1 },
      { type: 'button-momentary', min: 1, max: 1 },
      { type: 'led-5mm', min: 1, max: 1 },
      { type: 'resistor-dip', min: 1, max: 1 }
    ],
    required_nets: [
      {
        id: 'button_signal',
        label: 'Button to D2',
        pins: [
          { part: 'arduino-nano', pins: ['D2'] },
          { part: 'button-momentary', pins: ['p1'] }
        ],
        hint: 'Use INPUT_PULLUP and wire the other side to GND.'
      },
      {
        id: 'button_ground',
        label: 'Button to GND',
        pins: [
          { part: 'arduino-nano', pins: ['GND'] },
          { part: 'button-momentary', pins: ['p2'] }
        ]
      },
      {
        id: 'led_signal',
        label: 'LED anode to D13',
        pins: [
          { part: 'arduino-nano', pins: ['D13'] },
          { part: 'led-5mm', pins: ['anode'] }
        ]
      },
      {
        id: 'led_ground',
        label: 'LED cathode to GND',
        pins: [
          { part: 'arduino-nano', pins: ['GND'] },
          { part: 'led-5mm', pins: ['cathode'] }
        ]
      }
    ],
    behavior_checks: [
      {
        id: 'led_on_present',
        type: 'digital_level',
        pin: { part: 'arduino-nano', pins: ['D13'] },
        value: 1,
        min_ticks: 5
      },
      {
        id: 'led_off_present',
        type: 'digital_level',
        pin: { part: 'arduino-nano', pins: ['D13'] },
        value: 0,
        min_ticks: 5
      }
    ]
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'virtual_lab_serial_status',
    lab_version: '1.0.0',
    name: 'Serial LED Status',
    summary: 'Print ON/OFF over Serial in sync with the LED on D13.',
    required_parts: [
      { type: 'arduino-nano', min: 1, max: 1 },
      { type: 'led-5mm', min: 1, max: 1 },
      { type: 'resistor-dip', min: 1, max: 1 }
    ],
    required_nets: [
      {
        id: 'led_signal',
        label: 'LED anode to D13',
        pins: [
          { part: 'arduino-nano', pins: ['D13'] },
          { part: 'led-5mm', pins: ['anode'] }
        ]
      },
      {
        id: 'led_ground',
        label: 'LED cathode to GND',
        pins: [
          { part: 'arduino-nano', pins: ['GND'] },
          { part: 'led-5mm', pins: ['cathode'] }
        ]
      }
    ],
    behavior_checks: [
      {
        id: 'serial_matches_led',
        type: 'serial_matches_pin',
        pin: { part: 'arduino-nano', pins: ['D13'] },
        on_text: 'ON',
        off_text: 'OFF',
        hint: 'Use Serial.println(\"ON\") and Serial.println(\"OFF\").'
      }
    ]
  }
];
