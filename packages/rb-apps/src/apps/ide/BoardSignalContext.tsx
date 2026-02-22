import React, { createContext, useContext, useState, useMemo } from 'react';

export type BoardSignal =
  | { type: 'sw'; index: number }
  | { type: 'ld'; index: number }
  | { type: 'btn'; index: number };

interface BoardSignalContextValue {
  activeBoardSignal: BoardSignal | null;
  setActiveBoardSignal: (sig: BoardSignal | null) => void;
}

const BoardSignalContext = createContext<BoardSignalContextValue | null>(null);

export function BoardSignalProvider({ children }: { children: React.ReactNode }) {
  const [activeBoardSignal, setActiveBoardSignal] = useState<BoardSignal | null>(null);
  const value = useMemo(
    () => ({ activeBoardSignal, setActiveBoardSignal }),
    [activeBoardSignal]
  );
  return <BoardSignalContext.Provider value={value}>{children}</BoardSignalContext.Provider>;
}

export function useBoardSignal(): BoardSignalContextValue {
  const ctx = useContext(BoardSignalContext);
  if (!ctx) throw new Error('useBoardSignal() must be used inside <BoardSignalProvider>');
  return ctx;
}
