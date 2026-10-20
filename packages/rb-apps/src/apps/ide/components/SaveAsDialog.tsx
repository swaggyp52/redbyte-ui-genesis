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

export function copyNameError(name: string, existingNames: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name for the copy.';
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return 'Use a name without control characters.';
  if (existingNames.some(value => value.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return 'A saved project already has this name. Choose a different name.';
  return null;
}

export type SaveCopyResult = { ok: true } | { ok: false; message: string };

export function SaveAsDialog({ initialName, existingNames, onSave, onClose }: {
  initialName: string;
  existingNames: readonly string[];
  onSave: (name: string) => Promise<SaveCopyResult>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const savingRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => { if (!savingRef.current) closeRef.current(); }, []);
  const validation = copyNameError(name, existingNames);
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
      setFailure(error instanceof Error ? error.message : 'The copy could not be saved. Try again.');
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  };
  return <IdeModal title="Save project as" testId="ide-save-as-dialog" className="ide-save-as-dialog" onClose={close}
    body={<form className="ide-save-as-fields" aria-busy={pending} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="ide-save-as-field"><span>Copy name</span>
        <input className="ide-text-input" type="text" value={name} disabled={pending}
          onChange={event => { setName(event.target.value); setFailure(null); }}
          aria-invalid={Boolean(validation)} aria-describedby="ide-save-as-message" data-testid="ide-save-as-name" />
      </label>
      <p className="ide-copy">The copy includes this circuit, its scenarios and recordings. You can edit it independently.</p>
      <div id="ide-save-as-message" aria-live="polite">
        {pending ? <p role="status">Saving copy…</p> : failure ? <p role="alert">{failure} Your original work remains open. Try again.</p> : validation ? <p role="alert">{validation}</p> : null}
      </div>
    </form>}
    actions={<>
      <IdeButton tone="ghost" onClick={close} disabled={pending} testId="ide-save-as-cancel">Cancel</IdeButton>
      <IdeButton tone="primary" onClick={() => void submit()} disabled={pending || Boolean(validation)} testId="ide-save-as-confirm">{pending ? 'Saving…' : 'Save copy'}</IdeButton>
    </>} />;
}
