import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BitstreamProvenanceModal({ isOpen, onClose, metadata }) {
    if (!isOpen)
        return null;
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
                maxWidth: 700,
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 20, fontWeight: 600 }, children: "Bitstream Provenance" }), _jsx("button", { onClick: onClose, style: {
                                background: 'none',
                                border: 'none',
                                fontSize: 24,
                                cursor: 'pointer',
                                color: 'var(--color-text)',
                                padding: 4,
                            }, children: "\u00D7" })] }), _jsx("p", { style: { marginBottom: 24, opacity: 0.7, fontSize: 14 }, children: "Cryptographic integrity proof for HDL and bitstream artifacts" }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h3", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }, children: "Project" }), _jsxs("div", { style: { display: 'grid', gap: 8, fontSize: 14 }, children: [_jsx(MetadataRow, { label: "Name", value: metadata.projectName }), _jsx(MetadataRow, { label: "Project ID", value: metadata.projectId }), _jsx(MetadataRow, { label: "Timestamp", value: new Date(metadata.timestamp).toLocaleString() }), _jsx(MetadataRow, { label: "Board Profile", value: metadata.boardProfile })] })] }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h3", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }, children: "Circuit Integrity" }), _jsxs("div", { style: { display: 'grid', gap: 8, fontSize: 14 }, children: [_jsx(MetadataRow, { label: "Circuit Hash", value: metadata.circuitHash, mono: true }), _jsx(MetadataRow, { label: "Nodes", value: metadata.nodeCount.toString() }), _jsx(MetadataRow, { label: "Connections", value: metadata.connectionCount.toString() }), metadata.ioMappingHash && _jsx(MetadataRow, { label: "IO Mapping Hash", value: metadata.ioMappingHash, mono: true })] })] }), _jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h3", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }, children: "HDL Artifacts" }), _jsxs("div", { style: { display: 'grid', gap: 8, fontSize: 14 }, children: [_jsx(MetadataRow, { label: "Verilog Hash", value: metadata.verilogHash, mono: true }), _jsx(MetadataRow, { label: "Verilog Lines", value: metadata.verilogLines.toString() }), metadata.constraintsHash && (_jsx(MetadataRow, { label: "Constraints Hash", value: metadata.constraintsHash, mono: true }))] })] }), metadata.bitstreamHash && (_jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h3", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }, children: "Bitstream" }), _jsxs("div", { style: { display: 'grid', gap: 8, fontSize: 14 }, children: [_jsx(MetadataRow, { label: "Bitstream Hash", value: metadata.bitstreamHash, mono: true }), metadata.bitstreamSize && (_jsx(MetadataRow, { label: "Size", value: `${(metadata.bitstreamSize / 1024).toFixed(2)} KB` }))] })] })), metadata.toolchainVersion && (_jsxs("div", { style: { marginBottom: 24 }, children: [_jsx("h3", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }, children: "Toolchain" }), _jsx("div", { style: { display: 'grid', gap: 8, fontSize: 14 }, children: _jsx(MetadataRow, { label: "Version", value: metadata.toolchainVersion }) })] })), (metadata.warnings.length > 0 || metadata.unsupportedNodes.length > 0) && (_jsxs("div", { children: [_jsx("h3", { style: { fontSize: 14, fontWeight: 600, marginBottom: 12, opacity: 0.6, textTransform: 'uppercase' }, children: "Warnings" }), metadata.unsupportedNodes.length > 0 && (_jsxs("div", { style: {
                                padding: 12,
                                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                                borderLeft: '3px solid #ffa500',
                                marginBottom: 12,
                                fontSize: 13,
                            }, children: [_jsx("strong", { children: "Unsupported nodes:" }), " ", metadata.unsupportedNodes.join(', ')] })), metadata.warnings.map((warning, idx) => (_jsx("div", { style: {
                                padding: 12,
                                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                                borderLeft: '3px solid #ffa500',
                                marginBottom: 8,
                                fontSize: 13,
                            }, children: warning }, idx)))] })), _jsxs("div", { style: {
                        marginTop: 24,
                        padding: 12,
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        borderRadius: 4,
                        fontSize: 13,
                    }, children: [_jsx("strong", { children: "Verification:" }), " All hashes are SHA-256 and deterministic. An instructor can verify this bitstream came from the exact circuit by re-hashing the source files."] })] }) }));
}
function MetadataRow({ label, value, mono }) {
    return (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 16 }, children: [_jsxs("span", { style: { opacity: 0.7 }, children: [label, ":"] }), _jsx("span", { style: {
                    fontFamily: mono ? 'monospace' : 'inherit',
                    fontSize: mono ? 12 : 14,
                    wordBreak: 'break-all',
                    textAlign: 'right',
                }, children: value })] }));
}
