import type { RBProject } from '../../../export/projectFormat';
import { compareCodepoint } from '../../../export/codepointSort';
import { parseVhdl } from '../../../import/vhdlImport';
import { extractXdcPortNames } from './portLint';

export type PreservedImportHandoff = {
  topVhd: string;
  topXdc: string;
  companions: { sourcePath: string; exportPath: string; content: string }[];
};

/**
 * Build a stable artifact path under `imported/` for a companion VHDL file from an import ZIP.
 */
export function companionArtifactPathFromSourcePath(sourcePath: string): string {
  const segments = sourcePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '_'));
  while (segments[0]?.toLowerCase() === 'imported') segments.shift();
  const rel = segments.join('/');
  return rel.length > 0 ? `imported/${rel}` : 'imported/unnamed.vhd';
}

function alignmentIssuesVhdlPortsToXdc(vhdlText: string, xdcText: string): string[] {
  const parsed = parseVhdl(vhdlText);
  const vhdlNames = new Set(parsed.ports.map((port) => port.name.toLowerCase()));
  const xdcPorts = extractXdcPortNames(xdcText);
  const xdcNameSet = new Set(xdcPorts.map((port) => port.toLowerCase()));
  const issues: string[] = [];

  for (const port of parsed.ports) {
    const key = port.name.toLowerCase();
    if (!xdcNameSet.has(key)) {
      issues.push(`VHDL port "${port.name}" has no matching [get_ports] entry in imported constraints.`);
    }
  }

  for (const xport of xdcPorts) {
    const key = xport.toLowerCase();
    if (!vhdlNames.has(key)) {
      issues.push(`XDC references port "${xport}" that is not present on the imported top entity (parsed port list).`);
    }
  }

  return issues;
}

/**
 * When a project was imported as multi-file VHDL and still carries the original XDC text,
 * RedByte can export the preserved RTL + constraints instead of emitting only a netlist stub top.
 * Returns null when handoff requirements are not met or when HDL/XDC port alignment fails.
 */
export function tryBuildPreservedImportHandoff(
  project: RBProject,
  projectedXdcText?: string,
): PreservedImportHandoff | null {
  const tags = project.meta?.tags ?? [];
  if (!tags.includes('multi-file-hdl')) return null;
  if (project.meta?.projectKind !== 'import') return null;

  const topName = (project.hdl?.top ?? project.fpga?.top ?? '').trim();
  if (!topName) return null;

  const sources = project.hdl?.sources ?? [];
  const topSource = sources.find((source) => {
    if (source.language !== 'vhdl' || !source.text?.trim()) return false;
    const parsed = parseVhdl(source.text);
    return parsed.entityName.toLowerCase() === topName.toLowerCase();
  });
  if (!topSource) return null;

  const xdcText =
    project.fpga?.constraints?.type === 'xdc' ? (project.fpga.constraints.text ?? '').trim() : '';
  if (!xdcText) return null;

  const handoffXdc = projectedXdcText?.trim() || xdcText;
  const alignment = alignmentIssuesVhdlPortsToXdc(topSource.text, handoffXdc);
  if (alignment.length > 0) return null;

  const companions = sources
    .filter((source) => source !== topSource && source.language === 'vhdl' && source.text?.trim())
    .slice()
    .sort((left, right) => compareCodepoint(left.path, right.path))
    .map((source) => ({
      sourcePath: source.path,
      exportPath: companionArtifactPathFromSourcePath(source.path),
      content: source.text,
    }));

  return {
    topVhd: topSource.text,
    topXdc: handoffXdc,
    companions,
  };
}
