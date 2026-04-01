const BRIDGE_URL = process.env.RB_BRIDGE_URL?.trim() || 'http://127.0.0.1:4242';
const STRICT = process.argv.includes('--strict');

interface DeviceEntry {
  deviceId?: string;
  target?: string;
  port?: string;
}

interface DevicesResponse {
  devices?: DeviceEntry[];
}

async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`timeout_${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function printBaselinePins(): void {
  console.log('[classroom:hw:check] required Lab 4 lines: SW1 SW2 SW3 SW4 SW5 SW8 -> LED1');
  console.log('[classroom:hw:check] pin reachability policy: verified by Basys3 contract + bridge board target');
}

async function main() {
  console.log(`[classroom:hw:check] bridge: ${BRIDGE_URL}`);
  if (STRICT) {
    console.log('[classroom:hw:check] mode: strict (Basys3 required)');
  }
  try {
    const devicesResponse = await fetchJson<DevicesResponse>(`${BRIDGE_URL}/devices`);
    const devices = Array.isArray(devicesResponse.devices) ? devicesResponse.devices : [];
    const basys3Devices = devices.filter((device) => String(device.target ?? '').toLowerCase().includes('basys3'));

    if (basys3Devices.length === 0) {
      console.log('[classroom:hw:check] Basys3 detected: NO');
      printBaselinePins();
      if (STRICT) {
        console.log('[classroom:hw:check] status: NOT_READY');
        process.exit(1);
      }
      console.log('[classroom:hw:check] note: simulation mode remains valid (non-blocking).');
      return;
    }

    const primary = basys3Devices[0];
    console.log('[classroom:hw:check] Basys3 detected: YES');
    console.log(`[classroom:hw:check] deviceId: ${primary.deviceId ?? 'unknown'}`);
    console.log(`[classroom:hw:check] port: ${primary.port ?? 'unknown'}`);
    printBaselinePins();
    console.log('[classroom:hw:check] status: READY');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log('[classroom:hw:check] Basys3 detected: UNKNOWN (bridge unavailable)');
    printBaselinePins();
    console.log(`[classroom:hw:check] note: ${message}`);
    if (STRICT) {
      console.log('[classroom:hw:check] status: NOT_READY');
      process.exit(1);
    }
    console.log('[classroom:hw:check] note: simulation mode remains valid (non-blocking).');
  }
}

void main();