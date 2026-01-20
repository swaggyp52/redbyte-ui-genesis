export type BridgeSchemaVersion = 'bridge_v1';

export type BridgeTransport = 'uart' | 'jtag' | 'sim';

export type ProgrammingStatus = 'ready' | 'missing_driver' | 'busy' | 'error';
export type RuntimeStatus = 'ready' | 'permission_denied' | 'busy' | 'not_present' | 'error';

export type ProgrammingInfo = {
  kind: 'jtag' | 'sim';
  driver: string;
  status: ProgrammingStatus;
};

export type RuntimeInfo = {
  kind: 'uart' | 'sim';
  port?: string | null;
  baud_default: number;
  status: RuntimeStatus;
  diagnostics?: RuntimeDiagnostics;
};

export type RuntimeDiagnostics = {
  error?: string | null;
  fix?: string | null;
};

export type DeviceDiagnostics = {
  serial_port?: {
    path?: string | null;
    manufacturer?: string | null;
    vendor_id?: string | null;
    product_id?: string | null;
    serial_number?: string | null;
    pnp_id?: string | null;
    location_id?: string | null;
    friendly_name?: string | null;
  };
  runtime?: RuntimeDiagnostics;
};

export type BridgeDevice = {
  id: string;
  display_name: string;
  vendor: string;
  serial_number: string | null;
  model_id: string;
  board: string;
  transport?: BridgeTransport;
  port?: string | null;
  serial?: string | null;
  vid_pid?: string | null;
  detected_via?: string | null;
  programming: ProgrammingInfo;
  runtime: RuntimeInfo;
  confidence: number;
  reasons: string[];
  diagnostics?: DeviceDiagnostics;
};

export type DevicesResponse = {
  schema_version: BridgeSchemaVersion;
  devices: BridgeDevice[];
};

export type ProgramRequest = {
  schema_version: BridgeSchemaVersion;
  device_id: string;
  board_model_id: string;
  bitstream: {
    encoding: 'base64';
    data: string;
  };
};

export type ProgramResponse = {
  schema_version: BridgeSchemaVersion;
  ok: boolean;
  log_path?: string;
  error?: string;
};

export type RunMode = 'sim' | 'hardware';

export type RunRequest = {
  schema_version: BridgeSchemaVersion;
  device_id: string;
  board_model_id: string;
  mode: RunMode;
  bin_size_ms?: number;
};

export type RunResponse = {
  schema_version: BridgeSchemaVersion;
  ok: boolean;
  run_id: string;
  started_at_ms: number;
};

export type StopRequest = {
  schema_version: BridgeSchemaVersion;
  run_id: string;
};

export type StopResponse = {
  schema_version: BridgeSchemaVersion;
  ok: boolean;
  stopped_at_ms: number;
};

export type StreamIoState = {
  inputs: Record<string, string>;
  outputs: Record<string, string>;
};

export type StreamSampleEvent = {
  schema_version: BridgeSchemaVersion;
  type: 'sample';
  run_id: string;
  board_model_id: string;
  hw_tick: number;
  mono_seq: number;
  ts_wall_ms: number;
  io: StreamIoState;
};

export type StreamStatusEvent = {
  schema_version: BridgeSchemaVersion;
  type: 'status';
  run_id: string;
  state: 'starting' | 'running' | 'stopped' | 'error';
  ts_wall_ms: number;
  error?: string;
};

export type StreamEvent = StreamSampleEvent | StreamStatusEvent;
