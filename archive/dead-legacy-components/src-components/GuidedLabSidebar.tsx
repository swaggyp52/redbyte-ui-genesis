import React from 'react';
import { useLabStore } from '@redbyte/rb-logic-3d';
import { VIRTUAL_LAB_TEMPLATES } from '../apps/virtual-lab-templates';

// Minimal Markdown Renderer to avoid adding dependencies
const MiniMarkdown: React.FC<{ children: string }> = ({ children }) => {
    const lines = children.split('\n');
    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                // List Items
                if (line.trim().startsWith('- ')) {
                    const content = line.trim().substring(2);
                    return (
                        <div key={i} className="flex gap-2 text-xs ml-2">
                            <span className="text-gray-500">•</span>
                            <span>{parseBold(content)}</span>
                        </div>
                    );
                }
                // Numbered Lists (Simple 1. check)
                if (/^\d+\.\s/.test(line.trim())) {
                    const match = line.trim().match(/^(\d+)\.\s(.*)/);
                    if (match) {
                        return (
                            <div key={i} className="flex gap-2 text-xs ml-2">
                                <span className="text-gray-500 font-mono">{match[1]}.</span>
                                <span>{parseBold(match[2])}</span>
                            </div>
                        );
                    }
                }
                // Default Paragraph
                if (line.trim() === '') return <div key={i} className="h-2" />;

                return <div key={i} className="text-xs">{parseBold(line)}</div>;
            })}
        </div>
    );
};

const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-gray-200 font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export const GuidedLabSidebar = () => {
    const labSession = useLabStore(state => state.labSession);
    const templateId = labSession?.templateId;
    const template = VIRTUAL_LAB_TEMPLATES.find(t => t.lab_id === templateId);

    if (!template || !template.guide || template.guide.length === 0) {
        return null; // No guide available
    }

    return (
        <div className="w-80 flex flex-col border-l border-gray-700 bg-[#252526] h-full overflow-hidden">
            <div className="p-4 border-b border-gray-700 bg-[#333]">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Lab Guide</h2>
                <div className="text-xs text-gray-400 mt-1">{template.name}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {template.guide.map((step, index) => (
                    <div key={step.id} className="group relative pl-4 border-l-2 border-gray-600 hover:border-blue-500 transition-colors">
                        <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-gray-600 group-hover:bg-blue-500 transition-colors" />

                        <h3 className="text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                            {step.title}
                        </h3>

                        <div className="text-xs text-gray-400">
                            <MiniMarkdown>{step.markdown}</MiniMarkdown>
                        </div>

                        {step.verify_criteria && (
                            <div className="mt-2">
                                <span className="text-[10px] uppercase bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                                    Check: {step.verify_criteria}
                                </span>
                            </div>
                        )}
                    </div>
                ))}

                <div className="pt-8 text-center">
                    <div className="text-xs text-gray-600 italic">
                        End of Guide
                    </div>
                </div>
            </div>
        </div>
    );
};
