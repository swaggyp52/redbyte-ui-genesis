import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import {
  WindowCloseIcon,
  WindowMinimizeIcon,
  WindowMaximizeIcon,
  LogicAndIcon,
  LogicOrIcon,
  LogicNotIcon,
  LogicXorIcon,
  LogicNandIcon,
  LogicNorIcon,
  LogicXnorIcon,
  TerminalIcon,
  FolderIcon,
  SettingsIcon,
  CalculatorIcon,
  CodeIcon,
  BrowserIcon,
  ImageIcon,
  MusicIcon,
  DocumentIcon,
} from './index';

describe('@redbyte/rb-icons', () => {
  describe('Window management icons', () => {
    it('renders WindowCloseIcon', () => {
      const { container } = render(<WindowCloseIcon data-testid="icon" />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg?.getAttribute('fill')).toBe('currentColor');
    });

    it('renders WindowMinimizeIcon', () => {
      const { container } = render(<WindowMinimizeIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders WindowMaximizeIcon', () => {
      const { container } = render(<WindowMaximizeIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Logic gate icons', () => {
    it('renders LogicAndIcon', () => {
      const { container } = render(<LogicAndIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders LogicOrIcon', () => {
      const { container } = render(<LogicOrIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders LogicNotIcon', () => {
      const { container } = render(<LogicNotIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders LogicXorIcon', () => {
      const { container } = render(<LogicXorIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders LogicNandIcon', () => {
      const { container } = render(<LogicNandIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders LogicNorIcon', () => {
      const { container } = render(<LogicNorIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders LogicXnorIcon', () => {
      const { container } = render(<LogicXnorIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Dock/taskbar icons', () => {
    it('renders TerminalIcon', () => {
      const { container } = render(<TerminalIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders FolderIcon', () => {
      const { container } = render(<FolderIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders SettingsIcon', () => {
      const { container } = render(<SettingsIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders CalculatorIcon', () => {
      const { container } = render(<CalculatorIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders CodeIcon', () => {
      const { container } = render(<CodeIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders BrowserIcon', () => {
      const { container } = render(<BrowserIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders ImageIcon', () => {
      const { container } = render(<ImageIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders MusicIcon', () => {
      const { container } = render(<MusicIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });

    it('renders DocumentIcon', () => {
      const { container } = render(<DocumentIcon />);
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Icon props', () => {
    it('accepts custom className', () => {
      const { container } = render(<TerminalIcon className="custom-class" />);
      const svg = container.querySelector('svg');
      expect(svg?.classList.contains('custom-class')).toBe(true);
    });

    it('accepts custom width and height', () => {
      const { container } = render(<TerminalIcon width={32} height={32} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('width')).toBe('32');
      expect(svg?.getAttribute('height')).toBe('32');
    });

    it('accepts custom color via style', () => {
      const { container } = render(<TerminalIcon style={{ color: 'red' }} />);
      const svg = container.querySelector('svg');
      expect(svg?.style.color).toBe('red');
    });
  });
});
