// Store for evidence viewer state and verification
import { create } from 'zustand';
import type { EvidenceBundle } from '../evidenceSchema';

export type VerificationStatus = 'PASS' | 'FAIL' | 'UNVERIFIED' | 'ERROR';

interface EvidenceViewerState {
  evidenceBundle: EvidenceBundle | null;
  verificationStatus: VerificationStatus;
  errorMessage?: string;
  setEvidence: (bundle: EvidenceBundle, status: VerificationStatus, errorMessage?: string) => void;
  clearEvidence: () => void;
}

export const useEvidenceViewerStore = create<EvidenceViewerState>((set) => ({
  evidenceBundle: null,
  verificationStatus: 'UNVERIFIED',
  errorMessage: undefined,
  setEvidence: (bundle, status, errorMessage) => set({ evidenceBundle: bundle, verificationStatus: status, errorMessage }),
  clearEvidence: () => set({ evidenceBundle: null, verificationStatus: 'UNVERIFIED', errorMessage: undefined }),
}));
