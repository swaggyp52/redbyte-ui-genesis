import { resolveIoMappingFromProjectFields, type IoMapping } from '@redbyte/rb-utils';
import type { RBProject } from '../../../export/projectFormat';

/**
 * The mapping every artifact of a Basys3 package is built from (top.vhd, top.xdc, the
 * testbench, the pin checks): the structured V2 document when the project carries one, else
 * the legacy ioMapping, without the rows whose node is no longer in the circuit.
 *
 * Such a row binds nothing. An entity port and XDC pin for it would drive a board pin from
 * logic that does not exist: a deleted LED used to stay declared, tied to '0' and pinned,
 * while the Export pin table already hid the row. Output rows may name a logic node as well
 * as a boundary node, so any node of the circuit keeps its row.
 */
export function resolveExportIoMapping(project: RBProject): IoMapping | undefined {
  const mapping = resolveIoMappingFromProjectFields({
    ioMapping: project.ioMapping,
    hardwareMappingV2: project.hardwareMappingV2,
  });
  if (!mapping) return mapping;
  const live = new Set((project.circuit?.nodes ?? []).map((node) => node.id));
  return {
    ...mapping,
    inputs: mapping.inputs.filter((entry) => live.has(entry.nodeId)),
    outputs: mapping.outputs.filter((entry) => live.has(entry.nodeId)),
  };
}
