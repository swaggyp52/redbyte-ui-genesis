import { expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { buildGeometryIndex } from '../symbols/portGeometry';
import { routeCircuit } from '../routing/orthogonalRouter';
import { placeSchematicLabels } from '../symbols/schematicLabels';

it('moves a full primitive name away from a crossing net without changing positions, routes or junctions', () => {
  const circuit: Circuit = { nodes: [
    {id:'source',type:'INPUT',position:{x:0,y:148}},
    {id:'gate',type:'AND',label:'carry_ab',position:{x:200,y:180}},
    {id:'target',type:'OUTPUT',position:{x:400,y:148}},
  ], connections:[{from:{nodeId:'source',portName:'out'},to:{nodeId:'target',portName:'in'}}] };
  const original = JSON.stringify(circuit);
  const geometry = buildGeometryIndex(circuit.nodes);
  const nets = routeCircuit(circuit, geometry);
  const route = JSON.stringify(nets);
  const name = placeSchematicLabels(geometry, nets).get('gate')!;
  const points = nets[0].wires[0].points;
  const crosses = points.slice(1).some((b,i) => {
    const a = points[i];
    return Math.min(a.x,b.x) < name.bounds.maxX && Math.max(a.x,b.x) > name.bounds.minX &&
      Math.min(a.y,b.y) - 2 < name.bounds.maxY && Math.max(a.y,b.y) + 2 > name.bounds.minY;
  });
  expect(crosses).toBe(false);
  expect(name.bounds.maxX - name.bounds.minX).toBeGreaterThan(60);
  expect(JSON.stringify(circuit)).toBe(original);
  expect(JSON.stringify(nets)).toBe(route);
  expect(placeSchematicLabels(geometry,nets)).toEqual(placeSchematicLabels(geometry,nets));
});
