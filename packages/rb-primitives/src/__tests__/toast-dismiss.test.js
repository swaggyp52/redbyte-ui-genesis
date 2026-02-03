import { jsx as _jsx } from "react/jsx-runtime";
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { ToastContainer } from '../Toast/ToastContainer';
import { toastStore } from '../Toast/toastStore';
describe('Toast dismissal', () => {
    afterEach(() => {
        act(() => {
            toastStore.clear();
        });
        vi.useRealTimers();
    });
    it('removes toast after dismiss animation', () => {
        vi.useFakeTimers();
        const { getByText, queryByText } = render(_jsx(ToastContainer, {}));
        act(() => {
            toastStore.add({
                kind: 'info',
                message: 'Persistent toast',
            });
        });
        expect(getByText('Persistent toast')).toBeTruthy();
        const dismissButton = document.querySelector('button[aria-label="Dismiss notification"]');
        expect(dismissButton).toBeTruthy();
        act(() => {
            fireEvent.click(dismissButton);
            vi.advanceTimersByTime(350);
        });
        expect(queryByText('Persistent toast')).toBeNull();
    });
});
