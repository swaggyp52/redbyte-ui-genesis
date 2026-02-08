import { describe, it, expect } from 'vitest';
import { evaluateNetRequirements, validateLabTemplate } from '../labTemplate';
import fs from 'fs';
import path from 'path';
const loadTemplate = (dirName) => {
    const filePath = path.resolve(process.cwd(), 'labs', dirName, 'lab.json');
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};
describe('LabTemplate validation', () => {
    it('accepts the sample templates', () => {
        const templates = [
            loadTemplate('virtual_lab_blink'),
            loadTemplate('virtual_lab_button_toggle'),
            loadTemplate('virtual_lab_serial_status')
        ];
        for (const template of templates) {
            const result = validateLabTemplate(template);
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        }
    });
    it('flags missing fields and invalid pins', () => {
        const invalidTemplate = {
            template_version: 'virtual-lab.v1',
            lab_id: '',
            lab_version: '',
            name: '',
            required_parts: [{ type: 'unknown-part', min: 1 }],
            required_nets: [
                {
                    id: 'net-1',
                    label: 'Bad net',
                    pins: [
                        { part: 'arduino-nano', pins: ['BADPIN'] },
                        { part: 'led-5mm', pins: ['anode'] }
                    ]
                }
            ]
        };
        const result = validateLabTemplate(invalidTemplate);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
    it('evaluates net requirements against a graph', () => {
        const template = loadTemplate('virtual_lab_blink');
        const graph = {
            nodes: [
                {
                    id: 'nano-1',
                    type: 'arduino-nano',
                    pose: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
                    properties: {}
                },
                {
                    id: 'led-1',
                    type: 'led-5mm',
                    pose: { position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
                    properties: {}
                }
            ],
            wires: [
                {
                    id: 'w-1',
                    sourceNodeId: 'nano-1',
                    sourcePinId: 'D13',
                    targetNodeId: 'led-1',
                    targetPinId: 'anode',
                    color: 'green'
                },
                {
                    id: 'w-2',
                    sourceNodeId: 'nano-1',
                    sourcePinId: 'GND',
                    targetNodeId: 'led-1',
                    targetPinId: 'cathode',
                    color: 'green'
                }
            ],
            net: {}
        };
        const result = evaluateNetRequirements(graph, template);
        expect(result.allSatisfied).toBe(true);
        expect(result.results.every((entry) => entry.satisfied)).toBe(true);
    });
});
