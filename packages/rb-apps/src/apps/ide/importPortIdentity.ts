import type { RBProject } from '../../export/projectFormat';
import type { ParsedHDL } from '../../import/hdlToCircuit';
import type { XdcParseResult } from '../../import/xdcImport';

type ImportMappingInspection = {
  importMode: 'manifest' | 'reconstructed';
  project: RBProject;
  parsedHdl: ParsedHDL;
  xdcResult?: XdcParseResult;
};

const HDL_SCALAR_OR_PROJECTED_BIT =
  /^[A-Za-z_][A-Za-z0-9_]*(?:\[(?:0|[1-9][0-9]*)\])?$/;

/**
 * Import parsers flatten HDL vectors into canonical bit identities such as
 * `SW[1]`. Keep the scalar identifier grammar strict while recognizing that
 * exact parser-owned projection form.
 */
export function isCanonicalImportPortIdentity(value: string): boolean {
  return HDL_SCALAR_OR_PROJECTED_BIT.test(value);
}

/**
 * Build the Review mapping without changing ZIP authority.
 *
 * Reconstructed imports retain their compiler-built project mapping. A
 * manifest restore may additionally project the manifest's own embedded XDC
 * onto the parser-expanded top ports. Loose sibling XDC files never reach this
 * branch because `zipImport` builds manifest inspections from
 * `project.fpga.constraints` only.
 */
export function buildZipInspectionMappingRecord(
  inspection: ImportMappingInspection,
): Record<string, string> {
  const rows = [
    ...(inspection.project.ioMapping?.inputs ?? []),
    ...(inspection.project.ioMapping?.outputs ?? []),
  ];
  const mapping: Record<string, string> = {};
  for (const row of rows) {
    const key = (row.label ?? row.id).trim() || row.id;
    mapping[key] = (row.pin ?? '').toUpperCase();
  }

  if (inspection.importMode !== 'manifest' || !inspection.xdcResult) {
    return mapping;
  }

  const manifestPinByPort = new Map<string, string>();
  for (const [portName, pin] of Object.entries(inspection.xdcResult.pinMap)) {
    manifestPinByPort.set(normalizePortIdentity(portName), pin.toUpperCase());
  }

  for (const port of inspection.parsedHdl.ports) {
    if (!isCanonicalImportPortIdentity(port.name)) continue;
    const pin = manifestPinByPort.get(normalizePortIdentity(port.name));
    if (pin) mapping[port.name] = pin;
  }

  return mapping;
}

function normalizePortIdentity(value: string): string {
  return value.trim().toLowerCase();
}
