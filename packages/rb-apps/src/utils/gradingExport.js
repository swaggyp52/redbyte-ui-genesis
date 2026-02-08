// Grading export utility for Evidence Viewer
import { downloadBlob } from './bundleExport';
export function exportGradingNotes({ grading, evidenceHash }) {
    if ((!grading.score && !grading.passFail && !grading.notes) || !grading.initials.trim()) {
        throw new Error('TA initials are required if grading fields are filled.');
    }
    const exportedAtIso = new Date().toISOString();
    const gradingExport = {
        evidenceHash,
        exportedAtIso,
        score: grading.score,
        passFail: grading.passFail,
        notes: grading.notes,
        initials: grading.initials.trim(),
    };
    const json = JSON.stringify(gradingExport, null, 2);
    const filename = `grading-${evidenceHash.slice(0, 8)}-${exportedAtIso.replace(/[:.]/g, '').replace(/[-T]/g, '').slice(0, 15)}.json`;
    downloadBlob(new Blob([json], { type: 'application/json' }), filename);
}
