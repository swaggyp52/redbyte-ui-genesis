import { compareCodepoint } from '../../../export/codepointSort';

export type Basys3BoardId = 'basys3';

export type Basys3OptionalResetPolarity = 'active_high';

export interface Basys3PortBundleContract {
  base: string;
  width: number;
  direction: 'input' | 'output';
  required: boolean;
}

export interface Basys3TopModuleContract {
  board: Basys3BoardId;
  topModule: string;
  clock: { name: string; frequencyHz: number };
  optionalReset: { name: string; polarity: Basys3OptionalResetPolarity };
  bundles: Basys3PortBundleContract[];
  scalarPorts: Array<{ name: string; direction: 'input' | 'output'; required: boolean }>;
  buttonIndexMap: Array<{ index: number; alias: string }>;
}

export const basys3TopModuleContract: Basys3TopModuleContract = {
  board: 'basys3',
  topModule: 'top',
  clock: { name: 'clk', frequencyHz: 100_000_000 },
  optionalReset: { name: 'rst', polarity: 'active_high' },
  bundles: [
    { base: 'sw', width: 16, direction: 'input', required: true },
    { base: 'btn', width: 5, direction: 'input', required: true },
    { base: 'led', width: 16, direction: 'output', required: true },
    { base: 'seg', width: 7, direction: 'output', required: true },
    { base: 'an', width: 4, direction: 'output', required: true },
  ],
  scalarPorts: [
    { name: 'clk', direction: 'input', required: true },
    { name: 'dp', direction: 'output', required: true },
    { name: 'rst', direction: 'input', required: false },
  ],
  buttonIndexMap: [
    { index: 0, alias: 'btnC' },
    { index: 1, alias: 'btnU' },
    { index: 2, alias: 'btnL' },
    { index: 3, alias: 'btnR' },
    { index: 4, alias: 'btnD' },
  ],
};

function expandBundle(base: string, width: number): string[] {
  return Array.from({ length: width }, (_, index) => `${base}[${index}]`);
}

export const basys3CanonicalPortNames = [
  ...basys3TopModuleContract.scalarPorts.map((port) => port.name),
  ...basys3TopModuleContract.bundles.flatMap((bundle) => expandBundle(bundle.base, bundle.width)),
].sort((a, b) => compareCodepoint(a, b));

const basys3CanonicalPortNameSet = new Set(basys3CanonicalPortNames);

export function isBasys3CanonicalPortName(portName: string): boolean {
  return basys3CanonicalPortNameSet.has(portName);
}

