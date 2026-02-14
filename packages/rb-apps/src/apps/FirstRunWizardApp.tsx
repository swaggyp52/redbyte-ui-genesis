import React, { useCallback, useMemo, useState } from 'react';
import type { RedByteApp } from '../types';
import { stableStringify } from '../export/stableStringify';
import { getToolchainBackend, getToolchainBackendId } from '../fpga/toolchainBackend';
import { buildDoctorReportV2, type DoctorReportV2 } from '../fpga/doctorReportV2';
import {
  getHardwareRemediation,
  mapHardwareErrorCode,
  type HardwareErrorCode,
} from '../fpga/hardwareErrorTaxonomy';
import {
  FIRST_RUN_KNOWN_GOOD_BITSTREAM_KEY,
  appendStepLog,
  createInitialFirstRunState,
  loadFirstRunState,
  markStepFail,
  markStepPass,
  markStepRunning,
  markWizardComplete,
  saveFirstRunState,
  type FirstRunState,
  type FirstRunStepId,
} from './firstRun/firstRunState';
import { FIRST_RUN_STEPS, getCurrentWizardStepId, getNextStepId } from './firstRun/firstRunChecklist';
import styles from './FirstRunWizardApp.module.css';

const BRIDGE_URL = 'http://127.0.0.1:4242';
const CAPTURE_WAIT_MS = 1200;

interface FirstRunWizardComponentProps {
  onOpenApp?: (appId: string, props?: Record<string, unknown>) => void;
}

interface WizardRunContext {
  runId: string | null;
  doctorReport: DoctorReportV2 | null;
}

function readEnvValue(name: string): string | null {
  try {
    const processEnv = (process as { env?: Record<string, string | undefined> }).env;
    const value = processEnv?.[name];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  } catch {
    // ignore
  }
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    const value = env?.[`VITE_${name}`];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  } catch {
    // ignore
  }
  return null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([stableStringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const FirstRunWizardComponent: React.FC<FirstRunWizardComponentProps> = ({ onOpenApp }) => {
  const [wizardState, setWizardState] = useState<FirstRunState>(() => loadFirstRunState());
  const [context, setContext] = useState<WizardRunContext>({ runId: null, doctorReport: null });
  const [isRunning, setIsRunning] = useState(false);
  const backend = useMemo(() => getToolchainBackend(getToolchainBackendId()), []);

  const currentStepId = useMemo(() => getCurrentWizardStepId(wizardState.steps), [wizardState.steps]);
  const currentStepMeta = useMemo(
    () => FIRST_RUN_STEPS.find((step) => step.id === currentStepId) ?? FIRST_RUN_STEPS[0],
    [currentStepId],
  );

  const commitState = useCallback((next: FirstRunState) => {
    setWizardState(next);
    saveFirstRunState(next);
  }, []);

  const runStep = useCallback(
    async (stepId: FirstRunStepId) => {
      if (stepId === 'done') {
        const doneState = markWizardComplete(wizardState);
        commitState(doneState);
        onOpenApp?.('lab-workspace');
        return;
      }

      setIsRunning(true);
      let nextState = markStepRunning(wizardState, stepId);
      nextState = appendStepLog(nextState, stepId, `[${stepId}] started`);
      commitState(nextState);

      try {
        if (stepId === 'bridge_check') {
          const healthRes = await fetch(`${BRIDGE_URL}/health`, { signal: AbortSignal.timeout(3000) });
          if (!healthRes.ok) throw new Error('bridge_offline');
          const payload = (await healthRes.json()) as { ok?: boolean; version?: string };
          if (payload.ok !== true) throw new Error('bridge_offline');
          nextState = appendStepLog(nextState, stepId, `[bridge] ok${payload.version ? ` version=${payload.version}` : ''}`);
        }

        if (stepId === 'board_detect') {
          const result = await backend.detectBoards();
          if (!result.ok || result.boards.length === 0) throw new Error('board_missing');
          nextState = appendStepLog(nextState, stepId, `[detect] boards=${result.boards.length}`);
        }

        if (stepId === 'programmer_check') {
          const result = await backend.detectBoards();
          if (!result.tools.openFPGALoader.ok) {
            throw new Error(result.tools.openFPGALoader.error || 'program_failed');
          }
          nextState = appendStepLog(
            nextState,
            stepId,
            `[programmer] openFPGALoader ${result.tools.openFPGALoader.version ?? 'detected'}`,
          );
        }

        if (stepId === 'known_good_program') {
          const knownGoodBitstream =
            localStorage.getItem(FIRST_RUN_KNOWN_GOOD_BITSTREAM_KEY)
            || readEnvValue('RB_KNOWN_GOOD_BITSTREAM_BASE64');
          if (!knownGoodBitstream) {
            throw new Error('bitstream_missing');
          }

          const start = Date.now();
          const programResult = await backend.programBitstream({
            board: 'basys3',
            mode: 'sram',
            bitstream: { kind: 'base64', data: knownGoodBitstream },
          });
          setContext((prev) => ({ ...prev, runId: programResult.runId }));

          let done = programResult.state !== 'running';
          let status = programResult;
          let safety = 0;
          while (!done && safety < 30) {
            await wait(400);
            const polled = await backend.getRunStatus(programResult.runId, status.nextOffset ?? 0);
            status = {
              ...status,
              state: polled.state,
              error: polled.error,
              nextOffset: polled.nextOffset,
            };
            done = polled.state !== 'running';
            safety += 1;
          }

          if (status.state === 'running') throw new Error('program_failed');
          if (status.state !== 'done') throw new Error(status.error || 'program_failed');
          nextState = appendStepLog(nextState, stepId, `[program] ok durationMs=${Date.now() - start}`);
        }

        if (stepId === 'sample_capture') {
          const detectResult = await backend.detectBoards();
          const board = detectResult.boards[0];
          if (!board) throw new Error('board_missing');

          const runRes = await fetch(`${BRIDGE_URL}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_id: board.type,
              hz: 20,
              mode: 'hardware',
            }),
          });
          const runJson = (await runRes.json()) as { ok?: boolean; run_id?: string; error?: string };
          if (!runRes.ok || runJson.ok !== true || !runJson.run_id) {
            throw new Error(runJson.error || 'program_failed');
          }
          const captureRunId = runJson.run_id;
          await wait(CAPTURE_WAIT_MS);
          await fetch(`${BRIDGE_URL}/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ run_id: captureRunId }),
          });
          setContext((prev) => ({ ...prev, runId: captureRunId }));
          nextState = appendStepLog(nextState, stepId, `[capture] run_id=${captureRunId}`);
        }

        if (stepId === 'doctor_export') {
          const report = await backend.doctorReportV2();
          setContext((prev) => ({ ...prev, doctorReport: report }));
          nextState = appendStepLog(nextState, stepId, '[doctor] report ready');
        }

        nextState = markStepPass(nextState, stepId);
        const nextStep = getNextStepId(stepId);
        nextState = {
          ...nextState,
          lastStep: nextStep,
          lastRunId: context.runId,
        };
        if (nextStep === 'done') {
          nextState = markWizardComplete(nextState);
        }
        commitState(nextState);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const mapped = mapHardwareErrorCode(message);
        const code = mapped ?? 'program_failed';
        const withLog = appendStepLog(nextState, stepId, `[${stepId}] failed: ${code}`);
        commitState(markStepFail(withLog, stepId, code));
      } finally {
        setIsRunning(false);
      }
    },
    [backend, commitState, context.runId, onOpenApp, wizardState],
  );

  const activeStepState = wizardState.steps[currentStepId];
  const activeErrorCode = activeStepState.errorCode;
  const activeRemediation = activeErrorCode
    ? getHardwareRemediation(activeErrorCode as HardwareErrorCode)
    : null;

  const handleExportDoctor = useCallback(() => {
    if (!context.doctorReport) return;
    downloadJson(`rb-doctor-report-v2-${Date.now()}.json`, context.doctorReport);
  }, [context.doctorReport]);

  return (
    <div className={styles.root} data-testid="first-run-wizard-root">
      <div className={styles.header}>
        <div className={styles.title}>First Run Wizard</div>
        <div className={styles.subtitle}>Bridge → Detect → Program Known-Good → Capture → Export Doctor → Done</div>
      </div>

      <div className={styles.content}>
        <div className={styles.stepper} data-testid="first-run-stepper">
          {FIRST_RUN_STEPS.map((step) => {
            const status = wizardState.steps[step.id]?.status ?? 'pending';
            const isActive = step.id === currentStepId;
            return (
              <div key={step.id} className={`${styles.stepRow} ${isActive ? styles.stepActive : ''}`}>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepStatus} data-testid={`first-run-step-status-${step.id}`}>
                  {status}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}>{currentStepMeta.title}</div>
          <div className={styles.panelDesc}>{currentStepMeta.description}</div>

          {activeErrorCode && (
            <div className={styles.failure}>
              <div><strong>errorCode:</strong> {activeErrorCode}</div>
              <div>{activeRemediation?.action ?? currentStepMeta.fixAction}</div>
            </div>
          )}

          {wizardState.completedAt && <div className={styles.done}>Wizard complete. Studio is unlocked.</div>}

          <div className={styles.logs}>{activeStepState.logs.join('\n') || 'No logs yet.'}</div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryCta}
              data-testid="first-run-primary-cta"
              onClick={() => void runStep(currentStepId)}
              disabled={isRunning || currentStepId === 'done'}
            >
              {isRunning ? 'Running...' : 'Run step'}
            </button>
            <button
              type="button"
              className={styles.secondaryCta}
              data-testid="first-run-export-doctor"
              onClick={handleExportDoctor}
              disabled={!context.doctorReport}
            >
              Export Doctor Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FirstRunWizardApp: RedByteApp = {
  manifest: {
    id: 'first-run-wizard',
    name: 'First Run Wizard',
    iconId: 'shield',
    category: 'system',
    singleton: true,
    hidden: true,
    defaultSize: { width: 980, height: 680 },
  },
  component: FirstRunWizardComponent,
};
