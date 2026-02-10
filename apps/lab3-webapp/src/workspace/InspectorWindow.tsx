import React from 'react';
import useLabStore from '../store/labStore';

/**
 * InspectorWindow: Displays current document state in read-only form fields
 */
export const InspectorWindow: React.FC = () => {
  const doc = useLabStore((s) => s.doc);

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      {/* Document Meta */}
      <section className="space-y-2">
        <h3 className="font-tech font-bold text-cyan-400 text-sm">Document</h3>
        <div className="space-y-2 text-xs">
          <div className="flex gap-2">
            <label className="w-24 text-slate-500 font-tech">ID:</label>
            <input
              type="text"
              value={doc.meta.id}
              readOnly
              className="flex-1 bg-slate-700/30 border border-slate-600/50 rounded px-2 py-1 text-slate-300 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <label className="w-24 text-slate-500 font-tech">Name:</label>
            <input
              type="text"
              value={doc.meta.name}
              readOnly
              className="flex-1 bg-slate-700/30 border border-slate-600/50 rounded px-2 py-1 text-slate-300 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <label className="w-24 text-slate-500 font-tech">Created:</label>
            <input
              type="text"
              value={new Date(doc.meta.createdAt).toLocaleString()}
              readOnly
              className="flex-1 bg-slate-700/30 border border-slate-600/50 rounded px-2 py-1 text-slate-300 font-mono"
            />
          </div>
          <div className="flex gap-2">
            <label className="w-24 text-slate-500 font-tech">Updated:</label>
            <input
              type="text"
              value={new Date(doc.meta.updatedAt).toLocaleString()}
              readOnly
              className="flex-1 bg-slate-700/30 border border-slate-600/50 rounded px-2 py-1 text-slate-300 font-mono"
            />
          </div>
        </div>
      </section>

      {/* Truth Table Overview */}
      <section className="space-y-2">
        <h3 className="font-tech font-bold text-cyan-400 text-sm">Truth Table ({doc.truthTable.length} rows)</h3>
        <div className="overflow-x-auto">
          <table className="text-xs font-mono w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-600/50">
                <th className="px-2 py-1 text-left text-slate-400">B3</th>
                <th className="px-2 py-1 text-left text-slate-400">B2</th>
                <th className="px-2 py-1 text-left text-slate-400">B1</th>
                <th className="px-2 py-1 text-left text-slate-400">B0</th>
                <th className="px-2 py-1 text-left text-slate-400">Seg</th>
                <th className="px-2 py-1 text-left text-slate-400">DC</th>
              </tr>
            </thead>
            <tbody>
              {doc.truthTable.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors duration-150 ${
                    idx < 10 ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  <td className="px-2 py-1">{row.b3}</td>
                  <td className="px-2 py-1">{row.b2}</td>
                  <td className="px-2 py-1">{row.b1}</td>
                  <td className="px-2 py-1">{row.b0}</td>
                  <td className="px-2 py-1 font-mono">[{row.seg.join(',')}]</td>
                  <td className="px-2 py-1 text-center">{row.isDontCare ? '✓' : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expressions */}
      <section className="space-y-2">
        <h3 className="font-tech font-bold text-cyan-400 text-sm">Boolean Expressions</h3>
        <div className="space-y-2 text-xs">
          {Object.entries(doc.expressions).map(([seg, expr]) => (
            <div key={seg} className="flex gap-2">
              <label className="w-12 text-slate-500 font-tech">seg_{seg}:</label>
              <input
                type="text"
                value={expr || '(empty)'}
                readOnly
                className="flex-1 bg-slate-700/30 border border-slate-600/50 rounded px-2 py-1 text-slate-300 font-mono text-xs"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Results */}
      <section className="space-y-2">
        <h3 className="font-tech font-bold text-cyan-400 text-sm">Validation Results</h3>
        <div className="space-y-1 text-xs">
          {Object.entries(doc.results).length === 0 ? (
            <div className="text-slate-500">No validation results yet</div>
          ) : (
            Object.entries(doc.results).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="text-slate-500 font-tech">{key}:</span>
                <span className="text-slate-300">{JSON.stringify(value)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
