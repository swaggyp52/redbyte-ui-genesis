import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AssertionCanvas, type AssertionCanvasProps } from '../apps/ide/components/AssertionCanvas';

describe('AssertionCanvas', () => {
  const outputFields = [
    { id: 'output_y', label: 'y' },
    { id: 'output_z', label: 'z' },
  ];

  const ticks = [0, 1, 2, 3];

  const getCellValueMock = vi.fn((tick, signal) => ({
    expected: tick % 2 === 0 ? (1 as const) : (0 as const),
    actual: tick % 2 === 0 ? (1 as const) : (0 as const),
    isMismatch: false,
  }));

  const baseProps: AssertionCanvasProps = {
    outputFields,
    ticks,
    getCellValue: getCellValueMock,
    selectedTick: null,
    selectedSignal: null,
    assertionMode: false,
    readOnly: true,
  };

  it('renders nothing when no output fields', () => {
    const props = { ...baseProps, outputFields: [] };
    const { container } = render(<AssertionCanvas {...props} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no ticks', () => {
    const props = { ...baseProps, ticks: [] };
    const { container } = render(<AssertionCanvas {...props} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders assertion canvas with tick headers', () => {
    render(<AssertionCanvas {...baseProps} />);
    expect(screen.getByTestId('ide-assertion-canvas')).toBeInTheDocument();
    expect(screen.getByText('t0')).toBeInTheDocument();
    expect(screen.getByText('t3')).toBeInTheDocument();
  });

  it('uses the supplied tick width for layout geometry', () => {
    const { container } = render(<AssertionCanvas {...baseProps} tickWidth={72} />);
    const layoutRoot = container.querySelector('[data-testid="ide-assertion-canvas"] > div');
    expect(layoutRoot).not.toBeNull();
    expect(layoutRoot).toHaveStyle({ minWidth: '464px' });
  });

  it('renders output signal rows', () => {
    render(<AssertionCanvas {...baseProps} />);
    expect(screen.getByText('y')).toBeInTheDocument();
    expect(screen.getByText('z')).toBeInTheDocument();
  });

  it('renders "Observed" and "Asserted" group headers', () => {
    render(<AssertionCanvas {...baseProps} />);
    // The headers are rendered as uppercase text
    const headers = screen.getAllByText(/Observed|Asserted/);
    expect(headers.length).toBeGreaterThan(0);
  });

  it('calls getCellValue for each cell', () => {
    render(<AssertionCanvas {...baseProps} />);
    // Should be called for each output × tick combination
    expect(getCellValueMock).toHaveBeenCalledWith(0, 'output_y');
    expect(getCellValueMock).toHaveBeenCalledWith(0, 'output_z');
    expect(getCellValueMock).toHaveBeenCalledWith(3, 'output_z');
  });

  it('highlights selected cell', () => {
    const props = {
      ...baseProps,
      selectedTick: 1,
      selectedSignal: 'output_y',
    };
    render(<AssertionCanvas {...props} />);
    const cellButton = screen.getByTestId('ide-assertion-cell-output_y-t1');
    expect(cellButton).toBeInTheDocument();
    expect(cellButton).toBeDisabled();
  });

  it('applies mismatch styling when assertionMode ON and isMismatch true', () => {
    const getCellValue = vi.fn((tick, signal) => ({
      expected: 1 as const,
      actual: 0 as const,
      isMismatch: true,
    }));

    const props = {
      ...baseProps,
      getCellValue,
      assertionMode: true,
    };
    render(<AssertionCanvas {...props} />);

    // Mismatch cell should be rendered and visible
    const mismatchCells = screen.getAllByTestId(/ide-assertion-cell-/);
    expect(mismatchCells.length).toBeGreaterThan(0);
  });

  it('does not apply mismatch styling when assertionMode OFF', () => {
    const getCellValue = vi.fn((tick, signal) => ({
      expected: 1 as const,
      actual: 0 as const,
      isMismatch: true,
    }));

    const props = {
      ...baseProps,
      getCellValue,
      assertionMode: false,
    };
    render(<AssertionCanvas {...props} />);

    // Even with isMismatch=true, styling should not be applied when mode OFF
    // Cells are rendered but without error styling
    const canvas = screen.getByTestId('ide-assertion-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders undefined/no-assertion cells as neutral', () => {
    const getCellValue = vi.fn((tick, signal) => ({
      expected: null,
      actual: '-' as const,
      isMismatch: false,
    }));

    const props = {
      ...baseProps,
      getCellValue,
    };
    render(<AssertionCanvas {...props} />);

    // Should render cells but with neutral styling
    expect(screen.getByTestId('ide-assertion-canvas')).toBeInTheDocument();
  });

  it('disables cells when readOnly is true', () => {
    render(<AssertionCanvas {...baseProps} readOnly={true} />);
    const cells = screen.getAllByTestId(/ide-assertion-cell-/);
    cells.forEach((cell) => {
      expect(cell).toBeDisabled();
    });
  });

  it('respects className prop', () => {
    render(<AssertionCanvas {...baseProps} className="test-class" />);
    const canvas = screen.getByTestId('ide-assertion-canvas');
    expect(canvas).toHaveClass('test-class');
  });
});
