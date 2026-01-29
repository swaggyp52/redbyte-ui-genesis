import type { LabTemplate } from '@redbyte/rb-logic-3d';

export const VIRTUAL_LAB_TEMPLATES: LabTemplate[] = [
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab2_adder',
    lab_version: '1.0.0',
    name: 'Lab 2: 4-Bit Ripple Carry Adder',
    summary: 'Design a 4-bit adder and verify on Basys3.',
    hardware_target: 'basys3',
    required_parts: [
      { type: 'fpga-basys3', min: 1, max: 1 }
    ],
    required_nets: [],
    behavior_checks: [],
    guide: [
      {
        id: 'step1_objective',
        title: 'Objective',
        markdown: 'Build a **4-Bit Ripple Carry Adder** using standard logic gates.\n\n- **Input A**: Switches 0-3\n- **Input B**: Switches 4-7\n- **Output Sum**: LEDs 0-3\n- **Output Carry**: LED 4'
      },
      {
        id: 'step2_lsb',
        title: 'Step 1: The LSB (Bit 0)',
        markdown: 'Create the first Full Adder.\n1. Connect **SW0** and **SW4** to the inputs.\n2. Connect **Cin** (Ground) to the Carry In.\n3. Connect Sum to **LED0**.\n4. Route **Cout** to the next stage.'
      },
      {
        id: 'step3_chain',
        title: 'Step 2: The Carry Chain',
        markdown: 'Replicate the Full Adder for Bits 1, 2, and 3.\n- Chain the **Cout** of Bit N to **Cin** of Bit N+1.\n- Connect **SW1/SW5** -> Bit 1\n- Connect **SW2/SW6** -> Bit 2\n- Connect **SW3/SW7** -> Bit 3'
      },
      {
        id: 'step4_verify',
        title: 'Verification',
        markdown: 'Test your design:\n- Set **SW0=1** (A=1) + **SW4=1** (B=1). **LED1** should light (Sum=2).\n- Test overflow: 15 + 1 = 16 (LED4 should light).'
      }
    ]
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab3_7seg',
    lab_version: '1.0.0',
    name: 'Lab 3: Seven-Segment Driver',
    summary: 'BCD to 7-Segment Decoder with Time Multiplexing.',
    hardware_target: 'basys3',
    required_parts: [{ type: 'fpga-basys3', min: 1, max: 1 }],
    required_nets: [],
    behavior_checks: []
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab4_alu',
    lab_version: '1.0.0',
    name: 'Lab 4: Simplified ALU',
    summary: '1-bit ALU with MUX and Decoder implementations.',
    hardware_target: 'basys3',
    required_parts: [{ type: 'fpga-basys3', min: 1, max: 1 }],
    required_nets: [],
    behavior_checks: []
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab5_adder_signed',
    lab_version: '1.0.0',
    name: 'Lab 5: Signed Adder/Subtractor',
    summary: '2’s Complement Arithmetic with Overflow detection.',
    hardware_target: 'basys3',
    required_parts: [{ type: 'fpga-basys3', min: 1, max: 1 }],
    required_nets: [],
    behavior_checks: []
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab6_ff',
    lab_version: '1.0.0',
    name: 'Lab 6: Latches and Flip-Flops',
    summary: 'Sequential logic, metastability, and debounce.',
    hardware_target: 'basys3',
    required_parts: [{ type: 'fpga-basys3', min: 1, max: 1 }],
    required_nets: [],
    behavior_checks: []
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'lab7_counters',
    lab_version: '1.0.0',
    name: 'Lab 7: Synchronous Counters',
    summary: 'Binary and BCD counters with control inputs.',
    hardware_target: 'basys3',
    required_parts: [{ type: 'fpga-basys3', min: 1, max: 1 }],
    required_nets: [],
    behavior_checks: []
  },
  // Legacy / Utility Labs
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'virtual_lab_blink',
    lab_version: '1.0.0',
    name: 'Utility: Blink LED (Nano)',
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
    name: 'Utility: Button Toggle',
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
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'hardware_lab_blink',
    lab_version: '1.0.0',
    name: 'Hardware Blink (UNO)',
    summary: 'Flash and monitor a real Arduino UNO blink cycle.',
    hardware_target: 'arduino-uno',
    firmware_path: './labs/arduino/blink.ino',
    required_parts: [
      { type: 'arduino-uno', min: 1, max: 1 }
    ],
    required_nets: [],
    behavior_checks: [
      {
        id: 'blink_d13',
        type: 'blink',
        pin: { part: 'arduino-uno', pins: ['D13'] },
        period_ticks: 40,
        tolerance_ticks: 6,
        min_cycles: 3,
        hint: 'Flash blink.ino using the terminal.'
      }
    ]
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'hardware_lab_bridge',
    lab_version: '1.0.0',
    name: 'Hardware Bridge (Button-LED)',
    summary: 'Use a physical button on D2 to drive an external LED on D12.',
    hardware_target: 'arduino-uno',
    firmware_path: './labs/arduino/interactive_bridge.ino',
    required_parts: [
      { type: 'arduino-uno', min: 1, max: 1 },
      { type: 'button-momentary', min: 1, max: 1 },
      { type: 'led-5mm', min: 1, max: 1 }
    ],
    required_nets: [
      {
        id: 'btn_input',
        label: 'Button to D2',
        pins: [{ part: 'arduino-uno', pins: ['D2'] }, { part: 'button-momentary', pins: ['p1'] }]
      },
      {
        id: 'led_output',
        label: 'LED via Resistor to D12',
        pins: [{ part: 'arduino-uno', pins: ['D12'] }, { part: 'led-5mm', pins: ['anode'] }]
      }
    ],
    behavior_checks: [
      {
        id: 'btn_interaction',
        type: 'digital_level',
        pin: { part: 'arduino-uno', pins: ['D2'] },
        value: 0,
        hint: 'Press the physical button.'
      }
    ]
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'hardware_lab_analog',
    lab_version: '1.0.0',
    name: 'Hardware Analog Monitor',
    summary: 'Monitor and graph A0 analog input from real hardware.',
    hardware_target: 'arduino-uno',
    firmware_path: './labs/arduino/analog_monitor.ino',
    required_parts: [
      { type: 'arduino-uno', min: 1, max: 1 }
    ],
    required_nets: [],
    behavior_checks: []
  },
  {
    template_version: 'virtual-lab.v1',
    lab_id: 'hardware_lab_xor_hil',
    lab_version: '1.0.0',
    name: 'XOR Logic Bridge (HIL)',
    summary: 'Implement XOR logic in hardware and drive inputs from RedByte.',
    hardware_target: 'arduino-uno',
    firmware_path: './labs/arduino/xor_logic.ino',
    required_parts: [
      { type: 'arduino-uno', min: 1, max: 1 }
    ],
    required_nets: [],
    behavior_checks: [
      {
        id: 'xor_verification',
        type: 'digital_level',
        pin: { part: 'arduino-uno', pins: ['D10'] },
        value: 1,
        hint: 'The Arduino XORs D8 and D9. Set D8=1, D9=0 to verify.'
      }
    ]
  }
];
