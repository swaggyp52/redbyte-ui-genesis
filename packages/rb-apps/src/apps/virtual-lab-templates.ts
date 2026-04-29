import basys3MvpLab from '../../../../labs/basys3_mvp_lab/lab.json';
import virtualLabBlink from '../../../../labs/virtual_lab_blink/lab.json';
import virtualLabButtonToggle from '../../../../labs/virtual_lab_button_toggle/lab.json';
import virtualLabSerialStatus from '../../../../labs/virtual_lab_serial_status/lab.json';

export interface VirtualLabTemplate {
  lab_id: string;
  name: string;
  hardware_target: 'basys3' | 'arduino-uno';
  firmware_path?: string;
  [key: string]: unknown;
}

const ARDUINO_UNO_FIRMWARE_PATH = 'packages/rb-bridge-agent/firmware/redbyte-uno.ino';

export const VIRTUAL_LAB_TEMPLATES: VirtualLabTemplate[] = [
  {
    ...virtualLabBlink,
    hardware_target: 'arduino-uno',
    firmware_path: ARDUINO_UNO_FIRMWARE_PATH,
  },
  {
    ...virtualLabButtonToggle,
    hardware_target: 'arduino-uno',
    firmware_path: ARDUINO_UNO_FIRMWARE_PATH,
  },
  {
    ...virtualLabSerialStatus,
    hardware_target: 'arduino-uno',
    firmware_path: ARDUINO_UNO_FIRMWARE_PATH,
  },
  {
    ...basys3MvpLab,
    hardware_target: 'basys3',
  },
];
