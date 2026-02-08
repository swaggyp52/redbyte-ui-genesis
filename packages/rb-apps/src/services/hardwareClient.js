// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { BRIDGE_PROTOCOL_VERSION } from '@redbyte/rb-protocol';
import { progressFail, progressStart, progressSucceed, progressUpdate, RbUserError, toStudentFacingError, } from '@redbyte/rb-utils';
function isBridgeDryrunEnabled() {
    try {
        if (typeof process !== 'undefined' && process.env?.RB_BRIDGE_DRYRUN === '1')
            return true;
    }
    catch {
        // ignore
    }
    try {
        const env = import.meta?.env;
        return env?.VITE_RB_BRIDGE_DRYRUN === '1';
    }
    catch {
        return false;
    }
}
function getDefaultSingletonMode() {
    try {
        const env = process?.env;
        const isVitest = env?.VITEST === 'true' || env?.VITEST === '1' || env?.NODE_ENV === 'test';
        return isVitest ? 'off' : 'auto';
    }
    catch {
        return 'auto';
    }
}
export class HardwareClient {
    config;
    state;
    healthCheckInterval = null;
    wsReconnectTimeout = null;
    backgroundReconnectInterval = null;
    dryrunInterval = null;
    listeners = new Set();
    ioListeners = new Set();
    statusListeners = new Set();
    retryAttempts = 0;
    MAX_RETRY_ATTEMPTS = 3;
    RETRY_DELAY_MS = 2000;
    HEALTH_CHECK_INTERVAL_MS = 10000;
    BACKGROUND_RECONNECT_MS = 30000; // Try to recover every 30s when offline
    DEMO_MODE_ENABLED = typeof process !== 'undefined' && process.env.RB_DEMO_MODE === '1';
    DRYRUN_ENABLED = isBridgeDryrunEnabled();
    FETCH_TIMEOUT_MS = this.DEMO_MODE_ENABLED ? 500 : 2000; // Fast fail in demo mode
    // Active device state
    activeDevice = null;
    capabilities = null;
    latestIOSnapshot = null;
    latestRunState = { runId: null, status: 'idle' };
    constructor(config) {
        this.config = {
            httpUrl: config?.httpUrl ?? 'http://127.0.0.1:4242',
            wsUrl: config?.wsUrl ?? 'ws://127.0.0.1:4242/ws',
            mode: config?.mode ?? 'auto',
        };
        this.state = {
            status: 'offline',
            reason: 'disabled',
            message: this.DRYRUN_ENABLED ? 'Hardware bridge dry-run enabled' : 'Hardware integration disabled (demo mode)',
        };
        if (typeof window !== 'undefined') {
            const savedMode = localStorage.getItem('rb-hardware-mode');
            if (savedMode === 'on' || savedMode === 'off' || savedMode === 'auto') {
                this.config.mode = savedMode;
            }
        }
        if (this.config.mode !== 'off') {
            this.connect();
        }
    }
    getState() {
        return this.state;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }
    notifyListeners() {
        this.listeners.forEach((listener) => listener(this.state));
    }
    setMode(mode) {
        this.config.mode = mode;
        if (typeof window !== 'undefined') {
            localStorage.setItem('rb-hardware-mode', mode);
        }
        if (mode === 'off') {
            this.disconnect();
            this.state = {
                status: 'offline',
                reason: 'disabled',
                message: this.DRYRUN_ENABLED ? 'Hardware bridge dry-run enabled' : 'Hardware integration disabled (demo mode)',
            };
            this.notifyListeners();
        }
        else {
            this.connect();
        }
    }
    startDryrun() {
        const bridge = {
            ok: true,
            version: BRIDGE_PROTOCOL_VERSION,
            status: 'dryrun',
        };
        const bridgeDevices = [
            { deviceId: 'basys3', target: 'basys3', port: 'DRYRUN', manufacturer: 'dryrun', serialNumber: 'dryrun-basys3' },
            { deviceId: 'uno', target: 'arduino-uno', port: 'DRYRUN', manufacturer: 'dryrun', serialNumber: 'dryrun-uno' },
        ];
        const devices = bridgeDevices.map((bd) => ({
            deviceId: bd.deviceId || 'unknown',
            boardModel: bd.target === 'arduino-uno'
                ? 'Arduino Uno'
                : bd.target === 'basys3'
                    ? 'Basys 3'
                    : 'Unknown Board',
            boardFamily: bd.target === 'basys3' ? 'fpga' : 'avr',
            serial: bd.serialNumber || '',
            transport: 'dryrun',
            toolchain: bd.target === 'basys3' ? 'vivado' : 'arduino-cli',
            status: 'ready',
            runtime: { port: bd.port, baud_default: 115200, status: 'ready' },
        }));
        this.state = {
            status: 'connected',
            bridge,
            devices,
            ws: null,
        };
        this.retryAttempts = 0;
        this.stopBackgroundReconnect();
        this.notifyListeners();
        if (this.healthCheckInterval)
            clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = setInterval(() => this.checkHealth(), this.HEALTH_CHECK_INTERVAL_MS);
        if (this.dryrunInterval)
            clearInterval(this.dryrunInterval);
        let tick = 0;
        this.dryrunInterval = setInterval(() => {
            tick += 1;
            const snapshot = {
                timestamp: new Date().toISOString(),
                tick,
                inputs: { SW: tick % 2, BTN: 0 },
                outputs: { LED: tick % 2 },
            };
            this.latestIOSnapshot = snapshot;
            this.ioListeners.forEach((cb) => cb(snapshot));
        }, 250);
    }
    async connect() {
        if (this.config.mode === 'off') {
            return;
        }
        if (this.state.status === 'connecting' || this.state.status === 'connected') {
            return;
        }
        if (this.DRYRUN_ENABLED) {
            this.startDryrun();
            return;
        }
        this.state = {
            status: 'connecting',
            message: 'Connecting to hardware bridge...',
        };
        this.notifyListeners();
        try {
            const res = await fetch(`${this.config.httpUrl}/health`, {
                signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const bridge = await res.json();
            const devicesRes = await fetch(`${this.config.httpUrl}/devices`, {
                signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
            });
            // Bridge returns { devices: BridgeDevice[] }
            const devicesData = devicesRes.ok ? await devicesRes.json() : { devices: [] };
            const bridgeDevices = Array.isArray(devicesData) ? devicesData : (devicesData.devices ?? []);
            // MAP TO INTERNAL DEVICE TYPE
            const devices = bridgeDevices.map(bd => ({
                deviceId: bd.deviceId || 'unknown',
                boardModel: bd.target === 'arduino-uno' ? 'Arduino Uno' : (bd.target === 'basys3' ? 'Basys 3' : 'Unknown Board'),
                boardFamily: bd.target === 'basys3' ? 'fpga' : 'avr',
                serial: bd.serialNumber || '',
                transport: 'serial',
                toolchain: bd.target === 'basys3' ? 'vivado' : 'arduino-cli',
                status: 'ready',
                runtime: {
                    port: bd.port,
                    baud_default: bd.target === 'basys3' ? 115200 : 115200,
                    status: 'ready'
                }
            }));
            this.state = {
                status: 'connected',
                bridge,
                devices,
                ws: null,
            };
            this.retryAttempts = 0;
            this.stopBackgroundReconnect();
            this.notifyListeners();
            if (this.healthCheckInterval)
                clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = setInterval(() => this.checkHealth(), this.HEALTH_CHECK_INTERVAL_MS);
            this.connectWS();
        }
        catch (error) {
            this.retryAttempts++;
            if (this.retryAttempts >= this.MAX_RETRY_ATTEMPTS || this.config.mode === 'auto') {
                this.state = {
                    status: 'offline',
                    reason: 'unavailable',
                    message: 'RedByte Bridge Unreachable. Ensure the bridge agent is running on your machine.',
                };
                this.notifyListeners();
                console.debug('[HardwareClient] Bridge unavailable, entering offline mode');
                this.startBackgroundReconnect();
            }
            else {
                console.warn(`[HardwareClient] Connection attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS} failed, retrying in ${this.RETRY_DELAY_MS}ms...`);
                this.state = {
                    status: 'connecting',
                    message: `Retrying connection (${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS})...`,
                };
                this.notifyListeners();
                setTimeout(() => this.connect(), this.RETRY_DELAY_MS);
            }
        }
    }
    async checkHealth() {
        if (this.state.status !== 'connected')
            return;
        if (this.DRYRUN_ENABLED)
            return;
        try {
            const res = await fetch(`${this.config.httpUrl}/health`, {
                signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
            });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const bridge = await res.json();
            const devicesRes = await fetch(`${this.config.httpUrl}/devices`, {
                signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
            });
            const devicesData = devicesRes.ok ? await devicesRes.json() : { devices: [] };
            const devices = Array.isArray(devicesData) ? devicesData : (devicesData.devices ?? []);
            if (this.state.status === 'connected') {
                this.state = {
                    status: 'connected',
                    bridge,
                    devices,
                    ws: this.state.ws,
                };
                this.notifyListeners();
            }
        }
        catch {
            console.warn('[HardwareClient] Health check failed, disconnecting');
            this.disconnect();
            this.state = {
                status: 'offline',
                reason: 'failed',
                message: 'RedByte Bridge Unreachable. Ensure the bridge agent is running on your machine.',
            };
            this.notifyListeners();
            this.startBackgroundReconnect();
        }
    }
    connectWS(urlOverride) {
        if (this.state.status !== 'connected' || this.state.ws)
            return;
        // Default to config URL, but allow override for fallback
        const url = urlOverride ?? this.config.wsUrl;
        let hasConnected = false;
        try {
            const socket = new WebSocket(url);
            socket.onopen = () => {
                console.log(`[HardwareClient] WebSocket connected to ${url}`);
                hasConnected = true;
                if (this.state.status === 'connected') {
                    this.state = {
                        status: 'connected',
                        bridge: this.state.bridge,
                        devices: this.state.devices,
                        ws: socket,
                    };
                    this.notifyListeners();
                }
            };
            socket.onmessage = (event) => {
                this.handleWSMessage(event.data);
            };
            socket.onerror = (error) => {
                if (import.meta.env.DEV) {
                    console.warn(`[HardwareClient] WebSocket error on ${url}:`, error);
                }
            };
            socket.onclose = () => {
                console.log(`[HardwareClient] WebSocket closed (${url})`);
                // If we never connected and this was the default URL, try the fallback
                if (!hasConnected && !urlOverride && url.endsWith('/ws')) {
                    const fallbackUrl = url.replace(/\/ws$/, '/');
                    console.log(`[HardwareClient] Primary WS path failed, attempting fallback: ${fallbackUrl}`);
                    // Short timeout to avoid frantic loops, but fast enough to not feel broken
                    this.wsReconnectTimeout = setTimeout(() => this.connectWS(fallbackUrl), 500);
                    return;
                }
                if (this.state.status === 'connected') {
                    this.state = {
                        status: 'connected',
                        bridge: this.state.bridge,
                        devices: this.state.devices,
                        ws: null,
                    };
                    this.notifyListeners();
                    if (this.wsReconnectTimeout)
                        clearTimeout(this.wsReconnectTimeout);
                    // Retry the *original* configured URL next time (reset fallback logic)
                    this.wsReconnectTimeout = setTimeout(() => this.connectWS(), this.RETRY_DELAY_MS);
                }
            };
        }
        catch (error) {
            if (import.meta.env.DEV) {
                console.warn('[HardwareClient] Failed to create WebSocket:', error);
            }
        }
    }
    /**
     * Periodically attempt to reconnect when in offline state.
     * Stops automatically once a connection succeeds or mode is set to 'off'.
     */
    startBackgroundReconnect() {
        if (this.config.mode === 'off')
            return;
        if (this.backgroundReconnectInterval)
            return; // Already running
        this.backgroundReconnectInterval = setInterval(() => {
            if (this.config.mode === 'off') {
                this.stopBackgroundReconnect();
                return;
            }
            if (this.state.status === 'offline') {
                console.debug('[HardwareClient] Background reconnect attempt...');
                this.retryAttempts = 0;
                this.connect();
            }
            else {
                // Connected or connecting — stop background polling
                this.stopBackgroundReconnect();
            }
        }, this.BACKGROUND_RECONNECT_MS);
    }
    stopBackgroundReconnect() {
        if (this.backgroundReconnectInterval) {
            clearInterval(this.backgroundReconnectInterval);
            this.backgroundReconnectInterval = null;
        }
    }
    disconnect() {
        if (this.dryrunInterval) {
            clearInterval(this.dryrunInterval);
            this.dryrunInterval = null;
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        if (this.wsReconnectTimeout) {
            clearTimeout(this.wsReconnectTimeout);
            this.wsReconnectTimeout = null;
        }
        this.stopBackgroundReconnect();
        if (this.state.status === 'connected' && this.state.ws) {
            this.state.ws.close();
        }
        this.retryAttempts = 0;
    }
    // Handle WebSocket messages
    handleWSMessage(data) {
        try {
            const msg = JSON.parse(data.toString());
            // Handle io:update events
            if (msg.type === 'io:update' || msg.SW !== undefined || msg.io !== undefined) {
                const snapshot = {
                    timestamp: msg.timestamp || new Date().toISOString(),
                    tick: msg.tick ?? msg.TICK ?? msg.mono_seq ?? msg.hw_tick,
                    inputs: {},
                    outputs: {},
                };
                // Extract inputs/outputs from various message formats
                if (msg.changes) {
                    // Bridge contract format: { changes: { SW, BTN, LED } }
                    if (msg.changes.SW !== undefined)
                        snapshot.inputs.SW = msg.changes.SW;
                    if (msg.changes.BTN !== undefined)
                        snapshot.inputs.BTN = msg.changes.BTN;
                    if (msg.changes.LED !== undefined)
                        snapshot.outputs.LED = msg.changes.LED;
                }
                else if (msg.io) {
                    // Stream sample format: { io: { SW, BTN, LED } }
                    if (msg.io.SW !== undefined)
                        snapshot.inputs.SW = msg.io.SW;
                    if (msg.io.BTN !== undefined)
                        snapshot.inputs.BTN = msg.io.BTN;
                    if (msg.io.LED !== undefined)
                        snapshot.outputs.LED = msg.io.LED;
                }
                else {
                    // Direct format: { SW, BTN, LED }
                    if (msg.SW !== undefined)
                        snapshot.inputs.SW = msg.SW;
                    if (msg.BTN !== undefined)
                        snapshot.inputs.BTN = msg.BTN;
                    if (msg.LED !== undefined)
                        snapshot.outputs.LED = msg.LED;
                }
                this.latestIOSnapshot = snapshot;
                this.ioListeners.forEach((listener) => listener(snapshot));
            }
            else if (msg.type === 'status' || msg.state !== undefined) {
                // Handle status update
                const newState = {
                    runId: msg.run_id || this.latestRunState.runId,
                    status: msg.state || 'idle',
                    hint: msg.hint,
                    error: msg.error
                };
                this.latestRunState = newState;
                this.statusListeners.forEach(l => l(newState));
            }
        }
        catch {
            // Ignore parse errors
        }
    }
    // Safe contract getters - never return undefined
    getDevices() {
        if (this.state.status === 'connected') {
            return this.state.devices ?? [];
        }
        return [];
    }
    /**
     * Get the active device (the one we're connected to)
     */
    getActiveDevice() {
        return this.activeDevice;
    }
    /**
     * Get capabilities of the active device
     */
    getCapabilities() {
        return this.capabilities;
    }
    /**
     * Get latest I/O snapshot (from WebSocket)
     */
    getLatestIO() {
        return this.latestIOSnapshot;
    }
    /**
     * Select and connect to a specific device
     */
    async selectDevice(deviceId, opts) {
        const actionId = `rb:hw:device:${deviceId}:select`;
        if (this.state.status !== 'connected') {
            const error = new RbUserError('HW_NOT_CONNECTED', 'Cannot select device: not connected to bridge');
            progressFail(actionId, {
                code: 'HW_NOT_CONNECTED',
                studentMessage: error.message,
                details: { deviceId },
            });
            return false;
        }
        const device = this.state.devices.find(d => d.deviceId === deviceId);
        if (!device) {
            const error = new RbUserError('HW_DEVICE_NOT_FOUND', `Device not found: ${deviceId}`);
            progressFail(actionId, {
                code: 'HW_DEVICE_NOT_FOUND',
                studentMessage: error.message,
                details: { deviceId },
            });
            return false;
        }
        progressStart(actionId, `Connecting to ${device.boardModel}...`);
        // Determine target from device metadata or ID
        let target = 'unknown';
        if (device.deviceId === 'basys3' || device.boardModel?.toLowerCase().includes('basys')) {
            target = 'basys3';
        }
        else if (device.deviceId === 'uno' || device.boardModel?.toLowerCase().includes('uno')) {
            target = 'arduino-uno';
        }
        else {
            target = device.deviceId;
        }
        const payload = {
            target,
            port: device.port || device.runtime?.port,
            baud: device.runtime?.baud_default
        };
        if (this.DRYRUN_ENABLED) {
            this.activeDevice = device;
            this.capabilities = this.buildCapabilitiesFromDevice(device);
            progressSucceed(actionId, `Connected to ${device.boardModel} (dry-run)`);
            return true;
        }
        return new Promise((resolve) => {
            if (this.state.status !== 'connected' || !this.state.ws) {
                progressFail(actionId, {
                    code: 'HW_NOT_CONNECTED',
                    studentMessage: 'WebSocket not available',
                    details: { deviceId },
                });
                resolve(false);
                return;
            }
            const ws = this.state.ws;
            const id = Math.floor(Math.random() * 1000000);
            const handler = (event) => {
                try {
                    const msg = JSON.parse(event.data.toString());
                    if (msg.id === id) {
                        ws.removeEventListener('message', handler);
                        if (msg.type === 'CONNECT_OK') {
                            this.activeDevice = device;
                            this.capabilities = this.buildCapabilitiesFromDevice(device);
                            progressSucceed(actionId, `Connected to ${device.boardModel}`);
                            resolve(true);
                        }
                        else {
                            const error = toStudentFacingError(new RbUserError('HW_CONNECT_FAILED', msg.payload?.message || 'Device connection failed'));
                            progressFail(actionId, {
                                code: error.code,
                                studentMessage: error.message,
                                details: { deviceId, response: msg },
                            });
                            resolve(false);
                        }
                    }
                }
                catch (e) {
                    // Ignore parse errors from other messages
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({
                v: 'rb-bridge.v1',
                id,
                type: 'CONNECT',
                deviceId: deviceId,
                payload
            }));
            const timeoutId = setTimeout(() => {
                ws.removeEventListener('message', handler);
                progressFail(actionId, {
                    code: 'HW_TIMEOUT',
                    studentMessage: 'Device connection timed out',
                    details: { deviceId },
                });
                resolve(false);
            }, 5000);
            if (opts?.signal) {
                opts.signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    ws.removeEventListener('message', handler);
                    progressFail(actionId, {
                        code: 'RB_CANCELED',
                        studentMessage: 'Device connection canceled',
                        details: { deviceId },
                    });
                    resolve(false);
                });
            }
        });
    }
    /**
     * Build capabilities from device info
     */
    buildCapabilitiesFromDevice(device) {
        // Default capabilities based on board model
        const boardId = device.boardModel?.toLowerCase() || 'unknown';
        if (boardId.includes('basys') || boardId === 'basys3') {
            return {
                boardId: 'basys3',
                boardName: 'Basys3',
                manufacturer: 'Digilent',
                inputs: [
                    { name: 'SW', width: 16, kind: 'switch', labels: ['SW15', 'SW14', 'SW13', 'SW12', 'SW11', 'SW10', 'SW9', 'SW8', 'SW7', 'SW6', 'SW5', 'SW4', 'SW3', 'SW2', 'SW1', 'SW0'] },
                    { name: 'BTN', width: 5, kind: 'button', labels: ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'] },
                ],
                outputs: [
                    { name: 'LED', width: 16, kind: 'led', labels: ['LD15', 'LD14', 'LD13', 'LD12', 'LD11', 'LD10', 'LD9', 'LD8', 'LD7', 'LD6', 'LD5', 'LD4', 'LD3', 'LD2', 'LD1', 'LD0'], writable: true },
                ],
                features: ['trace', 'program', 'vectors', 'uart', 'jtag'],
                clock: { name: 'CLK100MHZ', frequencyHz: 100000000 },
            };
        }
        if (boardId.includes('spartan') || boardId === 'spartan3e-starter') {
            return {
                boardId: 'spartan3e-starter',
                boardName: 'Spartan-3E Starter Kit',
                manufacturer: 'Digilent',
                inputs: [
                    {
                        name: 'SW',
                        width: 4,
                        kind: 'switch',
                        labels: ['SW3', 'SW2', 'SW1', 'SW0'],
                        pins: ['N17', 'H18', 'L14', 'L13']
                    },
                    {
                        name: 'BTN',
                        width: 4,
                        kind: 'button',
                        labels: ['BTN_EAST', 'BTN_NORTH', 'BTN_SOUTH', 'BTN_WEST'],
                        pins: ['H13', 'V4', 'K17', 'D18']
                    },
                    {
                        name: 'ROT',
                        width: 3,
                        kind: 'switch', // Treated as general input
                        labels: ['ROT_A', 'ROT_B', 'ROT_CENTER'],
                        pins: ['K18', 'G18', 'V16']
                    }
                ],
                outputs: [
                    {
                        name: 'LED',
                        width: 8,
                        kind: 'led',
                        labels: ['LD7', 'LD6', 'LD5', 'LD4', 'LD3', 'LD2', 'LD1', 'LD0'],
                        pins: ['F9', 'E9', 'D11', 'C11', 'F11', 'E11', 'E12', 'F12'],
                        writable: true
                    },
                ],
                features: ['trace', 'program', 'vectors', 'uart', 'jtag'],
                clock: { name: 'CLK_50MHZ', frequencyHz: 50000000 },
            };
        }
        // Generic fallback
        return {
            boardId: boardId,
            boardName: device.boardModel || 'Unknown Board',
            manufacturer: 'Unknown',
            inputs: [
                { name: 'SW', width: 8, kind: 'switch' },
                { name: 'BTN', width: 4, kind: 'button' },
            ],
            outputs: [
                { name: 'LED', width: 8, kind: 'led', writable: true },
            ],
            features: [],
        };
    }
    /**
     * Subscribe to I/O updates from WebSocket
     */
    subscribeIO(callback) {
        this.ioListeners.add(callback);
        // Send latest snapshot immediately if available
        if (this.latestIOSnapshot) {
            callback(this.latestIOSnapshot);
        }
        return () => this.ioListeners.delete(callback);
    }
    /**
     * Subscribe to Run Status updates
     */
    subscribeStatus(callback) {
        this.statusListeners.add(callback);
        callback(this.latestRunState);
        return () => this.statusListeners.delete(callback);
    }
    /**
     * Set output values (e.g., LED state)
     * For simulation/testing mode only - real hardware outputs are driven by DUT
     */
    async setOutputs(outputs) {
        if (this.state.status !== 'connected') {
            console.warn('[HardwareClient] Cannot set outputs: not connected');
            return false;
        }
        try {
            // Try to set each output via the API
            for (const [signal, value] of Object.entries(outputs)) {
                const endpoint = `${this.config.httpUrl.replace('/api/v1', '')}/api/io/${signal.toLowerCase()}/0`;
                await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value }),
                    signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
                });
            }
            return true;
        }
        catch (error) {
            console.warn('[HardwareClient] Failed to set outputs:', error);
            return false;
        }
    }
    /**
     * Set pins (LEDs) on the active device via the bridge.
     * This sends LED values to hardware (Basys3, Arduino, etc.)
     *
     * PHASE 1: Bidirectional Telemetry
     * Supports simulation → hardware feedback for Labs.
     * Example: Simulation computes outputs, setPins drives LEDs on physical board.
     */
    async setPins(pins) {
        if (this.state.status !== 'connected' || !this.state.ws) {
            console.warn('[HardwareClient] Cannot set pins: not connected to bridge');
            return false;
        }
        if (!this.activeDevice) {
            console.warn('[HardwareClient] Cannot set pins: no active device selected');
            return false;
        }
        try {
            const id = Math.floor(Math.random() * 1000000);
            return new Promise((resolve) => {
                const handler = (event) => {
                    try {
                        const msg = JSON.parse(event.data.toString());
                        if (msg.id === id) {
                            this.state.ws?.removeEventListener('message', handler);
                            if (msg.type === 'SET_PINS_OK' || msg.status === 'ok') {
                                console.debug(`[HardwareClient] Pins set successfully: ${JSON.stringify(pins)}`);
                                resolve(true);
                            }
                            else {
                                console.warn(`[HardwareClient] Set pins failed: ${msg.payload?.message || msg.error}`);
                                resolve(false);
                            }
                        }
                    }
                    catch (e) {
                        // Ignore parse errors
                    }
                };
                if (this.state.ws) {
                    this.state.ws.addEventListener('message', handler);
                    // Send SET_PINS message via WebSocket
                    this.state.ws.send(JSON.stringify({
                        v: 'rb-bridge.v1',
                        id,
                        type: 'SET_PINS',
                        deviceId: this.activeDevice?.deviceId,
                        payload: { pins }
                    }));
                    // Timeout: resolve false if no response in 2 seconds
                    setTimeout(() => {
                        if (this.state.ws) {
                            this.state.ws.removeEventListener('message', handler);
                        }
                        resolve(false);
                    }, 2000);
                }
                else {
                    resolve(false);
                }
            });
        }
        catch (error) {
            console.error('[HardwareClient] setPins error:', error.message);
            return false;
        }
    }
    async getIO(sessionId) {
        if (this.state.status !== 'connected') {
            return {
                timestamp: new Date().toISOString(),
                inputs: {},
                outputs: {}
            };
        }
        try {
            const res = await fetch(`${this.config.httpUrl}/session/${sessionId}/io`, {
                signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return await res.json();
        }
        catch (error) {
            console.warn('[HardwareClient] Failed to get IO:', error);
            return {
                timestamp: new Date().toISOString(),
                inputs: {},
                outputs: {}
            };
        }
    }
    async exportProof(opts) {
        const actionId = 'rb:hw:export:proof';
        if (this.state.status !== 'connected') {
            const error = new RbUserError('HW_NOT_CONNECTED', 'Hardware bridge not connected');
            progressFail(actionId, {
                code: 'HW_NOT_CONNECTED',
                studentMessage: error.message,
            });
            throw error;
        }
        try {
            progressStart(actionId, 'Exporting proof capsule...');
            const capsule = {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                bridge: this.state.bridge,
                devices: this.state.devices,
                snapshots: [],
            };
            const json = JSON.stringify(capsule, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            progressSucceed(actionId, 'Proof capsule exported');
            return blob;
        }
        catch (err) {
            const studentError = toStudentFacingError(err);
            progressFail(actionId, {
                code: studentError.code,
                studentMessage: studentError.message,
                details: { error: err },
            });
            throw err;
        }
    }
    async streamVectors(vectors, opts) {
        const actionId = 'rb:hw:stream:vectors';
        if (this.state.status !== 'connected') {
            const error = new RbUserError('HW_NOT_CONNECTED', 'Cannot stream vectors: not connected');
            progressFail(actionId, {
                code: 'HW_NOT_CONNECTED',
                studentMessage: error.message,
            });
            return false;
        }
        try {
            progressStart(actionId, `Streaming ${vectors.length} test vectors...`);
            const endpoint = `${this.config.httpUrl.replace('/api/v1', '')}/api/vectors/stream`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vectors }),
                signal: opts?.signal ?? AbortSignal.timeout(this.FETCH_TIMEOUT_MS * 5),
            });
            if (!res.ok) {
                throw new RbUserError('HW_STREAM_FAILED', `Failed to stream vectors: HTTP ${res.status}`);
            }
            progressSucceed(actionId, 'Test vectors streamed');
            return true;
        }
        catch (error) {
            if (opts?.signal?.aborted) {
                progressFail(actionId, {
                    code: 'RB_CANCELED',
                    studentMessage: 'Vector streaming canceled',
                });
                return false;
            }
            // Fallback: send individually if stream endpoint not available
            try {
                progressUpdate(actionId, 0.5, 'Using fallback method...');
                for (const v of vectors) {
                    await this.setOutputs(v.inputs);
                    if (v.delayMs)
                        await new Promise(r => setTimeout(r, v.delayMs));
                }
                progressSucceed(actionId, 'Test vectors streamed (fallback)');
                return true;
            }
            catch (fallbackErr) {
                const studentError = toStudentFacingError(fallbackErr);
                progressFail(actionId, {
                    code: studentError.code,
                    studentMessage: studentError.message,
                    details: { error: fallbackErr },
                });
                return false;
            }
        }
    }
}
// Singleton instance
export const hardwareClient = new HardwareClient({ mode: getDefaultSingletonMode() });
