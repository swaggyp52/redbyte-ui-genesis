// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export { Logic3DScene } from './Logic3DScene';
export { use3DEngineSync } from './hooks/use3DEngineSync';
export { NodeMesh } from './meshes/NodeMesh';
export { WireMesh } from './meshes/WireMesh';
export { createNeonMaterial, NODE_COLORS } from './materials/neonMaterial';

// New Architecture Exports
export { Rb3DViewport } from './components/Rb3DViewport';
export { Rb3DSceneCircuit } from './components/Rb3DSceneCircuit';
export { Rb3DSceneBoard } from './components/Rb3DSceneBoard';
export { Lab3DScene } from './Lab3DScene';
export type { LabGraph, LabNode, LabWire, LabPin } from './lab-model/types';
export * from './lab-model/store';
export * from './lab-model/parts';
export * from './lab-model/validators';
export * from './lab-model/labTemplate';
export * from './lab-model/labEvaluator';
export * from './lab-model/netlist';
export * from './lab-model/sketchEngine';
export { TransportRouter } from './lab-model/transport/transport-router';
export { BridgeTransport } from './lab-model/transport/bridge-transport';
export { Rb3DSceneLab } from './components/Rb3DSceneLab';
