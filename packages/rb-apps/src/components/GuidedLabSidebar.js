import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLabStore } from '@redbyte/rb-logic-3d';
import { VIRTUAL_LAB_TEMPLATES } from '../apps/virtual-lab-templates';
// Minimal Markdown Renderer to avoid adding dependencies
const MiniMarkdown = ({ children }) => {
    const lines = children.split('\n');
    return (_jsx("div", { className: "space-y-1", children: lines.map((line, i) => {
            // List Items
            if (line.trim().startsWith('- ')) {
                const content = line.trim().substring(2);
                return (_jsxs("div", { className: "flex gap-2 text-xs ml-2", children: [_jsx("span", { className: "text-gray-500", children: "\u2022" }), _jsx("span", { children: parseBold(content) })] }, i));
            }
            // Numbered Lists (Simple 1. check)
            if (/^\d+\.\s/.test(line.trim())) {
                const match = line.trim().match(/^(\d+)\.\s(.*)/);
                if (match) {
                    return (_jsxs("div", { className: "flex gap-2 text-xs ml-2", children: [_jsxs("span", { className: "text-gray-500 font-mono", children: [match[1], "."] }), _jsx("span", { children: parseBold(match[2]) })] }, i));
                }
            }
            // Default Paragraph
            if (line.trim() === '')
                return _jsx("div", { className: "h-2" }, i);
            return _jsx("div", { className: "text-xs", children: parseBold(line) }, i);
        }) }));
};
const parseBold = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return _jsx("strong", { className: "text-gray-200 font-bold", children: part.slice(2, -2) }, index);
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
    return (_jsxs("div", { className: "w-80 flex flex-col border-l border-gray-700 bg-[#252526] h-full overflow-hidden", children: [_jsxs("div", { className: "p-4 border-b border-gray-700 bg-[#333]", children: [_jsx("h2", { className: "text-sm font-bold text-white uppercase tracking-wider", children: "Lab Guide" }), _jsx("div", { className: "text-xs text-gray-400 mt-1", children: template.name })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-6", children: [template.guide.map((step, index) => (_jsxs("div", { className: "group relative pl-4 border-l-2 border-gray-600 hover:border-blue-500 transition-colors", children: [_jsx("div", { className: "absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-gray-600 group-hover:bg-blue-500 transition-colors" }), _jsxs("h3", { className: "text-sm font-bold text-gray-200 mb-2 flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-gray-500 font-mono", children: (index + 1).toString().padStart(2, '0') }), step.title] }), _jsx("div", { className: "text-xs text-gray-400", children: _jsx(MiniMarkdown, { children: step.markdown }) }), step.verify_criteria && (_jsx("div", { className: "mt-2", children: _jsxs("span", { className: "text-[10px] uppercase bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700", children: ["Check: ", step.verify_criteria] }) }))] }, step.id))), _jsx("div", { className: "pt-8 text-center", children: _jsx("div", { className: "text-xs text-gray-600 italic", children: "End of Guide" }) })] })] }));
};
