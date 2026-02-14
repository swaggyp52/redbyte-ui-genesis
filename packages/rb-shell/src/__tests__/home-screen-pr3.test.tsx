import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomeScreen } from '../HomeScreen';

describe('HomeScreen PR3 hero contract', () => {
  it('renders focused hero and opens dashboard/studio actions', () => {
    const onOpenApp = vi.fn();

    render(
      <HomeScreen
        onOpenApp={onOpenApp}
        onOpenExample={vi.fn()}
        determinismMode="live"
        tickCount={0}
        isRecording={false}
        hasRecording={false}
        logEntryCount={0}
        hasProofPack={false}
      />
    );

    expect(screen.getByText('RedByte Studio')).toBeInTheDocument();
    expect(screen.getByText('Digital Logic Lab Environment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Studio' }));

    expect(onOpenApp).toHaveBeenCalledWith('home');
    expect(onOpenApp).toHaveBeenCalledWith('lab-workspace');

    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Simulate')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});
