// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { UserManualApp } from '../apps/UserManualApp';

const UserManualComponent = UserManualApp.component;

describe('UserManualApp', () => {
  it('renders a known manual heading', () => {
    render(<UserManualComponent />);
    expect(screen.getByRole('heading', { name: /What RedByte Is/i })).toBeInTheDocument();
  });

  it('opens a demo link with confirmation', async () => {
    const user = userEvent.setup();
    const onOpenApp = vi.fn();

    render(<UserManualComponent onOpenApp={onOpenApp} />);

    await user.click(screen.getByRole('link', { name: /Open Demo: NOT Gate/i }));
    await user.click(screen.getByRole('button', { name: /Load Demo/i }));

    expect(onOpenApp).toHaveBeenCalledWith('logic-playground', { initialExampleId: '15_not-gate' });
  });
});
