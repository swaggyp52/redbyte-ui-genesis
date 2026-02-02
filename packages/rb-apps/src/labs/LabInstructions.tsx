// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import { useLabStore } from './labStore';
import { LABS } from './labContent';
import { useHardwareStore } from '../stores/hardwareStore';
import { getSignalMap } from './signalMap';
import { exportEvidenceCapsule } from '../utils/evidenceExport';
import { PanelLayout } from '../components/PanelLayout';

// Styled Markdown Renderer
const SimpleMarkdown: React.FC<{ content?: string }> = ({ content }) => {
    if (!content) return null;
    const lines = content.split('\n');
    return (
        <div className="space-y-3 text-sm font-sans">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />;

                if (trimmed.startsWith('# ')) {
                    return (
                        <h1 key={i} className="text-xl font-black text-white tracking-widest uppercase mb-6 pb-2 border-b-2 border-cyan-500/30">
                            {trimmed.slice(2)}
                        </h1>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <h2 key={i} className="text-sm font-bold text-cyan-400 tracking-wider mt-6 mb-3 uppercase">
                            {trimmed.slice(3)}
                        </h2>
                    );
                }

                if (trimmed.match(/^\d+\./)) {
                    return (
                        <div key={i} className="flex gap-3 ml-2 text-gray-300">
                            <span className="font-mono text-cyan-600 font-bold select-none">{trimmed.split(' ')[0]}</span>
                            <span className="flex-1 leading-relaxed">{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</span>
                        </div>
                    );
                }
                if (trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex gap-3 ml-4 text-gray-400">
                            <span className="text-cyan-800">•</span>
                            <span className="flex-1 leading-relaxed">{renderInline(trimmed.slice(2))}</span>
                        </div>
                    );
                }

                return (
                    <p key={i} className="text-gray-400 leading-relaxed">
                        {renderInline(trimmed)}
                    </p>
                );
            })}
        </div>
    );
};

function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-cyan-400 font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

// Checkpoint Verification Card
const CheckpointVerifier: React.FC<{ signal: string, expected: number, stepIndex: number }> = ({ signal, expected, stepIndex }) => {
    const ioSnapshot = useHardwareStore(s => s.ioSnapshot);
    const capabilities = useHardwareStore(s => s.capabilities);
    const markComplete = useLabStore(s => s.markComplete);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = () => {
        if (!ioSnapshot || !capabilities) {
            setError("HARDWARE DISCONNECTED");
            return;
        }

        const map = getSignalMap(capabilities.boardId);
        const loc = map[signal];
        if (!loc) {
            setError(`SIGNAL ${signal} NOT MAPPED`);
            return;
        }

        let observed = -1;
        if (loc.group === 'LED') {
            const val = typeof ioSnapshot.outputs.LED === 'number' ? ioSnapshot.outputs.LED : parseInt(String(ioSnapshot.outputs.LED), 2);
            observed = (val >> loc.bit) & 1;
        } else if (loc.group === 'SW') {
            const val = typeof ioSnapshot.inputs.SW === 'number' ? ioSnapshot.inputs.SW : parseInt(String(ioSnapshot.inputs.SW), 2);
            observed = (val >> loc.bit) & 1;
        }

        if (observed === expected) {
            markComplete(stepIndex);
            setError(null);
        } else {
            setError(`FAIL: EXPECTED ${expected}, OBSERVED ${observed}`);
        }
    };

    return (
        <div className="mt-4">
            <button
                type="button"
                onClick={handleVerify}
                className="w-full py-2 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-400 text-[10px] font-black tracking-widest rounded border border-cyan-500/30 transition-all active:scale-[0.98]"
            >
                EXECUTE VERIFICATION
            </button>
            {error && (
                <div className="mt-2 text-[9px] text-red-400 font-mono text-center uppercase tracking-tighter animate-pulse">
                    ⚠ {error}
                </div>
            )}
        </div>
    );
};

// Student Identity Card
const StudentIdentity: React.FC = () => {
    const { studentName, studentId, setStudentInfo } = useLabStore();

    return (
        <div className="p-4 bg-gray-950/50 border border-[#1a3a4a] rounded-lg mb-6 shadow-inner">
            <div className="text-[9px] font-black text-cyan-600 tracking-widest uppercase mb-3">STUDENT IDENTITY</div>
            <div className="space-y-3">
                <div className="flex flex-col gap-1">
                    <label className="text-[8px] text-gray-500 uppercase font-bold">Lab Member Name</label>
                    <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentInfo(e.target.value, studentId)}
                        className="bg-black/40 border border-[#1a2a3a] rounded px-2 py-1 text-xs text-cyan-300 outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="John Doe"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[8px] text-gray-500 uppercase font-bold">University ID / SSN Reference</label>
                    <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentInfo(studentName, e.target.value)}
                        className="bg-black/40 border border-[#1a2a3a] rounded px-2 py-1 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-500/50 transition-colors"
                        placeholder="E12345678"
                    />
                </div>
            </div>
        </div>
    );
};

export const LabInstructions: React.FC = () => {
    const { activeLabId, setActiveLab, currentStepIndex, completedSteps, nextStep, prevStep } = useLabStore();

    const labs = Object.keys(LABS);
    const rawContent = LABS[activeLabId] || LABS['lab-1'];

    // Normalize content
    const isLabDefinition = !Array.isArray(rawContent);
    const steps = isLabDefinition ? rawContent.steps : rawContent;
    const labTitle = isLabDefinition ? rawContent.title : undefined;

    const step = steps[currentStepIndex] as any;
    if (!step) return null;

    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === steps.length - 1;
    const isCompleted = completedSteps.includes(currentStepIndex);

    const handleExport = async () => {
        const ok = await exportEvidenceCapsule(`${activeLabId}-submission`);
        if (!ok) alert('Export failed. Check console.');
    };

    return (
        <PanelLayout
            className="bg-[#081018]"
            header={
                <div className="bg-[#0a1520] border-b border-[#1a2a3a] -m-4 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-gray-600 tracking-widest">MODULE</span>
                            <select
                                value={activeLabId}
                                onChange={(e) => setActiveLab(e.target.value)}
                                aria-label="Select lab module"
                                className="bg-transparent text-xs font-bold text-cyan-400 border-none outline-none cursor-pointer uppercase tracking-wider"
                            >
                                {labs.map(id => (
                                    <option key={id} value={id} className="bg-[#0a1520]">{id.replace('-', ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div className="text-[9px] font-mono text-gray-500">
                            STEP <span className="text-white">{currentStepIndex + 1}</span> / {steps.length}
                        </div>
                    </div>
                    <div className="w-full bg-[#05080a] h-1 rounded-full overflow-hidden border border-[#1a2a3a]/30">
                        <div
                            className="bg-cyan-500 h-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(0,255,255,0.5)]"
                            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                        />
                    </div>
                </div>
            }
        // Add navigation as a footer by appending it to component or using a slot if PanelLayout supported it.
        // Since PanelLayout is generic, we can put the footer in the body but fixed or...
        // Actually, PanelLayout only has header slot. We might want to just render footer after PanelLayout body content?
        // No, PanelLayout enforces full height. Ideally we'd add a 'footer' prop to PanelLayout or just accept Children.
        // Let's modify PanelLayout to support footer or just put it in children if we want it to scroll?
        // Wait, navigation footer should be fixed.
        // I'll stick the footer INSIDE the body for now? No, that scrolls away.
        // I'll update PanelLayout to support a footer prop in the next step or just patch it here.
        // Actually, I can just not use PanelLayout for the footer part if I wrap it differently, but PanelLayout is root.
        // Let's assume PanelLayout handles header and body.
        // I will update PanelLayout.tsx to support footer prop first.
        >
            <div className="flex flex-col h-full">
                <div className="flex-1">
                    {isFirst && <StudentIdentity />}

                    {isFirst && <StudentIdentity />}

                    {/* Lab Title for Definition Type */}
                    {isFirst && isLabDefinition && (
                        <div className="mb-6 pb-4 border-b border-cyan-900/30">
                            <h1 className="text-lg font-black text-white uppercase tracking-widest">{labTitle}</h1>
                            {/* @ts-ignore - LabDefinition objectives */}
                            {rawContent.objectives && (
                                <ul className="mt-4 space-y-2">
                                    {rawContent.objectives.map((obj: string, i: number) => (
                                        <li key={i} className="flex gap-2 text-xs text-gray-300">
                                            <span className="text-cyan-500">›</span>
                                            {obj}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-white mb-2">{step.title}</h2>
                        {/* @ts-ignore - description exists on LabStepDef */}
                        {step.description && !step.markdown && (
                            <p className="text-sm text-gray-400 mb-4">{step.description}</p>
                        )}
                    </div>

                    <SimpleMarkdown content={step.markdown} />

                    {/* Checklist UI (New Schema) */}
                    {/* @ts-ignore */}
                    {step.checklist && (
                        <div className="mt-6 space-y-3 bg-black/20 p-4 rounded border border-white/5">
                            <div className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold mb-2">Requirement Checklist</div>
                            {step.checklist.map((item: string, i: number) => (
                                <div key={i} className="flex gap-3 text-xs text-gray-300">
                                    <div className="w-4 h-4 rounded border border-gray-600 flex-shrink-0" />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Checkpoint UI (Legacy Schema) */}
                    {step.checkpoint && (
                        <div className={`mt-10 p-5 rounded-lg border transition-all duration-300 ${isCompleted
                            ? 'border-green-500/30 bg-green-500/5 shadow-[0_0_20px_rgba(0,255,100,0.05)]'
                            : 'border-cyan-500/30 bg-cyan-500/5'}`
                        }>
                            <div className="flex items-center justify-between mb-4">
                                <span className={`text-[9px] font-black tracking-widest uppercase ${isCompleted ? 'text-green-400' : 'text-cyan-500'}`}>
                                    Checkpoint: {isCompleted ? 'VERIFIED' : 'PENDING'}
                                </span>
                                {isCompleted && <span className="text-green-500 text-xs">✓</span>}
                            </div>

                            <div className="text-sm text-gray-300 leading-relaxed mb-4 italic">
                                "{step.checkpoint.description}"
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="p-2 bg-black/30 rounded border border-[#1a2a3a] text-center">
                                    <div className="text-[8px] text-gray-600 uppercase font-bold mb-1">Target Signal</div>
                                    <div className="text-xs font-mono text-cyan-400">{step.checkpoint.signal}</div>
                                </div>
                                <div className="p-2 bg-black/30 rounded border border-[#1a2a3a] text-center">
                                    <div className="text-[8px] text-gray-600 uppercase font-bold mb-1">Expected State</div>
                                    <div className="text-xs font-mono text-white">{step.checkpoint.expectedValue === 1 ? 'HIGH (1)' : 'LOW (0)'}</div>
                                </div>
                            </div>

                            {!isCompleted && (
                                <CheckpointVerifier
                                    signal={step.checkpoint.signal}
                                    expected={step.checkpoint.expectedValue}
                                    stepIndex={currentStepIndex}
                                />
                            )}
                        </div>
                    )}

                    {/* Completion UI */}
                    {step.id === 'completion' && (
                        <div className="mt-10 p-8 bg-cyan-950/10 border-2 border-dashed border-cyan-500/20 rounded-2xl text-center space-y-6">
                            <div>
                                <div className="text-3xl mb-2 opacity-50">🏆</div>
                                <h3 className="text-lg font-black text-white tracking-widest uppercase">LAB COMPLETE</h3>
                                <p className="text-xs text-gray-500 max-w-[240px] mx-auto leading-relaxed">
                                    All objectives verified. Generate your cryptographic evidence capsule for submission.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleExport}
                                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs tracking-widest rounded-lg shadow-[0_0_20px_rgba(0,255,255,0.3)] transition-all active:scale-95"
                            >
                                EXPORT EVIDENCE CAPSULE
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation Footer */}
                <div className="sticky bottom-0 bg-[#0a1520] border-t border-[#1a2a3a] flex items-center justify-between mt-auto pt-4 shadow-lg -mx-6 -mb-6 px-6 pb-6">
                    <button
                        type="button"
                        onClick={prevStep}
                        disabled={isFirst}
                        className={`text-[9px] font-black tracking-widest uppercase transition-all ${isFirst ? 'text-gray-700 opacity-30' : 'text-gray-500 hover:text-white'}`}
                    >
                        ← PREVIOUS
                    </button>

                    <div className="flex gap-1">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-1 h-1 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'w-4 bg-cyan-400' : (completedSteps.includes(idx) ? 'bg-green-600' : 'bg-gray-800')}`}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={nextStep}
                        disabled={isLast}
                        className={`text-[9px] font-black tracking-widest uppercase transition-all ${isLast ? 'text-gray-700 opacity-0' : 'text-cyan-500 hover:text-cyan-300'}`}
                    >
                        NEXT →
                    </button>
                </div>
            </div>
        </PanelLayout>
    );
};
