import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { listExamples } from '@redbyte/rb-apps';
export function ExamplePicker({ open, onClose, onSelectExample }) {
    if (!open)
        return null;
    const examples = listExamples();
    const examplesByLayer = examples.reduce((acc, ex) => {
        if (!acc[ex.layer])
            acc[ex.layer] = [];
        acc[ex.layer].push(ex);
        return acc;
    }, {});
    const layerNames = {
        0: 'Foundation',
        1: 'Combinational Logic',
        2: 'Arithmetic & Logic',
        3: 'Memory & State',
        4: 'Control & Coordination',
        5: 'Memory Systems',
        6: 'Simple Processors',
    };
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            backdropFilter: 'blur(4px)',
        }, onClick: onClose, children: _jsxs("div", { style: {
                backgroundColor: 'var(--color-surface)',
                borderRadius: 8,
                padding: 24,
                maxWidth: 800,
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 20, fontWeight: 600 }, children: "Open Example" }), _jsx("button", { onClick: onClose, style: {
                                background: 'none',
                                border: 'none',
                                fontSize: 24,
                                cursor: 'pointer',
                                color: 'var(--color-text)',
                                padding: 4,
                            }, children: "\u00D7" })] }), _jsx("p", { style: { marginBottom: 24, opacity: 0.7 }, children: "Load a pre-built example project with probes, IO mappings, and documentation" }), Object.keys(examplesByLayer)
                    .map(Number)
                    .sort()
                    .map((layer) => (_jsxs("div", { style: { marginBottom: 24 }, children: [_jsxs("h3", { style: {
                                fontSize: 14,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                opacity: 0.6,
                                marginBottom: 12,
                            }, children: ["Layer ", layer, ": ", layerNames[layer]] }), _jsx("div", { style: { display: 'grid', gap: 8 }, children: examplesByLayer[layer].map((ex) => (_jsxs("button", { onClick: () => {
                                    onSelectExample(ex.id);
                                    onClose();
                                }, style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    textAlign: 'left',
                                    padding: 12,
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 6,
                                    backgroundColor: 'var(--color-surface-raised)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s, border-color 0.15s',
                                }, onMouseEnter: (e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-surface-highlight)';
                                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                                }, onMouseLeave: (e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)';
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }, children: [_jsx("span", { style: { fontWeight: 600, fontSize: 15 }, children: ex.name }), _jsx("span", { style: {
                                                    fontSize: 11,
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    backgroundColor: ex.difficulty === 'beginner'
                                                        ? 'rgba(0, 255, 136, 0.2)'
                                                        : ex.difficulty === 'intermediate'
                                                            ? 'rgba(255, 165, 0, 0.2)'
                                                            : 'rgba(255, 85, 85, 0.2)',
                                                    color: ex.difficulty === 'beginner'
                                                        ? '#00ff88'
                                                        : ex.difficulty === 'intermediate'
                                                            ? '#ffa500'
                                                            : '#ff5555',
                                                }, children: ex.difficulty })] }), _jsx("p", { style: { margin: 0, fontSize: 13, opacity: 0.7 }, children: ex.description })] }, ex.id))) })] }, layer)))] }) }));
}
