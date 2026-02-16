import type { ToolchainProjectInput } from '../../toolchainBackend';
import { compareCodepoint } from '../../../export/codepointSort';
import { basys3TopModuleContract } from './basys3Contract';

export interface Basys3PortLintResult {
  topModule: string;
  verilogModuleFound: boolean;
  hdlPorts: string[];
  xdcPorts: string[];
  missingInHdl: string[];
  missingInXdc: string[];
  missingContractPorts: string[];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => compareCodepoint(a, b));
}

function expandPortRange(name: string, range: string | null): string[] {
  if (!range) return [name];
  const match = range.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
  if (!match) return [name];
  const left = Number.parseInt(match[1], 10);
  const right = Number.parseInt(match[2], 10);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return [name];
  const low = Math.min(left, right);
  const high = Math.max(left, right);
  const ports: string[] = [];
  for (let index = low; index <= high; index += 1) {
    ports.push(`${name}[${index}]`);
  }
  return ports;
}

function stripVerilogComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractVerilogTopPorts(project: ToolchainProjectInput, topModule: string): { found: boolean; ports: string[] } {
  const verilogSources = (project.sources ?? [])
    .filter((source) => source.language === 'verilog')
    .slice()
    .sort((a, b) => compareCodepoint(a.path, b.path));

  const modulePattern = new RegExp(`module\\s+${escapeRegExp(topModule)}\\s*\\(([^;]*?)\\)\\s*;`, 'ms');
  const ports: string[] = [];
  let found = false;

  for (const source of verilogSources) {
    const sanitizedText = stripVerilogComments(source.text ?? '');
    const match = sanitizedText.match(modulePattern);
    if (!match) continue;
    found = true;
    const portBlock = match[1] ?? '';
    const tokens = portBlock
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean);

    for (const tokenRaw of tokens) {
      let token = tokenRaw.split('=')[0]?.trim() ?? '';
      token = token.replace(/\b(input|output|inout|wire|reg|logic|signed|unsigned)\b/g, ' ').trim();
      if (!token) continue;

      const matchPort = token.match(/^(?:\[\s*\d+\s*:\s*\d+\s*\]\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*\[\s*\d+\s*:\s*\d+\s*\])?$/);
      if (!matchPort) continue;

      const name = matchPort[1];
      const leadingRange = token.match(/^(\[\s*\d+\s*:\s*\d+\s*\])/)?.[1] ?? null;
      const trailingRange = token.match(/\[\s*\d+\s*:\s*\d+\s*\]$/)?.[0] ?? null;
      const range = leadingRange ?? trailingRange;
      ports.push(...expandPortRange(name, range));
    }
    break;
  }

  return { found, ports: uniqueSorted(ports) };
}

export function extractXdcPortNames(xdcText: string): string[] {
  const ports: string[] = [];
  const pattern = /\[\s*get_ports\s+(?:\{([^}]+)\}|([^\]\s]+))\s*\]/g;
  let match: RegExpExecArray | null = pattern.exec(xdcText);
  while (match) {
    const rawName = (match[1] ?? match[2] ?? '').trim();
    if (rawName) ports.push(rawName);
    match = pattern.exec(xdcText);
  }
  return uniqueSorted(ports);
}

function requiredContractPortNames(): string[] {
  const scalar = basys3TopModuleContract.scalarPorts
    .filter((port) => port.required)
    .map((port) => port.name);
  const bundle = basys3TopModuleContract.bundles
    .filter((group) => group.required)
    .flatMap((group) => Array.from({ length: group.width }, (_, index) => `${group.base}[${index}]`));
  return uniqueSorted([...scalar, ...bundle]);
}

export function lintBasys3ProjectPorts(project: ToolchainProjectInput, xdcText: string): Basys3PortLintResult {
  const topModule = (project.top ?? basys3TopModuleContract.topModule).trim() || basys3TopModuleContract.topModule;
  const { found, ports: hdlPorts } = extractVerilogTopPorts(project, topModule);
  const xdcPorts = extractXdcPortNames(xdcText);
  const hdlPortSet = new Set(hdlPorts);
  const xdcPortSet = new Set(xdcPorts);
  const contractPorts = requiredContractPortNames();

  const missingInHdl = xdcPorts.filter((port) => !hdlPortSet.has(port));
  const missingInXdc = hdlPorts.filter((port) => !xdcPortSet.has(port));
  const missingContractPorts = contractPorts.filter((port) => !hdlPortSet.has(port));

  return {
    topModule,
    verilogModuleFound: found,
    hdlPorts,
    xdcPorts,
    missingInHdl,
    missingInXdc,
    missingContractPorts,
  };
}

