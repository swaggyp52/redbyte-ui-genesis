import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createFile, updateFile } from '../stores/filesStore';
import { assertAppOutput, getAppInvariants } from '../utils/appInvariants';
import { recordAuditTransition } from '../utils/audit';
import { TerminalApp } from '../apps/TerminalApp';
const BASE_CIRCUIT = { version: 'v1', nodes: [], connections: [] };
beforeEach(() => {
    localStorage.clear();
});
afterEach(() => {
    localStorage.clear();
});
describe('contract enforcement', () => {
    it('rejects file writes without metadata', () => {
        expect(() => createFile('NoMeta', BASE_CIRCUIT, undefined)).toThrow('File metadata is required');
    });
    it('rejects file overwrites without provenance', () => {
        createFile('Design', BASE_CIRCUIT, {
            kind: 'source',
            schema_version: 'v1',
            created_by: 'test-suite',
        });
        expect(() => createFile('Design', BASE_CIRCUIT, {
            kind: 'source',
            schema_version: 'v1',
            created_by: 'test-suite',
        })).toThrow('derived_from');
    });
    it('rejects file updates without derived_from', () => {
        const file = createFile('UpdateMe', BASE_CIRCUIT, {
            kind: 'source',
            schema_version: 'v1',
            created_by: 'test-suite',
        });
        expect(() => updateFile(file.id, BASE_CIRCUIT, {
            kind: 'source',
            schema_version: 'v1',
            created_by: 'test-suite',
        })).toThrow('derived_from');
    });
    it('blocks writes outside registered app invariants', () => {
        const inspector = getAppInvariants('submission-inspector');
        expect(inspector).not.toBeNull();
        expect(() => recordAuditTransition({
            actor: 'submission-inspector',
            scope: 'logic_files',
            action: 'test',
            before: {},
            after: {},
        })).toThrow('not allowed to write');
    });
    it('rejects disallowed app outputs', () => {
        expect(() => assertAppOutput('submission-inspector', 'rb-lab.zip')).toThrow('not allowed');
    });
    it('rejects unregistered terminal commands', async () => {
        const Component = TerminalApp.component;
        render(_jsx(Component, {}));
        const input = screen.getByPlaceholderText('Enter a command');
        fireEvent.change(input, { target: { value: 'unknown-command' } });
        fireEvent.submit(input.closest('form'));
        expect(await screen.findByText('Command not found. Type "help".')).toBeInTheDocument();
    });
});
