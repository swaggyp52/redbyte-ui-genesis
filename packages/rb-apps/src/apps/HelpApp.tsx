// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Help / Troubleshooting app for RedByte OS

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { HELP_TOPICS, searchHelpTopics, getTopicsByErrorCode, type HelpTopic } from '../help/helpTopics';
import { toast } from '@redbyte/rb-primitives';

interface HelpAppProps {
  windowId?: string;
  initialQuery?: string;
  initialErrorCode?: string;
  initialTopicId?: string;
}

export function HelpApp({ windowId, initialQuery, initialErrorCode, initialTopicId }: HelpAppProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery ?? '');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Auto-select topic on mount based on seed parameters
  useEffect(() => {
    if (initialTopicId) {
      const topic = HELP_TOPICS.find((t) => t.id === initialTopicId);
      if (topic) {
        setSelectedTopicId(initialTopicId);
        return;
      }
    }
    if (initialErrorCode) {
      const topics = getTopicsByErrorCode(initialErrorCode);
      if (topics.length > 0) {
        setSelectedTopicId(topics[0].id);
        setSearchQuery(initialErrorCode); // Show error code in search box
        return;
      }
    }
  }, [initialTopicId, initialErrorCode]);

  const filteredTopics = useMemo(() => searchHelpTopics(searchQuery), [searchQuery]);

  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return filteredTopics[0] ?? null;
    return filteredTopics.find((t) => t.id === selectedTopicId) ?? filteredTopics[0] ?? null;
  }, [selectedTopicId, filteredTopics]);

  const handleCopyDiagnostics = useCallback(() => {
    const diagnostics: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      appVersion: '1.0.0', // TODO: get from build.json if available
      performanceMode: localStorage.getItem('rb-performance-mode') ?? 'auto',
      bridgeDryrun: window.location.search.includes('RB_BRIDGE_DRYRUN=1'),
      selectedTopic: selectedTopic?.id,
    };

    // Try to get latest progress failures (if progressBus is available)
    try {
      const progressBusKey = 'rb:progress-bus';
      const progressBusRaw = (window as any).__rbProgressBus;
      if (progressBusRaw && typeof progressBusRaw.getSnapshot === 'function') {
        const snapshot = progressBusRaw.getSnapshot();
        const failures = snapshot.filter((e: any) => e.status === 'failed').slice(-5);
        if (failures.length > 0) {
          diagnostics.recentFailures = failures.map((e: any) => ({
            actionId: e.actionId,
            error: e.error,
          }));
        }
      }
    } catch {
      // Ignore if progressBus not available
    }

    const text = JSON.stringify(diagnostics, null, 2);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          toast.success({ title: 'Diagnostics Copied', message: 'Paste into your support request.' });
        },
        () => {
          // Fallback: show in alert
          alert(`Diagnostics (copy manually):\n\n${text}`);
        }
      );
    } else {
      // Fallback: show in alert
      alert(`Diagnostics (copy manually):\n\n${text}`);
    }
  }, [selectedTopic]);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">❓</span>
          <div>
            <h1 className="text-lg font-bold text-gray-100">Help & Troubleshooting</h1>
            <p className="text-xs text-gray-400">Common issues and solutions</p>
          </div>
        </div>
        <button
          onClick={handleCopyDiagnostics}
          className="px-3 py-1.5 bg-cyan-800 hover:bg-cyan-700 text-white rounded text-xs font-semibold transition-colors"
          title="Copy diagnostic info to share with instructors"
        >
          Copy Diagnostics
        </button>
      </div>

      {/* Search Box */}
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <input
          type="text"
          placeholder="Search by topic, error code, or keyword..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedTopicId(null); // Reset selection on search
          }}
          className="w-full px-3 py-2 bg-gray-800 text-gray-100 border border-gray-700 rounded focus:outline-none focus:border-cyan-600 text-sm placeholder-gray-500"
        />
        {searchQuery && (
          <div className="mt-2 text-xs text-gray-400">
            {filteredTopics.length === 0 ? 'No results found' : `${filteredTopics.length} topic${filteredTopics.length === 1 ? '' : 's'} found`}
          </div>
        )}
      </div>

      {/* Content Area: Topic List + Selected Topic */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Topic List */}
        <div className="w-80 border-r border-gray-800 overflow-y-auto bg-gray-900/30">
          {filteredTopics.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">
              No topics match your search. Try a different keyword.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredTopics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors ${
                    selectedTopic?.id === topic.id ? 'bg-cyan-900/30 border-l-4 border-cyan-500' : ''
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-100">{topic.title}</div>
                  {topic.errorCodes && topic.errorCodes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {topic.errorCodes.map((code) => (
                        <span
                          key={code}
                          className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] font-mono"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Selected Topic Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedTopic ? (
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">{selectedTopic.title}</h2>
              {selectedTopic.errorCodes && selectedTopic.errorCodes.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedTopic.errorCodes.map((code) => (
                    <span
                      key={code}
                      className="px-2 py-1 bg-cyan-900/30 text-cyan-300 border border-cyan-800 rounded text-xs font-mono"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  What to do:
                </h3>
                <ol className="space-y-3">
                  {selectedTopic.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-cyan-900/50 text-cyan-300 rounded-full text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm text-gray-300 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Select a topic to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
