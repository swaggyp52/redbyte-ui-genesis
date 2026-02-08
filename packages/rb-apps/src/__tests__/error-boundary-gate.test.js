import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { RbUserError } from '@redbyte/rb-utils';
import { ErrorBoundary } from '../components/ErrorBoundary';
describe('ErrorBoundary gate (student-friendly + recovery)', () => {
    it('renders student-friendly message and recovers via Reload App', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
        let shouldThrow = true;
        const Boom = () => {
            if (shouldThrow) {
                throw new RbUserError('BRIDGE_UNREACHABLE');
            }
            return _jsx("div", { "data-testid": "ok", children: "OK" });
        };
        const { getByText, queryByTestId } = render(_jsx(ErrorBoundary, { fallbackTitle: "Test Boundary", children: _jsx(Boom, {}) }));
        expect(getByText('Test Boundary')).toBeTruthy();
        expect(getByText(/RedByte Bridge Unreachable/i)).toBeTruthy();
        expect(getByText('Reload App')).toBeTruthy();
        expect(getByText('Copy Error Details')).toBeTruthy();
        expect(getByText('Reload Page')).toBeTruthy();
        act(() => {
            shouldThrow = false;
            fireEvent.click(getByText('Reload App'));
        });
        expect(queryByTestId('ok')).toBeTruthy();
        consoleError.mockRestore();
    });
});
