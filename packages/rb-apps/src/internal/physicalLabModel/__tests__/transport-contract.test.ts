import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BridgeTransport } from '../transport/bridge-transport';
import { SimTransport } from '../transport/sim-transport';
import { TransportRouter } from '../transport/transport-router';
import {
    BRIDGE_PROTOCOL_VERSION, isBridgeMessage, isRecord,
} from '../transport/bridge-protocol';
import type { BridgeMessage, BridgeMessageType } from '../transport/bridge-protocol';

/** Protocol peer only: no HTTP server, serial device, or hardware evidence. */
class SocketPeer {
    static readonly OPEN = 1;
    static instances: SocketPeer[] = [];
    static replies = new Map<BridgeMessageType, { type: BridgeMessageType; payload?: unknown }>();
    readyState = 0;
    sent: BridgeMessage[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly url: string) { SocketPeer.instances.push(this); }
    open(): void { this.readyState = SocketPeer.OPEN; this.onopen?.(); }
    close(): void { this.readyState = 3; this.onclose?.(); }
    receive(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
    send(text: string): void {
        const value: unknown = JSON.parse(text);
        if (!isBridgeMessage(value)) throw new Error('Invalid client bridge envelope');
        this.sent.push(value);
        const reply = SocketPeer.replies.get(value.type);
        if (reply) this.receive({ v: BRIDGE_PROTOCOL_VERSION, id: value.id, ...reply });
    }
}

const transports: BridgeTransport[] = [];
function peer(): SocketPeer {
    const latest = SocketPeer.instances.at(-1);
    if (!latest) throw new Error('Transport did not create its socket');
    return latest;
}
async function connect(options?: Parameters<BridgeTransport['connect']>[0]): Promise<BridgeTransport> {
    const transport = new BridgeTransport('http://localhost:4243', 'test-device', 'test-token');
    transports.push(transport);
    const connected = transport.connect(options);
    peer().open();
    await connected;
    return transport;
}
function payloadFor(socket: SocketPeer, type: BridgeMessageType): Record<string, unknown> {
    const payload = socket.sent.find(message => message.type === type)?.payload;
    if (!isRecord(payload)) throw new Error(`Missing ${type} payload`);
    return payload;
}

beforeEach(() => {
    vi.useFakeTimers();
    SocketPeer.instances = [];
    SocketPeer.replies = new Map<BridgeMessageType, { type: BridgeMessageType; payload?: unknown }>([
        ['AUTH', { type: 'AUTH_OK' }],
        ['CONNECT', { type: 'CONNECT_OK', payload: { target: 'basys3' } }],
        ['GET_PINS', { type: 'GET_PINS_OK', payload: { pins: { LED0: 1 } } }],
        ['LOAD_PRESET', { type: 'LOAD_PRESET_OK' }],
    ]);
    vi.stubGlobal('WebSocket', SocketPeer);
});
afterEach(async () => {
    for (const transport of transports.splice(0)) await transport.disconnect();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('retained phase6 transport positive contract', () => {
    it('connects, authenticates, preserves interaction/preset/poll assertions, and disconnects', async () => {
        const transport = await connect();
        const socket = peer();
        expect(transport.getStatus().connected).toBe(true);
        expect(socket.sent.slice(0, 2).map(message => message.type)).toEqual(['AUTH', 'CONNECT']);
        expect(payloadFor(socket, 'AUTH').token).toBe('test-token');
        transport.pushInteraction('fpga-1', 'SW0', 1);
        await vi.advanceTimersByTimeAsync(150);
        const setPins = socket.sent.find(message => message.type === 'SET_PINS');
        expect(setPins).toBeDefined();
        const pins = payloadFor(socket, 'SET_PINS').pins;
        if (!isRecord(pins)) throw new Error('Missing SET_PINS pins');
        expect(pins.SW0).toBe(1);
        transport.loadPreset('fpga-1', 'blink');
        await vi.advanceTimersByTimeAsync(150);
        const loadPreset = socket.sent.find(message => message.type === 'LOAD_PRESET');
        expect(loadPreset).toBeDefined();
        expect(payloadFor(socket, 'LOAD_PRESET').presetId).toBe('blink');
        expect(socket.sent.find(message => message.type === 'GET_PINS')).toBeDefined();
        expect(transport.poll()['fpga-1:LED0']).toBe(1);
        await transport.disconnect();
        expect(transport.getStatus().connected).toBe(false);
    });

    it('connects Arduino UNO using the specified port', async () => {
        const transport = await connect({ target: 'arduino-uno', port: 'COM6' });
        expect(transport.getStatus().connected).toBe(true);
        expect(payloadFor(peer(), 'CONNECT').target).toBe('arduino-uno');
        expect(payloadFor(peer(), 'CONNECT').port).toBe('COM6');
        await transport.disconnect();
    });
});

describe('wire truth and owned lifecycle', () => {
    it('reports connected only after both actual AUTH_OK and CONNECT_OK acknowledgements', async () => {
        SocketPeer.replies.delete('AUTH');
        SocketPeer.replies.delete('CONNECT');
        const transport = new BridgeTransport();
        transports.push(transport);
        const connecting = transport.connect({ target: 'basys3', port: 'COM6' });
        const socket = peer();
        expect(transport.getStatus()).toMatchObject({ connected: false, deviceVerified: false });
        expect(vi.getTimerCount()).toBe(0);

        socket.open();
        expect(socket.sent.map(message => message.type)).toEqual(['AUTH']);
        expect(transport.getStatus().connected).toBe(false);
        transport.pushInteraction('fpga-1', 'SW0', 1);
        transport.loadPreset('fpga-1', 'blink');
        await vi.advanceTimersByTimeAsync(100);
        expect(socket.sent.map(message => message.type)).toEqual(['AUTH']);
        const auth = socket.sent.find(message => message.type === 'AUTH');
        if (!auth) throw new Error('AUTH request missing');
        socket.receive({ v: BRIDGE_PROTOCOL_VERSION, id: auth.id, type: 'AUTH_OK' });
        await vi.advanceTimersByTimeAsync(0);
        expect(socket.sent.map(message => message.type)).toEqual(['AUTH', 'CONNECT']);
        expect(transport.getStatus()).toMatchObject({ connected: false, deviceVerified: false });

        transport.pushInteraction('fpga-1', 'SW1', 1);
        await vi.advanceTimersByTimeAsync(100);
        expect(socket.sent.map(message => message.type)).toEqual(['AUTH', 'CONNECT']);
        const connectRequest = socket.sent.find(message => message.type === 'CONNECT');
        if (!connectRequest) throw new Error('CONNECT request missing');
        socket.receive({ v: BRIDGE_PROTOCOL_VERSION, id: connectRequest.id,
            type: 'CONNECT_OK', payload: { target: 'basys3' } });
        await connecting;
        expect(transport.getStatus()).toMatchObject({ connected: true, deviceVerified: false });
        transport.pushInteraction('fpga-1', 'SW0', 1);
        expect(socket.sent.some(message => message.type === 'SET_PINS')).toBe(true);
        await vi.advanceTimersByTimeAsync(50);
        expect(transport.poll()['fpga-1:LED0']).toBe(1);
        await transport.disconnect();
        expect(transport.getStatus().connected).toBe(false);
    });

    it('keeps authenticated but rejected CONNECT disconnected without starting polling', async () => {
        SocketPeer.replies.delete('CONNECT');
        const transport = new BridgeTransport();
        transports.push(transport);
        const connecting = transport.connect({ target: 'basys3' });
        const socket = peer();
        socket.open();
        await vi.advanceTimersByTimeAsync(0);
        const request = socket.sent.find(message => message.type === 'CONNECT');
        if (!request) throw new Error('Authenticated CONNECT request missing');
        expect(transport.getStatus().connected).toBe(false);
        socket.receive({ v: BRIDGE_PROTOCOL_VERSION, id: request.id, type: 'CONNECT_ERR',
            payload: { message: 'Port must be explicitly specified' } });
        await connecting;
        expect(transport.getStatus()).toMatchObject({ connected: false, deviceVerified: false,
            error: 'Port must be explicitly specified' });
        expect(socket.sent.some(message => message.type === 'GET_PINS')).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('rejects an authentication error and never reports a connected handshake', async () => {
        SocketPeer.replies.set('AUTH', { type: 'AUTH_ERR', payload: { message: 'Invalid token' } });
        const transport = await connect();
        expect(transport.getStatus()).toMatchObject({ connected: false, deviceVerified: false, error: 'Invalid token' });
        expect(peer().sent.some(message => message.type === 'CONNECT')).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps actual observations when malformed/wrong-version polling frames arrive', async () => {
        const transport = await connect();
        transport.pushInteraction('fpga-1', 'SW0', 1);
        await vi.advanceTimersByTimeAsync(50);
        const before = transport.poll();
        peer().receive({ v: BRIDGE_PROTOCOL_VERSION, id: 100, type: 'GET_PINS_OK', payload: { pins: { LED0: 'false' } } });
        peer().receive({ v: 'wrong-version', id: 101, type: 'GET_PINS_OK', payload: { pins: { LED0: 0 } } });
        expect(transport.poll()).toBe(before);
        expect(transport.poll()['fpga-1:LED0']).toBe(1);
    });

    it('accepts the real upload artifact response without inventing a required message', async () => {
        const transport = await connect();
        const artifact = { sketchSha256: 'owner-sha', fqbn: 'arduino:avr:uno', port: 'COM6' };
        SocketPeer.replies.set('UPLOAD_SKETCH', { type: 'UPLOAD_SKETCH_OK', payload: { ok: true, artifact } });
        expect(await transport.uploadSketch({ target: 'arduino-uno', fqbn: artifact.fqbn, port: artifact.port, sketchText: 'void loop() {}' }))
            .toEqual({ ok: true, artifact });
    });

    it('never invents board identity for missing/disconnected verification', async () => {
        const transport = await connect();
        SocketPeer.replies.set('VERIFY_DEVICE', { type: 'VERIFY_DEVICE_OK', payload: { verified: true } });
        expect(await transport.verifyDevice()).toEqual({ verified: false, error: 'Invalid or missing bridge verification response' });
        expect(transport.getStatus().deviceVerified).toBe(false);
        await transport.disconnect();
        expect(await transport.verifyDevice()).toEqual({ verified: false, error: 'Not connected to bridge agent' });
    });

    it('retains HTTP discovery then guarded WebSocket fallback', async () => {
        const transport = await connect();
        const device = { target: 'arduino-uno', port: 'COM6', manufacturer: 'Arduino', deviceId: 'uno' };
        SocketPeer.replies.set('LIST_DEVICES', { type: 'LIST_DEVICES_OK', payload: { devices: [device] } });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ devices: [{ port: 42 }] }) }));
        expect(await transport.listDevices()).toEqual([device]);
    });

    it('settles pending requests and clears every timer when explicitly disconnected', async () => {
        const transport = await connect();
        const socketCount = SocketPeer.instances.length;
        const verification = transport.verifyDevice();
        expect(vi.getTimerCount()).toBe(2); // Poll interval plus unresolved request timeout.
        await transport.disconnect();
        expect(await verification).toEqual({ verified: false, error: 'Invalid or missing bridge verification response' });
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(30000);
        expect(SocketPeer.instances).toHaveLength(socketCount);
    });

    it('settles a connecting handshake on disconnect and ignores its late socket open', async () => {
        const transport = new BridgeTransport();
        transports.push(transport);
        const pending = transport.connect();
        const socket = peer();
        await transport.disconnect();
        await pending;
        socket.open();
        expect(socket.sent).toEqual([]);
        expect(transport.getStatus().connected).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('preserves automatic reconnect after accidental close and cancels it on explicit disconnect', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('VITEST', '');
        const transport = await connect();
        peer().close();
        expect(transport.getStatus().connected).toBe(false);
        expect(vi.getTimerCount()).toBe(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(SocketPeer.instances).toHaveLength(2);
        peer().open();
        await vi.advanceTimersByTimeAsync(0);
        expect(transport.getStatus().connected).toBe(true);
        await transport.disconnect();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(30000);
        expect(SocketPeer.instances).toHaveLength(2);
    });

    it('bounds an unanswered authentication request and removes the disconnected request timer', async () => {
        SocketPeer.replies.delete('AUTH');
        const transport = new BridgeTransport();
        transports.push(transport);
        const connected = transport.connect();
        peer().open();
        await vi.advanceTimersByTimeAsync(5000);
        await connected;
        expect(transport.getStatus().connected).toBe(false);
        expect(transport.getStatus().error).toBe('Bridge authentication failed');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('preserves numeric simulation passthrough and routed lifecycle without claiming hardware', async () => {
        const simulation = new SimTransport('passthrough');
        simulation.pushInteraction('fpga-1', 'SW0', 3);
        simulation.tickWithInputs({ SW1: 0.5 });
        expect(simulation.poll()['fpga-1:LED0']).toBe(3);
        expect(simulation.poll()['fpga-1:LED1']).toBe(0.5);
        const router = new TransportRouter();
        router.addTransport('sim', simulation);
        await router.connect();
        expect(router.getStatus().connected).toBe(true);
        expect(router.poll()).toEqual(simulation.poll());
        expect(await router.verifyDevice()).toEqual({ verified: false, error: 'No suitable transport found for verification' });
        await router.disconnect();
    });
});
