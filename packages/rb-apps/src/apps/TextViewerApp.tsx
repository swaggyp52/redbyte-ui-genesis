// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import { useFileSystemStore } from '../stores/fileSystemStore';

interface TextViewerProps {
  resourceId?: string;
  resourceType?: 'file' | 'folder';
}

const TextViewerComponent: React.FC<TextViewerProps> = ({
  resourceId,
  resourceType,
}) => {
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('Untitled');
  const [notFound, setNotFound] = useState(false);
  const contentAreaRef = useRef<HTMLDivElement>(null);

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
    } else if (resourceId) {
      // Folder or invalid resourceType - show not found
      setNotFound(true);
      setFileName(resourceId);
      setContent('');
    }
  }, [resourceId, resourceType]);

  if (notFound) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4">📄</div>
          <div className="text-lg">File not found</div>
          <div className="text-sm mt-2">{fileName}</div>
        </div>
      </div>
    );
  }

  if (!resourceId) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4">📄</div>
          <div className="text-lg">No file selected</div>
          <div className="text-sm mt-2">Open a text file from Files app</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📄</div>
          <div>
            <div className="text-sm font-medium text-slate-200">{fileName}</div>
            <div className="text-xs text-slate-500">Text File</div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        ref={contentAreaRef}
        tabIndex={0}
        className="flex-1 overflow-auto p-6 font-mono text-sm text-slate-300 whitespace-pre-wrap focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-inset"
      >
        {content}
      </div>
    </div>
  );
};

export const TextViewerApp: RedByteApp = {
  manifest: {
    id: 'text-viewer',
    name: 'Text Viewer',
    iconId: 'document',
    singleton: false,
    category: 'utilities',
    hidden: true,
    defaultSize: { width: 600, height: 500 },
    minSize: { width: 400, height: 300 },
  },
  component: TextViewerComponent,
};
