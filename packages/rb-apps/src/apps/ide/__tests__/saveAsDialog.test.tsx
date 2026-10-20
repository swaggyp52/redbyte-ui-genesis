// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SaveAsDialog, defaultCopyName } from '../components/SaveAsDialog';

afterEach(cleanup);

it('offers the first recognizable noncolliding name, including case and whitespace collisions', () => {
  expect(defaultCopyName(' Adder ', ['adder copy',' Adder COPY 2 '])).toBe('Adder Copy 3');
  expect(defaultCopyName('', [])).toBe('Untitled Project Copy');
});

it('validates names, focuses its named field, and consumes cancel Escape without clearing the canvas', () => {
  const save = vi.fn(), close = vi.fn(), escaped = vi.fn();
  window.addEventListener('keydown', escaped);
  render(<SaveAsDialog initialName="Adder Copy" existingNames={['Adder']} onSave={save} onClose={close} />);
  expect(screen.getByRole('dialog', {name:'Save project as'})).toBeTruthy();
  const input = screen.getByRole('textbox', {name:'Copy name'});
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, {target:{value:'  '}});
  expect(screen.getByTestId('ide-save-as-confirm')).toBeDisabled();
  fireEvent.change(input, {target:{value:'adder'}});
  expect(screen.getByRole('alert').textContent).toContain('already has this name');
  fireEvent.keyDown(input, {key:'Escape'});
  expect(close).toHaveBeenCalledTimes(1);
  expect(escaped).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  window.removeEventListener('keydown', escaped);
});

it('guards simultaneous Enter/button submission, holds the dialog during saving, and allows a failed save to retry', async () => {
  let release!: (result: {ok:false; message:string}) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValueOnce({ok:true});
  const close = vi.fn();
  const view = render(<SaveAsDialog initialName="Adder Copy" existingNames={['Adder']} onSave={save} onClose={close} />);
  const form = view.container.querySelector('form')!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('status').textContent).toBe('Saving copy…');
  expect(screen.getByTestId('ide-save-as-name')).toBeDisabled();
  fireEvent.keyDown(screen.getByTestId('ide-save-as-dialog'), {key:'Escape'});
  expect(close).not.toHaveBeenCalled();
  await act(async () => { release({ok:false,message:'Storage full.'}); });
  expect(screen.getByRole('alert').textContent).toContain('Storage full. Your original work remains open. Try again.');
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByTestId('ide-save-as-confirm')).toBeEnabled();
  await act(async () => fireEvent.click(screen.getByTestId('ide-save-as-confirm')));
  expect(save).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(1);
});
