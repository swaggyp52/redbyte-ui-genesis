import { jsx as _jsx } from "react/jsx-runtime";
// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopCommandBar } from '../components/TopCommandBar';
describe('clock indicator', () => {
    it('updates tick count and running state', () => {
        const props = {
            isRunning: false,
            onRun: () => { },
            onPause: () => { },
            onStep: () => { },
            tickCount: 3,
            tickRate: 10,
            onTickRateChange: () => { },
            perspective: 'build',
            onPerspectiveChange: () => { },
            onHelp: () => { },
        };
        const { rerender } = render(_jsx(TopCommandBar, { ...props }));
        expect(screen.getByText('T+3')).toBeInTheDocument();
        expect(screen.getByText('Paused')).toBeInTheDocument();
        rerender(_jsx(TopCommandBar, { ...props, isRunning: true, tickCount: 4 }));
        expect(screen.getByText('T+4')).toBeInTheDocument();
        // When running, Hz is shown in multiple places - verify at least one exists
        expect(screen.getAllByText('10Hz').length).toBeGreaterThan(0);
    });
});
