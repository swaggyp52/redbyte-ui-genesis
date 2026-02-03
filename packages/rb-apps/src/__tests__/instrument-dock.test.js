import { jsx as _jsx } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstrumentDock, useInstrumentState } from '../../../rb-instruments/src';
const createEmptySource = () => ({
    listSignals: () => [],
    resolveSignal: () => null,
    sample: () => 0,
    getHistory: (_signal, _from, _to, _stride) => [],
});
describe('RB_UNIFY_01: InstrumentDock', () => {
    beforeEach(() => {
        useInstrumentState.getState().setActiveInstrumentId('net-inspector');
        useInstrumentState.getState().setSelectedSignalId(null);
    });
    it('renders tab strip and empty state', () => {
        render(_jsx(InstrumentDock, { signalSource: createEmptySource(), currentTick: 0 }));
        expect(screen.getByText('Net Inspector')).toBeInTheDocument();
        expect(screen.getByText('Scope')).toBeInTheDocument();
        expect(screen.getByText('Probe')).toBeInTheDocument();
        expect(screen.getByText('Serial')).toBeInTheDocument();
        expect(screen.getByText('No nets yet.')).toBeInTheDocument();
    });
});
