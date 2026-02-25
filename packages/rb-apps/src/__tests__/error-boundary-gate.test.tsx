import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { RbUserError } from '@redbyte/rb-utils';
import { ErrorBoundary } from '../components/ErrorBoundary';

describe('ErrorBoundary gate (student-friendly + recovery)', () => {
  it('renders student-friendly message and recovers via Try Again', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    const Boom: React.FC = () => {
      if (shouldThrow) {
        throw new RbUserError('BRIDGE_UNREACHABLE');
      }
      return <div data-testid="ok">OK</div>;
    };

    const { getByText, queryByTestId } = render(
      <ErrorBoundary fallbackTitle="Test Boundary">
        <Boom />
      </ErrorBoundary>
    );

    expect(getByText('Test Boundary')).toBeTruthy();
    expect(getByText(/RedByte Bridge Unreachable/i)).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
    expect(getByText('Copy Error Details')).toBeTruthy();
    expect(getByText('Reset Workspace')).toBeTruthy();

    act(() => {
      shouldThrow = false;
      fireEvent.click(getByText('Try Again'));
    });

    expect(queryByTestId('ok')).toBeTruthy();
    consoleError.mockRestore();
  });
});
