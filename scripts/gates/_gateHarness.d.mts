import type { Locator, Page } from 'playwright';

export interface StarterProjectOptions {
  preferredLabStarterTestId?: string;
  exactExampleId?: string;
}
export interface IdeGateScenarioContext {
  page: Page;
  /** Resolved current IDE root, including /os when the preview owns that path. */
  baseUrl: string;
}
export type IdeGateScenario = (context: IdeGateScenarioContext) => void | Promise<void>;

export function assert(condition: unknown, message: string): asserts condition;
export function visible(locator: Locator): Promise<boolean>;
export function openDesignBoardPalette(page: Page): Promise<void>;
export function designInputIds(page: Page): Promise<string[]>;
export function selectDesignInput(page: Page, nodeId: string): Promise<Locator>;
export function assertBuildFreshReplacementDialog(message: string, label?: string): void;
export function assertBuildFreshReplacementModal(page: Page, label?: string): Promise<void>;
export function loadStarterProject(page: Page, options?: StarterProjectOptions): Promise<void>;
export function ensureVerifyVectorsReady(page: Page): Promise<'existing' | 'generated'>;
export function clickVerifyRun(page: Page): Promise<string>;
export function setVerifyRunMode(page: Page, mode: 'compare' | 'observe'): Promise<boolean>;
export function saveObservedOutputs(page: Page): Promise<string | null>;
/** Owns preview/browser cleanup and sets process.exitCode on scenario failure. */
export function runIdeGate(name: string, runScenario: IdeGateScenario): Promise<void>;
