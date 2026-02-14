import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dock } from '../Dock';
import { useWindowStore } from '@redbyte/rb-windowing';

describe('Dock PR3 curation', () => {
  beforeEach(() => {
    localStorage.clear();
    useWindowStore.setState({ windows: [], nextZIndex: 1 });
  });

  it('shows only golden-path + secondary dock entries', () => {
    const onOpenApp = vi.fn();
    render(<Dock onOpenApp={onOpenApp} />);

    const expectedIds = ['home', 'lab-workspace', 'logic-playground', 'settings', 'files'];
    expectedIds.forEach((id) => {
      expect(screen.getByTestId(`dock-icon-${id}`)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('dock-icon-launcher')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dock-icon-terminal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dock-icon-home'));
    fireEvent.click(screen.getByTestId('dock-icon-lab-workspace'));

    expect(onOpenApp).toHaveBeenCalledWith('home');
    expect(onOpenApp).toHaveBeenCalledWith('lab-workspace');
  });
});
