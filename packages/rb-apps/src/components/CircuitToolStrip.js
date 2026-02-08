import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLogicViewStore } from '@redbyte/rb-logic-view';
import { fitToBounds } from '@redbyte/rb-viewport';
import { useRenderStormDetector } from '../hooks/useRenderStormDetector';
export const CircuitToolStrip = ({ circuit, width, height, canUndo, canRedo, onUndo, onRedo, }) => {
    if (import.meta.env.DEV &&
        typeof window !== 'undefined' &&
        (localStorage.getItem('rb-debug-playground') || '').includes('disable-toolstrip')) {
        return null;
    }
    useRenderStormDetector('CircuitToolStrip');
    // Use primitive selectors to avoid creating new object references on every render
    const toolMode = useLogicViewStore((state) => state.toolMode);
    const setToolMode = useLogicViewStore((state) => state.setToolMode);
    const snapToGrid = useLogicViewStore((state) => state.snapToGrid);
    const toggleSnapToGrid = useLogicViewStore((state) => state.toggleSnapToGrid);
    const setCamera = useLogicViewStore((state) => state.setCamera);
    const handleFit = () => {
        if (width <= 0 || height <= 0)
            return;
        if (circuit.nodes.length === 0) {
            setCamera({ x: 0, y: 0, zoom: 1 });
            return;
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        circuit.nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y);
        });
        if (!isFinite(minX)) {
            setCamera({ x: 0, y: 0, zoom: 1 });
            return;
        }
        const nextCamera = fitToBounds({ minX, maxX, minY, maxY }, width, height, 100, 2);
        setCamera(nextCamera);
    };
    const handleReset = () => {
        setCamera({ x: 0, y: 0, zoom: 1 });
    };
    return (_jsxs("div", { className: "absolute left-3 top-3 z-20 flex items-center gap-2 rounded-md border border-gray-700/70 bg-gray-900/80 px-2 py-1 text-[11px] text-gray-300 shadow-lg backdrop-blur", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { type: "button", onClick: () => setToolMode('select'), className: `px-2 py-1 rounded transition-colors ${toolMode === 'select'
                            ? 'bg-cyan-700 text-white'
                            : 'bg-gray-800/70 hover:bg-gray-700 text-gray-300'}`, title: "Select tool (Esc)", children: "Select" }), _jsx("button", { type: "button", onClick: () => setToolMode(toolMode === 'wire' ? 'select' : 'wire'), className: `px-2 py-1 rounded transition-colors ${toolMode === 'wire'
                            ? 'bg-cyan-700 text-white'
                            : 'bg-gray-800/70 hover:bg-gray-700 text-gray-300'}`, title: "Wire tool (W)", children: "Wire" })] }), _jsx("div", { className: "h-4 w-px bg-gray-700/60" }), _jsx("span", { className: "text-[10px] text-gray-400", title: "Hold Space to pan", children: "Space: Pan" }), _jsxs("button", { type: "button", onClick: toggleSnapToGrid, className: `px-2 py-1 rounded transition-colors ${snapToGrid ? 'bg-gray-700 text-white' : 'bg-gray-800/70 hover:bg-gray-700 text-gray-300'}`, title: "Toggle snap to grid (G)", children: ["Snap ", snapToGrid ? 'On' : 'Off'] }), _jsx("div", { className: "h-4 w-px bg-gray-700/60" }), _jsx("button", { type: "button", onClick: handleFit, className: "px-2 py-1 rounded bg-gray-800/70 hover:bg-gray-700 transition-colors", title: "Fit to view (F)", children: "Fit" }), _jsx("button", { type: "button", onClick: handleReset, className: "px-2 py-1 rounded bg-gray-800/70 hover:bg-gray-700 transition-colors", title: "Reset view (0)", children: "Reset" }), _jsx("div", { className: "h-4 w-px bg-gray-700/60" }), _jsx("button", { type: "button", onClick: onUndo, disabled: !canUndo, className: `px-2 py-1 rounded transition-colors ${canUndo
                    ? 'bg-gray-800/70 hover:bg-gray-700 text-gray-200'
                    : 'bg-gray-800/40 text-gray-600 cursor-not-allowed'}`, title: "Undo (Ctrl+Z)", children: "Undo" }), _jsx("button", { type: "button", onClick: onRedo, disabled: !canRedo, className: `px-2 py-1 rounded transition-colors ${canRedo
                    ? 'bg-gray-800/70 hover:bg-gray-700 text-gray-200'
                    : 'bg-gray-800/40 text-gray-600 cursor-not-allowed'}`, title: "Redo (Ctrl+Shift+Z)", children: "Redo" })] }));
};
