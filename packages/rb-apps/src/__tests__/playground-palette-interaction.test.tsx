// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogicPlaygroundApp } from '../apps/LogicPlaygroundApp';
import { useCircuitStore } from '../stores/circuitStore';
import { useFileSystemStore } from '../stores/fileSystemStore';

// Mock dependencies
vi.mock('@redbyte/rb-shell', () => ({
  useToastStore: () => ({ addToast: vi.fn() }),
}));

vi.mock('@redbyte/rb-utils', () => ({
  useSettingsStore: () => ({ tickRate: 1 }),
}));

vi.mock('@redbyte/rb-windowing', () => ({
  useWindowStore: vi.fn(() => ({ setWindowTitle: vi.fn() })),
}));

vi.mock('../tutorial/tutorialStore', () => ({
  useTutorialStore: () => ({ active: false, start: vi.fn() }),
}));

describe('Playground - Palette Interaction (PR0 Baseline)', () => {
  beforeEach(() => {
    // Clear state
    localStorage.clear();
    const { resetAll } = useFileSystemStore.getState();
    resetAll();
    const { reset } = useCircuitStore.getState();
    reset();
  });

  it('should add node to circuit when palette component is clicked', async () => {
    const user = userEvent.setup();

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render by checking for Step button (stable UI element)
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Get initial circuit state
    const initialNodeCount = useCircuitStore.getState().circuit.nodes.length;

    // Find AND gate in palette (may appear multiple times due to favorites/recents)
    const andButtons = screen.getAllByText(/^AND$/);
    await user.click(andButtons[0]);

    // Verify node was added to store
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBe(initialNodeCount + 1);
      expect(circuit.nodes[circuit.nodes.length - 1].type).toBe('AND');
    });
  });

  it('should have engines connected when circuit mutations occur', async () => {
    const consoleSpy = vi.spyOn(console, 'warn');

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for UI to render (using stable element)
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Wait for engines to be initialized
    await waitFor(() => {
      const { engine, tickEngine } = useCircuitStore.getState();
      expect(engine).not.toBeNull();
      expect(tickEngine).not.toBeNull();
    });

    // Add a node via store (direct call to test invariant)
    useCircuitStore.getState().addNode('AND', { x: 100, y: 100 });

    // Verify circuit was updated
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.length).toBeGreaterThan(0);
    });

    // In dev mode, the warning should NOT appear because engines are connected
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[CircuitStore] Circuit mutation called but engines not connected')
    );

    consoleSpy.mockRestore();
  });

  it('should render Half Adder example without errors', async () => {
    // This test verifies the canonical reference example loads correctly
    const { loadExample } = await import('../examples');
    const halfAdder = await loadExample('03_half-adder');

    expect(halfAdder).toBeDefined();
    expect(halfAdder.nodes).toHaveLength(6); // 2 switches, 2 gates, 2 lamps
    expect(halfAdder.connections).toHaveLength(6);

    // Verify it has the expected structure
    const switchNodes = halfAdder.nodes.filter(n => n.type === 'Switch');
    const xorNodes = halfAdder.nodes.filter(n => n.type === 'XOR');
    const andNodes = halfAdder.nodes.filter(n => n.type === 'AND');
    const lampNodes = halfAdder.nodes.filter(n => n.type === 'Lamp');

    expect(switchNodes).toHaveLength(2);
    expect(xorNodes).toHaveLength(1);
    expect(andNodes).toHaveLength(1);
    expect(lampNodes).toHaveLength(2);
  });

  // PR1 Tests: Palette Search + Recents + Favorites
  it('should filter components by search query', async () => {
    const user = userEvent.setup();

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Find search input
    const searchInput = screen.getByPlaceholderText(/Search components/i);
    expect(searchInput).toBeInTheDocument();

    // Type "and" in search
    await user.type(searchInput, 'and');

    // Verify search results appear
    await waitFor(() => {
      expect(screen.getByText(/SEARCH RESULTS/i)).toBeInTheDocument();
    });

    // Verify AND gate is in filtered results
    const andButtons = screen.getAllByText(/^AND$/);
    expect(andButtons.length).toBeGreaterThan(0);

    // Verify NAND gate also appears (contains "and")
    expect(screen.getByText(/^NAND$/)).toBeInTheDocument();
  });

  it('should persist recents after adding components', async () => {
    const user = userEvent.setup();

    // Clear localStorage before test
    localStorage.removeItem('rb-component-recent');

    const Component = LogicPlaygroundApp.component;
    render(<Component />);

    // Wait for palette to render
    await waitFor(() => {
      expect(screen.getByTitle(/Step Once/i)).toBeInTheDocument();
    });

    // Click OR gate (get first occurrence in case it's in favorites)
    const orButtons = screen.getAllByText(/^OR$/);
    await user.click(orButtons[0]);

    // Verify OR was added to circuit
    await waitFor(() => {
      const circuit = useCircuitStore.getState().circuit;
      expect(circuit.nodes.some(n => n.type === 'OR')).toBe(true);
    });

    // Verify recents were persisted to localStorage
    const savedRecents = localStorage.getItem('rb-component-recent');
    expect(savedRecents).toBeTruthy();
    const recents = JSON.parse(savedRecents!);
    expect(recents).toContain('OR');
  });
});
