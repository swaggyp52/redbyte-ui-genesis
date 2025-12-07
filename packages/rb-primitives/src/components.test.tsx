import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Input, Menu, Panel, Select, Text, Toggle, Tooltip } from './components';

describe('rb-primitives', () => {
  it('supports polymorphic Button with keyboard activation', async () => {
    const onClick = vi.fn();
    render(
      <Button as="a" href="#" onClick={onClick}>
        Link Button
      </Button>,
    );

    const button = screen.getByText('Link Button');
    await userEvent.type(button, '{space}');
    expect(onClick).toHaveBeenCalled();
  });

  it('renders Panel content', () => {
    render(
      <Panel interactive>
        <Text as="p">Panel Body</Text>
      </Panel>,
    );
    expect(screen.getByText('Panel Body')).toBeInTheDocument();
  });

  it('displays tooltip content on hover', async () => {
    render(
      <Tooltip content="Helpful tip">
        <Button>Hover me</Button>
      </Tooltip>,
    );
    await userEvent.hover(screen.getByText('Hover me'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful tip');
  });

  it('allows keyboard navigation in Menu', async () => {
    const onSelect = vi.fn();
    render(
      <Menu
        items={[
          { id: 'first', label: 'First' },
          { id: 'second', label: 'Second' },
        ]}
        onSelect={onSelect}
      />,
    );

    const menu = screen.getByRole('menu');
    await userEvent.type(menu, '{arrowdown}{enter}');
    expect(onSelect).toHaveBeenCalledWith('second');
  });

  it('links Input with label', () => {
    render(<Input label="Name" defaultValue="A" />);
    expect(screen.getByLabelText('Name')).toHaveValue('A');
  });

  it('toggles switch state via click and keyboard', async () => {
    const onChange = vi.fn();
    render(<Toggle onChange={onChange} />);
    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
    await userEvent.type(toggle, '{space}');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('selects options with keyboard', async () => {
    const onChange = vi.fn();
    render(
      <Select
        options={[
          { label: 'Alpha', value: 'a' },
          { label: 'Beta', value: 'b' },
        ]}
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);
    await userEvent.type(trigger, '{arrowdown}{enter}');
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
