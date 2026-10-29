import React, { useCallback, useRef, useState } from 'react';
import { IdeButton, IdeModal } from './IdePrimitives';
import './save-as-dialog.css';

export function defaultCopyName(name: string, existingNames: readonly string[]) {
  const base = `${name.trim() || 'Untitled Project'} Copy`;
  const used = new Set(existingNames.map(value => value.trim().toLocaleLowerCase()));
  let candidate = base, suffix = 2;
  while (used.has(candidate.toLocaleLowerCase())) candidate = `${base} ${suffix++}`;
  return candidate;
}

export function copyNameError(name: string, existingNames: readonly string[], subject: 'copy' | 'project' = 'copy'): string | null {
  const trimmed = name.trim();
  if (!trimmed) return `Enter a name for the ${subject}.`;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return 'Use a name without control characters.';
  if (existingNames.some(value => value.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return 'A saved project already has this name. Choose a different name.';
  return null;
}

export type SaveCopyResult = { ok: true } | { ok: false; message: string };

/** What the dialog is for: a named copy (Save As), or the name an untitled project is first saved under. */
const PURPOSE = {
  copy: { title: 'Save project as', field: 'Copy name', help: 'The copy includes this circuit, its scenarios and recordings. You can edit it independently.',
    saving: 'Saving copy…', confirm: 'Save copy', failure: 'The copy could not be saved. Try again.', testId: 'ide-save-as' },
  name: { title: 'Name this project', field: 'Project name', help: 'Saved projects are listed under Open saved, and the Vivado package takes this name.',
    saving: 'Saving project…', confirm: 'Save', failure: 'The project could not be saved. Try again.', testId: 'ide-name-project' },
} as const;

export function SaveAsDialog({ initialName, existingNames, onSave, onClose, purpose = 'copy' }: {
  initialName: string;
  existingNames: readonly string[];
  onSave: (name: string) => Promise<SaveCopyResult>;
  onClose: () => void;
  purpose?: keyof typeof PURPOSE;
}) {
  const text = PURPOSE[purpose];
  const [name, setName] = useState(initialName);
  // An empty field is not an error until the student has typed in it.
  const [touched, setTouched] = useState(initialName.length > 0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const savingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => { if (!savingRef.current) closeRef.current(); }, []);
  const validation = copyNameError(name, existingNames, purpose === 'name' ? 'project' : 'copy');
  const submit = async () => {
    if (savingRef.current || validation) return;
    savingRef.current = true;
    setPending(true);
    setFailure(null);
    try {
      const result = await onSave(name.trim());
      if (result.ok) closeRef.current();
      else setFailure(result.message);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : text.failure);
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  };
  return <IdeModal title={text.title} testId={`${text.testId}-dialog`} className="ide-save-as-dialog" onClose={close}
    body={<form className="ide-save-as-fields" aria-busy={pending} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="ide-save-as-field"><span>{text.field}</span>
        <input className="ide-text-input" type="text" value={name} disabled={pending} autoFocus={purpose === 'name'}
          onChange={event => { setName(event.target.value); setTouched(true); setFailure(null); }}
          aria-invalid={touched && Boolean(validation)} aria-describedby="ide-save-as-message" data-testid={`${text.testId}-name`} />
      </label>
      <p className="ide-copy">{text.help}</p>
      <div id="ide-save-as-message" aria-live="polite">
        {pending ? <p role="status">{text.saving}</p> : failure ? <p role="alert">{failure} Your original work remains open. Try again.</p> : touched && validation ? <p role="alert">{validation}</p> : null}
      </div>
    </form>}
    actions={<>
      <IdeButton tone="ghost" onClick={close} disabled={pending} testId={`${text.testId}-cancel`}>Cancel</IdeButton>
      <IdeButton tone="primary" onClick={() => void submit()} disabled={pending || Boolean(validation)} testId={`${text.testId}-confirm`}>{pending ? 'Saving…' : text.confirm}</IdeButton>
    </>} />;
}
