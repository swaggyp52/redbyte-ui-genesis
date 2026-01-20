export type BoardIoGroup = {
  count: number;
  labels: string[];
  port: string;
  pins: string[];
  active_low?: boolean;
};

export type BoardModel = {
  id: string;
  name: string;
  manufacturer: string;
  fpga: {
    family: string;
    part: string;
  };
  toolchain: 'vivado' | 'ise';
  clock: {
    name: string;
    frequency_hz: number;
    port: string;
    pin: string;
  };
  io: {
    inputs: {
      switches: BoardIoGroup;
      buttons: BoardIoGroup;
    };
    outputs: {
      leds: BoardIoGroup;
      seven_seg: {
        segments: BoardIoGroup;
        anodes: BoardIoGroup;
      };
    };
    expansion?: {
      pmod?: Record<string, BoardIoGroup>;
    };
  };
  pinmap: {
    vivado_xdc?: string;
    ise_ucf?: string;
  };
};
