// Store for evidence viewer state and verification
import { create } from 'zustand';
export const useEvidenceViewerStore = create((set) => ({
    evidenceBundle: null,
    verificationStatus: 'UNVERIFIED',
    errorMessage: undefined,
    setEvidence: (bundle, status, errorMessage) => set({ evidenceBundle: bundle, verificationStatus: status, errorMessage }),
    clearEvidence: () => set({ evidenceBundle: null, verificationStatus: 'UNVERIFIED', errorMessage: undefined }),
}));
