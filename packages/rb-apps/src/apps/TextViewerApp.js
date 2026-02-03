import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useState, useEffect, useRef } from 'react';
import { useFileSystemStore } from '../stores/fileSystemStore';
const TextViewerComponent = ({ resourceId, resourceType, }) => {
    const [content, setContent] = useState('');
    const [fileName, setFileName] = useState('Untitled');
    const [notFound, setNotFound] = useState(false);
    const contentAreaRef = useRef(null);
    // Load file content from resourceId
    useEffect(() => {
        if (resourceId && resourceType === 'file') {
            const file = useFileSystemStore.getState().getFile(resourceId);
            if (!file) {
                setNotFound(true);
                setFileName(resourceId);
                setContent('');
                return;
            }
            setFileName(file.name);
            setContent(file.content ?? 'No content stored for this file.');
            setNotFound(false);
            // Focus content area deterministically using requestAnimationFrame
            requestAnimationFrame(() => {
                contentAreaRef.current?.focus();
            });
        }
        else if (resourceId) {
            // Folder or invalid resourceType - show not found
            setNotFound(true);
            setFileName(resourceId);
            setContent('');
        }
    }, [resourceId, resourceType]);
    if (notFound) {
        return (_jsx("div", { className: "h-full flex items-center justify-center bg-slate-900 text-slate-400", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-4xl mb-4", children: "\uD83D\uDCC4" }), _jsx("div", { className: "text-lg", children: "File not found" }), _jsx("div", { className: "text-sm mt-2", children: fileName })] }) }));
    }
    if (!resourceId) {
        return (_jsx("div", { className: "h-full flex items-center justify-center bg-slate-900 text-slate-400", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-4xl mb-4", children: "\uD83D\uDCC4" }), _jsx("div", { className: "text-lg", children: "No file selected" }), _jsx("div", { className: "text-sm mt-2", children: "Open a text file from Files app" })] }) }));
    }
    return (_jsxs("div", { className: "h-full flex flex-col bg-slate-900", children: [_jsx("div", { className: "flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "text-2xl", children: "\uD83D\uDCC4" }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-slate-200", children: fileName }), _jsx("div", { className: "text-xs text-slate-500", children: "Text File" })] })] }) }), _jsx("div", { ref: contentAreaRef, tabIndex: 0, className: "flex-1 overflow-auto p-6 font-mono text-sm text-slate-300 whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset", children: content })] }));
};
export const TextViewerApp = {
    manifest: {
        id: 'text-viewer',
        name: 'Text Viewer',
        iconId: 'document',
        singleton: false,
        category: 'utilities',
        defaultSize: { width: 600, height: 500 },
        minSize: { width: 400, height: 300 },
    },
    component: TextViewerComponent,
};
