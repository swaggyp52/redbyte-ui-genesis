import { create } from 'zustand';
import type { WorkbenchDocument } from './workbenchDocuments';

/**
 * Workbench navigation — the "shell records, owner applies" seam through which
 * any surface can ask the document host to open an engineering document
 * (Open cases, Open waveform, Open board mapping…). The document host owner
 * (IdeApp) registers its opener once; nothing here stores documents or state.
 */
interface WorkbenchNavigationState {
  openDocument: ((doc: WorkbenchDocument) => void) | null;
  register: (opener: ((doc: WorkbenchDocument) => void) | null) => void;
}

export const useWorkbenchNavigation = create<WorkbenchNavigationState>((set) => ({
  openDocument: null,
  register: (opener) => set({ openDocument: opener }),
}));

/** Open a document through the registered host; returns false when no host is registered. */
export function openWorkbenchDocument(doc: WorkbenchDocument): boolean {
  const opener = useWorkbenchNavigation.getState().openDocument;
  if (!opener) return false;
  opener(doc);
  return true;
}
