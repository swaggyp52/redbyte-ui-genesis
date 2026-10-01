import type JSZip from '../packages/rb-apps/node_modules/jszip/index';

/** Same serialized inputs accepted by the actual JSZip.loadAsync call. */
export type SubmissionBundleInput = Parameters<JSZip['loadAsync']>[0];
export interface SubmissionBundleVerification {
  ok: boolean;
  issues: string[];
}
export interface SubmissionBundleFileVerification extends SubmissionBundleVerification {
  /** Absolute path resolved by verifyBundleFile before reading. */
  filePath: string;
}
export function verifyBundleBytes(bytes: SubmissionBundleInput): Promise<SubmissionBundleVerification>;
export function verifyBundleFile(filePath: string): Promise<SubmissionBundleFileVerification>;
