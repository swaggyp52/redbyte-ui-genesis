// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export async function verifyCheckpoint(project, checkpoint) {
    switch (checkpoint.type) {
        case 'truth-table': {
            const { verifyTruthTable } = await import('./verifyTruthTable');
            return verifyTruthTable(project, checkpoint);
        }
        case 'waveform': {
            const { verifyWaveform } = await import('./verifyWaveform');
            return verifyWaveform(project, checkpoint);
        }
        case 'test-vector': {
            const { verifyTestVector } = await import('./verifyTestVector');
            return verifyTestVector(project, checkpoint);
        }
        case 'board-io': {
            const { verifyBoardIO } = await import('./verifyBoardIO');
            return verifyBoardIO(project, checkpoint);
        }
        case 'custom': {
            // Custom verifiers registered by lab ID
            const { verifyCustom } = await import('./verifyCustom');
            return verifyCustom(project, checkpoint);
        }
        default:
            const _exhaustive = checkpoint;
            throw new Error(`Unknown checkpoint type: ${checkpoint.type}`);
    }
}
