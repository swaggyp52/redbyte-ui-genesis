import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { TerminalApp } from '../apps/TerminalApp';
import { SettingsApp } from '../apps/SettingsApp';
import { registerApp } from '../AppRegistry';
const TerminalComponent = TerminalApp.component;
describe('Terminal commands', () => {
    beforeEach(() => {
        localStorage.clear();
        registerApp(SettingsApp);
    });
    it('opens apps via open command', () => {
        const onOpenApp = vi.fn();
        render(_jsx(TerminalComponent, { onOpenApp: onOpenApp }));
        const input = screen.getByLabelText('Terminal command input');
        fireEvent.change(input, { target: { value: 'open settings' } });
        fireEvent.submit(input.closest('form'));
        expect(onOpenApp).toHaveBeenCalledWith('settings');
    });
    it('starts determinism recording via record on', () => {
        const startRecording = vi.fn();
        const determinismRecorder = {
            startRecording,
            stopRecording: vi.fn(),
            isRecording: false,
        };
        const getCurrentCircuit = vi.fn(() => ({ version: 'v1', nodes: [], connections: [] }));
        render(_jsx(TerminalComponent, { determinismRecorder: determinismRecorder, getCurrentCircuit: getCurrentCircuit }));
        const input = screen.getByLabelText('Terminal command input');
        fireEvent.change(input, { target: { value: 'record on' } });
        fireEvent.submit(input.closest('form'));
        expect(startRecording).toHaveBeenCalled();
    });
});
