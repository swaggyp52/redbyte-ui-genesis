import React, { createContext, useContext, useState, useMemo } from 'react';

export type BoardSignal =
  | { type: 'sw'; index: number }
  | { type: 'ld'; index: number }
  | { type: 'btn'; index: number };

export function resolveBoardSignal(value: string | null | undefined): BoardSignal | null {
  const label = (value ?? '').trim();
  if (!label) return null;
  const swMatch = /^sw(\d+)$/i.exec(label);
  if (swMatch) return { type: 'sw', index: Number.parseInt(swMatch[1], 10) };
  const ldMatch = /^ld(\d+)$/i.exec(label);
  if (ldMatch) return { type: 'ld', index: Number.parseInt(ldMatch[1], 10) };
  const btnMatch = /^btn(c|u|d|l|r)$/i.exec(label);
  if (btnMatch) {
    const indexMap: Record<string, number> = { c: 0, u: 1, d: 2, l: 3, r: 4 };
    return { type: 'btn', index: indexMap[btnMatch[1].toLowerCase()] };
  }
  return null;
}

interface BoardSignalContextValue {
  activeBoardSignal: BoardSignal | null;
  hoverBoardSignal: BoardSignal | null;
  setActiveBoardSignal: (sig: BoardSignal | null) => void;
  setHoverBoardSignal: (sig: BoardSignal | null) => void;
}

const BoardSignalContext = createContext<BoardSignalContextValue | null>(null);
const BOARD_SIGNAL_CONTEXT_FALLBACK: BoardSignalContextValue = {
  activeBoardSignal: null,
  hoverBoardSignal: null,
  setActiveBoardSignal: () => undefined,
  setHoverBoardSignal: () => undefined,
};

export function BoardSignalProvider({ children }: { children: React.ReactNode }) {
  const [activeBoardSignal, setActiveBoardSignal] = useState<BoardSignal | null>(null);
  const [hoverBoardSignal, setHoverBoardSignal] = useState<BoardSignal | null>(null);
  const value = useMemo(
    () => ({ activeBoardSignal, hoverBoardSignal, setActiveBoardSignal, setHoverBoardSignal }),
    [activeBoardSignal, hoverBoardSignal]
  );
  return <BoardSignalContext.Provider value={value}>{children}</BoardSignalContext.Provider>;
}

export function useBoardSignal(): BoardSignalContextValue {
  return useContext(BoardSignalContext) ?? BOARD_SIGNAL_CONTEXT_FALLBACK;
}
