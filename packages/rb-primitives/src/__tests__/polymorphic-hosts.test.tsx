import React from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { Text } from '../Text';

afterEach(cleanup);

describe('polymorphic primitive host contracts', () => {
  it('retains native button props, children, callbacks and default non-submit type', () => {
    const clicked: string[] = [];
    const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const view = render(<form onSubmit={submit}>
      <Button name="owner-action" value="save" ariaLabel="Save owner"
        onClick={event => clicked.push(event.currentTarget.tagName)}><strong>Save</strong></Button>
    </form>);
    const button = view.getByRole('button', { name: 'Save owner' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('name')).toBe('owner-action');
    expect(button.getAttribute('value')).toBe('save');
    expect(button.querySelector('strong')?.textContent).toBe('Save');
    fireEvent.click(button);
    expect(clicked).toEqual(['BUTTON']);
    expect(submit).not.toHaveBeenCalled();
  });

  it('preserves explicit submit type and actual disabled native behavior', () => {
    const click = vi.fn();
    const view = render(<Button type="submit" disabled onClick={click}>Submit</Button>);
    const button = view.getByRole('button', { name: 'Submit' });
    expect(button.getAttribute('type')).toBe('submit');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });

  it('preserves anchor href/native callback while retaining the Button role and children', () => {
    const clicked: string[] = [];
    const view = render(<Button as="a" href="/owner" target="_blank" rel="noopener"
      ariaLabel="Open owner" onClick={event => {
        event.preventDefault();
        clicked.push(event.currentTarget.tagName);
      }}><em>Owner</em></Button>);
    const anchor = view.getByRole('button', { name: 'Open owner' });
    expect(anchor.tagName).toBe('A');
    expect(anchor.getAttribute('href')).toBe('/owner');
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener');
    expect(anchor.getAttribute('type')).toBeNull();
    expect(anchor.querySelector('em')?.textContent).toBe('Owner');
    fireEvent.click(anchor);
    expect(clicked).toEqual(['A']);
  });

  it('renders Panel and Text as native fieldset and label with their selected host props', () => {
    const view = render(<Panel as="fieldset" disabled name="owner-group" aria-label="Owner group">
      <Text as="label" htmlFor="owner-input" weight="bold">Owner input</Text>
      <input id="owner-input" />
    </Panel>);
    const group = view.getByRole('group', { name: 'Owner group' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.hasAttribute('disabled')).toBe(true);
    expect(group.getAttribute('name')).toBe('owner-group');
    const label = view.getByText('Owner input');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('owner-input');
    expect(label.className).toContain('font-[var(--rb-font-weight-bold)]');
    expect(view.getByLabelText('Owner input').id).toBe('owner-input');
  });

  it('passes required custom component props and nested children without an extra host wrapper', () => {
    function OwnerHost({ owner, className, children }: {
      owner: string; className?: string; children: React.ReactNode;
    }) {
      return <section data-owner={owner} className={className}>{children}</section>;
    }
    const view = render(<Panel as={OwnerHost} owner="project-owner" padding="lg">
      <Text as={OwnerHost} owner="signal-owner" className="owner-text"><span>Signal</span></Text>
    </Panel>);
    const project = view.container.querySelector('[data-owner="project-owner"]');
    const signal = view.container.querySelector('[data-owner="signal-owner"]');
    expect(project?.tagName).toBe('SECTION');
    expect(project?.className).toContain('p-[var(--rb-spacing-6)]');
    expect(signal?.tagName).toBe('SECTION');
    expect(signal?.className).toBe('owner-text');
    expect(signal?.parentElement).toBe(project);
    expect(signal?.firstElementChild?.tagName).toBe('SPAN');
    expect(signal?.textContent).toBe('Signal');
  });

  it('retains precise native prop and callback types for selected hosts', () => {
    type NativeButton = Parameters<typeof Button<'button'>>[0];
    type AnchorButton = Parameters<typeof Button<'a'>>[0];
    type FieldsetPanel = Parameters<typeof Panel<'fieldset'>>[0];
    type LabelText = Parameters<typeof Text<'label'>>[0];
    expectTypeOf<NativeButton>().not.toHaveProperty('href');
    expectTypeOf<AnchorButton>().toHaveProperty('href');
    expectTypeOf<NonNullable<NativeButton['onClick']>>().toEqualTypeOf<React.MouseEventHandler<HTMLButtonElement>>();
    expectTypeOf<NonNullable<AnchorButton['onClick']>>().toEqualTypeOf<React.MouseEventHandler<HTMLAnchorElement>>();
    expectTypeOf<FieldsetPanel>().toHaveProperty('disabled');
    expectTypeOf<LabelText>().toHaveProperty('htmlFor');
  });
});
