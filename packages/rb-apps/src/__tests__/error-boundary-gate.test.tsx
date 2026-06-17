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
    expect(queryByTestId('error-boundary-try-again')).toBeTruthy();
    expect(queryByTestId('error-boundary-reset-workspace')).toBeTruthy();
    expect(queryByTestId('error-boundary-copy-details')).toBeTruthy();

    act(() => {
      shouldThrow = false;
      fireEvent.click(getByText('Try Again'));
    });

    expect(queryByTestId('ok')).toBeTruthy();
    consoleError.mockRestore();
  });

  it('classifies failed lazy surface imports and offers non-destructive reload recovery', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const LazyImportFailure: React.FC = () => {
      throw new TypeError(
        'Failed to fetch dynamically imported module: http://127.0.0.1:5207/os/assets/DesignSurface-stale.js'
      );
    };

    const { getByText, queryByTestId } = render(
      <ErrorBoundary fallbackTitle="Design workspace encountered an error">
        <LazyImportFailure />
      </ErrorBoundary>
    );

    const boundary = queryByTestId('error-boundary-fallback');
    expect(boundary).toBeTruthy();
    expect(boundary?.getAttribute('data-error-kind')).toBe('surface-load');
    expect(getByText('Design workspace encountered an error')).toBeTruthy();
    expect(getByText(/old app file/i)).toBeTruthy();
    expect(queryByTestId('error-boundary-reload-app')).toBeTruthy();
    expect(queryByTestId('error-boundary-reset-workspace')).toBeTruthy();
    expect(queryByTestId('error-boundary-copy-details')).toBeTruthy();
    expect(queryByTestId('error-boundary-try-again')).toBeNull();

    consoleError.mockRestore();
  });
});
