// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Netlist } from './netlistExport';

const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_]/g, '_');

export const verilogFromNetlist = (netlist: Netlist) => {
  const sortedNodes = [...netlist.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const sortedNets = [...netlist.nets].sort((a, b) => a.id.localeCompare(b.id));
  const uniqueTypes = Array.from(new Set(sortedNodes.map((node) => node.type))).sort();

  const lines: string[] = [];
  lines.push('// RedByte structural export (best-effort)');
  lines.push('module top();');
  lines.push('');

  sortedNets.forEach((net) => {
    const wireName = `w_${sanitize(net.from.nodeId)}_${sanitize(net.from.port)}__${sanitize(net.to.nodeId)}_${sanitize(net.to.port)}`;
    lines.push(`  wire ${wireName};`);
  });

  lines.push('');
  sortedNodes.forEach((node) => {
    const instanceName = `u_${sanitize(node.id)}`;
    const portList = node.ports
      .map((port) => {
        const net = sortedNets.find(
          (candidate) =>
            (candidate.from.nodeId === node.id && candidate.from.port === port.name) ||
            (candidate.to.nodeId === node.id && candidate.to.port === port.name)
        );
        if (!net) {
          return `.${sanitize(port.name)}()`;
        }
        const wireName = `w_${sanitize(net.from.nodeId)}_${sanitize(net.from.port)}__${sanitize(net.to.nodeId)}_${sanitize(net.to.port)}`;
        return `.${sanitize(port.name)}(${wireName})`;
      })
      .join(', ');
    lines.push(`  ${sanitize(node.type)} ${instanceName} (${portList});`);
  });

  lines.push('');
  uniqueTypes.forEach((type) => {
    lines.push(`// Unresolved component type: ${type}`);
    lines.push(`module ${sanitize(type)}(/* ports */);`);
    lines.push('endmodule');
    lines.push('');
  });

  lines.push('endmodule');
  return lines.join('\n');
};
