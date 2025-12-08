import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { downloadProject, importProject } from '../context/ProjectSerializer';

const NotesApp: React.FC = () => {
  const { project, setNotes, setName, resetProject, replaceProject } = useProject();
  const [draftName, setDraftName] = useState(project.meta.name);
  const [draftNotes, setDraftNotes] = useState(project.notes);

  useEffect(() => setDraftName(project.meta.name), [project.meta.name]);
  useEffect(() => setDraftNotes(project.notes), [project.notes]);

  const handleBlurName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== project.meta.name) setName(trimmed);
  };

  const handleBlurNotes = () => {
    if (draftNotes !== project.notes) setNotes(draftNotes);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const imported = importProject(text);
      replaceProject(imported);
    } catch (err) {
      alert('Invalid or corrupted .redproj file');
    }
  };

  return (
    <div className='h-full w-full bg-black/80 text-[11px] text-slate-100 flex flex-col p-3 space-y-3'>
      
      {/* HEADER WITH IMPORT / EXPORT */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='text-[10px] uppercase tracking-[0.2em] text-red-300/80'>
            project notebook
          </div>
          <div className='text-[10px] text-slate-400'>
            fully exportable + importable machine state
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            onClick={() => downloadProject(project)}
            className='text-[10px] uppercase border border-red-900/70 rounded px-2 py-1 bg-black/60 hover:border-red-400/80 hover:bg-red-950/60'
          >
            export
          </button>

          <label className='text-[10px] uppercase border border-red-900/70 rounded px-2 py-1 bg-black/60 hover:border-red-400/80 hover:bg-red-950/60 cursor-pointer'>
            import
            <input type='file' accept='.redproj' className='hidden' onChange={handleImport} />
          </label>

          <button
            onClick={resetProject}
            className='text-[10px] uppercase border border-red-900/70 rounded px-2 py-1 bg-black/60 hover:border-red-400/80 hover:bg-red-950/60'
          >
            reset
          </button>
        </div>
      </div>

      {/* PROJECT NAME */}
      <div className='rounded-lg border border-red-900/70 bg-black/70 p-2 space-y-1'>
        <div className='text-[10px] uppercase tracking-[0.18em] text-slate-400'>
          project name
        </div>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={handleBlurName}
          className='w-full bg-black/70 border border-red-900/70 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-red-400/80'
        />
      </div>

      {/* NOTES */}
      <div className='flex-1 rounded-lg border border-red-900/70 bg-black/70 p-2 flex flex-col'>
        <textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          onBlur={handleBlurNotes}
          className='flex-1 resize-none bg-black/80 border border-red-900/70 rounded px-2 py-1 text-slate-100 text-[11px]'
        />
      </div>
    </div>
  );
};

export default NotesApp;
