// Grading export utility for Evidence Viewer
import { downloadBlob } from './bundleExport';
import type { GradingNotes } from '../stores/gradingNotesStore';

export interface GradingExport {
  evidenceHash: string;
  exportedAtIso: string;
  score?: number;
  passFail?: boolean;
  notes?: string;
  initials: string;
}

export function exportGradingNotes({ grading, evidenceHash }: { grading: GradingNotes; evidenceHash: string }) {
  if ((!grading.score && !grading.passFail && !grading.notes) || !grading.initials.trim()) {
    throw new Error('TA initials are required if grading fields are filled.');
  }
  const exportedAtIso = new Date().toISOString();
  const gradingExport: GradingExport = {
    evidenceHash,
    exportedAtIso,
    score: grading.score,
    passFail: grading.passFail,
    notes: grading.notes,
    initials: grading.initials.trim(),
  };
  const json = JSON.stringify(gradingExport, null, 2);
  const filename = `grading-${evidenceHash.slice(0, 8)}-${exportedAtIso.replace(/[:.]/g, '').replace(/[-T]/g, '').slice(0,15)}.json`;
  downloadBlob(new Blob([json], { type: 'application/json' }), filename);
}
