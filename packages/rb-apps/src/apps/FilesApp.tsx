import React, { useState, useEffect } from 'react';
import type { RedByteApp } from '../types';
import {
  listFiles,
  createFile,
  renameFile,
  deleteFile,
  type LogicFile,
} from '../stores/filesStore';
import { deserialize } from '@rb/rb-logic-core';

interface FilesProps {
  onOpenFile?: (fileId: string) => void;
}

const FilesComponent: React.FC<FilesProps> = ({ onOpenFile }) => {
  const [files, setFiles] = useState<LogicFile[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  const refreshFiles = () => {
    setFiles(listFiles());
  };

  useEffect(() => {
    refreshFiles();
  }, []);

  const handleNewCircuit = () => {
    const emptyCircuit = deserialize({
      version: 'v1',
      nodes: [],
      connections: [],
    });

    const newFile = createFile('New Circuit', {
      version: 'v1',
      nodes: emptyCircuit.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        rotation: n.rotation,
        config: n.config,
      })),
      connections: emptyCircuit.connections,
    });

    refreshFiles();
    onOpenFile?.(newFile.id);
  };

  const handleOpen = (fileId: string) => {
    onOpenFile?.(fileId);
  };

  const handleRename = (fileId: string, currentName: string) => {
    setRenamingId(fileId);
    setRenamingValue(currentName);
  };

  const handleRenameSubmit = (fileId: string) => {
    if (renamingValue.trim()) {
      renameFile(fileId, renamingValue.trim());
      refreshFiles();
    }
    setRenamingId(null);
  };

  const handleDelete = (fileId: string, fileName: string) => {
    if (window.confirm(`Delete "${fileName}"?`)) {
      deleteFile(fileId);
      refreshFiles();
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="border-b border-gray-700 p-4">
        <button
          onClick={handleNewCircuit}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-sm font-medium"
        >
          + New Circuit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="mb-2">No circuits saved yet</p>
              <p className="text-sm">Create a new circuit to get started</p>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Name</th>
                <th className="text-left p-3 text-sm font-medium">Last Modified</th>
                <th className="text-left p-3 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="border-b border-gray-800 hover:bg-gray-850"
                >
                  <td className="p-3">
                    {renamingId === file.id ? (
                      <input
                        type="text"
                        value={renamingValue}
                        onChange={(e) => setRenamingValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(file.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(file.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded w-full"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm">{file.name}</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-400">
                    {formatDate(file.updatedAt)}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpen(file.id)}
                        className="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleRename(file.id, file.name)}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(file.id, file.name)}
                        className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export const FilesApp: RedByteApp = {
  manifest: {
    id: 'files',
    name: 'Files',
    iconId: 'files',
    category: 'system',
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 500, height: 300 },
  },
  component: FilesComponent,
};
