
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArduinoUnoBackend } from '../backends/arduino-uno.js';
import { SerialPort } from 'serialport';

// Mock serialport
vi.mock('serialport', () => {
    const SerialPortMock = vi.fn().mockImplementation(() => ({
        pipe: vi.fn().mockReturnThis(),
        on: vi.fn(),
        open: vi.fn((cb) => cb(null)),
        close: vi.fn((cb) => cb()),
        write: vi.fn(),
        isOpen: true
    }));
    return { SerialPort: SerialPortMock };
});

vi.mock('@serialport/parser-readline', () => {
    return {
        ReadlineParser: vi.fn().mockImplementation(() => ({
            on: vi.fn()
        }))
    };
});

describe('ArduinoUnoBackend', () => {
    let backend: ArduinoUnoBackend;

    beforeEach(() => {
        vi.clearAllMocks();
        backend = new ArduinoUnoBackend({ port: 'COM6' });
    });

    it('should connect to the specified port', async () => {
        await backend.connect();
        expect(SerialPort).toHaveBeenCalledWith(expect.objectContaining({
            path: 'COM6',
            baudRate: 115200
        }));
    });

    it('should send SET command when pins are pushed', async () => {
        await backend.connect();
        backend.setPins({
            nodeId: 'arduino-1',
            pins: { 'D13': 1 }
        });

        // Find the instance and check write call
        const mockInstance = vi.mocked(SerialPort).mock.results[0].value;
        expect(mockInstance.write).toHaveBeenCalledWith('SET D13 1\n');
    });

    it('should map LED0 to D13', async () => {
        await backend.connect();
        backend.setPins({
            nodeId: 'arduino-1',
            pins: { 'LED0': 1 }
        });

        const mockInstance = vi.mocked(SerialPort).mock.results[0].value;
        expect(mockInstance.write).toHaveBeenCalledWith('SET D13 1\n');
    });

    it('should request updates with GET', async () => {
        await backend.connect();
        backend.getPins();

        const mockInstance = vi.mocked(SerialPort).mock.results[0].value;
        expect(mockInstance.write).toHaveBeenCalledWith('GET\n');
    });
});
