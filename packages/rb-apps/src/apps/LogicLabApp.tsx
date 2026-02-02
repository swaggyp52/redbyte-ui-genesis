// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// LogicLabApp.tsx: Main entry point for the Lab App overhaul.

import React, { Suspense, useCallback } from 'react';
import { toast } from '@redbyte/rb-primitives';
import { GuidedLabShell } from '../components/GuidedLabShell';
import { LabSelectionScreen } from '../components/LabSelectionScreen';
import { LabSpecificationView } from '../labs/LabSpecificationView';
import { useLabWorkflowStore } from '../stores/useLabWorkflowStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useHardwareSessionStore } from '../stores/hardwareSessionStore';
import { exportV2Bundle, downloadBlob } from '../utils/bundleExport';

// Lazy load heavy components
const DesignMode = React.lazy(() => import('../components/DesignMode').then(m => ({ default: m.DesignMode })));
const SelfCheckVectorsTable = React.lazy(() => import('../components/SelfCheckVectorsTable').then(m => ({ default: m.SelfCheckVectorsTable })));

interface LogicLabAppProps {
  windowId: string;
}

/**
 * LogicLabApp (RedByte OS Genesis)
 * This app implements the 7-step guided lab workflow.
 * It uses Tailwind CSS for a responsive, modern laboratory experience.
 */
const LogicLabApp: React.FC<LogicLabAppProps> = ({ windowId }) => {
  const { currentStep, setStep, studentIdentity, selectedLabId } = useLabWorkflowStore();

  const handleUpload = useCallback(async () => {
    try {
      toast.info({ message: 'Initializing hardware bridge auto-adopt...' });
      await useHardwareSessionStore.getState().autoAdopt();
      toast.success({ message: 'Board connected. Uploading bitstream...' });
      setStep('verification');
    } catch (err) {
      toast.error({ message: `Hardware Error: ${err instanceof Error ? err.message : 'Unknown'}` });
    }
  }, [setStep]);

  const handleExport = useCallback(async () => {
    if (!studentIdentity || !selectedLabId) return;

    try {
      toast.info({ message: 'Generating secure evidence capsule...' });
      const result = await exportV2Bundle({
        labId: selectedLabId,
        studentId: studentIdentity.id,
      });

      if (result.blob) {
        downloadBlob(result.blob, `redbyte-submission-${selectedLabId}-${studentIdentity.id}.zip`);
        toast.success({ message: 'Submission bundle exported successfully!' });
      }
    } catch (err) {
      toast.error({ message: `Export Failed: ${err instanceof Error ? err.message : 'Unknown'}` });
    }
  }, [selectedLabId, studentIdentity]);

  const renderContent = () => {
    switch (currentStep) {
      case 'selection':
        return <LabSelectionScreen />;
      case 'specification':
        return <LabSpecificationView />;
      case 'design':
        return (
          <Suspense fallback={<div className="p-8 text-slate-400">Loading Design Mode...</div>}>
            <DesignMode />
          </Suspense>
        );
      case 'simulation':
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
            <div className="text-4xl">🔬</div>
            <p className="text-xl">Logic Simulation Environment</p>
            <p className="max-w-md text-center text-sm">
              In Phase 3, this will integrate with rb-logic-view's 3D engine for full behavioral verification.
            </p>
          </div>
        );
      case 'hardware':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="w-24 h-24 bg-indigo-600/20 rounded-full flex items-center justify-center animate-pulse">
              <div className="w-12 h-12 text-indigo-400">⚡</div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Ready to Upload</h2>
              <p className="text-slate-400">Program the Basys3 board with your design.</p>
            </div>
            <button
              onClick={handleUpload}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/20"
            >
              Upload Bitstream
            </button>
          </div>
        );
      case 'verification':
        return (
          <Suspense fallback={<div className="p-8 text-slate-400">Loading Verification Table...</div>}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-6">Hardware Self-Check</h3>
              <SelfCheckVectorsTable
                results={[]}
              />
            </div>
          </Suspense>
        );
      case 'report':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="w-24 h-24 bg-emerald-600/20 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 text-emerald-400">📄</div>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Lab Complete</h2>
              <p className="text-slate-400">All checkpoints passed. You can now export your submission package.</p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={handleExport}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20"
              >
                Export Submission (.rb-lab.zip)
              </button>
            </div>
          </div>
        );
      default:
        return <div>Select a lab to begin.</div>;
    }
  };

  return (
    <ErrorBoundary>
      <GuidedLabShell>
        {renderContent()}
      </GuidedLabShell>
    </ErrorBoundary>
  );
};

export default LogicLabApp;
