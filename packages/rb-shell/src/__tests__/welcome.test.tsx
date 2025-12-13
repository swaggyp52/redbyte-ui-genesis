// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeWindow } from '../WelcomeWindow';

describe('WelcomeWindow', () => {
  const mockOnClose = vi.fn();
  const mockOnExploreStudio = vi.fn();
  const mockOnOpenPlayground = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the welcome window', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    expect(screen.getByTestId('welcome-window')).toBeInTheDocument();
    expect(screen.getByText('Welcome to RedByte OS Genesis')).toBeInTheDocument();
    expect(screen.getByText(/Build • Simulate • Understand/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    fireEvent.click(screen.getByTestId('welcome-close'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onExploreStudio when Explore Studio button is clicked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    fireEvent.click(screen.getByTestId('welcome-explore-studio'));
    expect(mockOnExploreStudio).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenPlayground when Open Logic Playground button is clicked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    fireEvent.click(screen.getByTestId('welcome-open-playground'));
    expect(mockOnOpenPlayground).toHaveBeenCalledTimes(1);
  });

  it('persists dismissal when "Don\'t show again" is checked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    const checkbox = screen.getByTestId('welcome-dont-show-again');
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByTestId('welcome-close'));

    expect(localStorage.getItem('rb-os:v1:welcomeSeen')).toBe('true');
  });

  it('does not persist dismissal when checkbox is not checked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    fireEvent.click(screen.getByTestId('welcome-close'));

    expect(localStorage.getItem('rb-os:v1:welcomeSeen')).toBeNull();
  });

  it('persists dismissal when opening studio with checkbox checked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    const checkbox = screen.getByTestId('welcome-dont-show-again');
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByTestId('welcome-explore-studio'));

    expect(localStorage.getItem('rb-os:v1:welcomeSeen')).toBe('true');
    expect(mockOnExploreStudio).toHaveBeenCalledTimes(1);
  });

  it('persists dismissal when opening playground with checkbox checked', () => {
    render(
      <WelcomeWindow
        onClose={mockOnClose}
        onExploreStudio={mockOnExploreStudio}
        onOpenPlayground={mockOnOpenPlayground}
      />
    );

    const checkbox = screen.getByTestId('welcome-dont-show-again');
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByTestId('welcome-open-playground'));

    expect(localStorage.getItem('rb-os:v1:welcomeSeen')).toBe('true');
    expect(mockOnOpenPlayground).toHaveBeenCalledTimes(1);
  });
});
