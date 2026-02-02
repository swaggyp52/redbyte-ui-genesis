// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Global Modal Manager — prevents overlapping modals and manages modal z-index ordering
 *
 * Purpose:
 * - Ensure only one modal is open at a time (or controlled stack)
 * - Automatic z-index management
 * - Keyboard escape handling
 * - Focus management
 */

export type ModalId = 
  | 'open-with'
  | 'import-project'
  | 'export-project'
  | 'examples-picker'
  | 'settings'
  | 'onboarding'
  | 'about'
  | 'bitstream-provenance'
  | string;

interface ModalState {
  id: ModalId;
  priority: number;
}

interface ModalManagerState {
  /** Stack of open modals */
  stack: ModalState[];
  /** Current topmost modal (if any) */
  topModal: ModalId | null;
  
  /** Open a modal (closes other non-persistent modals) */
  open: (id: ModalId, priority?: number) => void;
  
  /** Close a specific modal */
  close: (id: ModalId) => void;
  
  /** Close the topmost modal */
  closeTop: () => void;
  
  /** Close all modals */
  closeAll: () => void;
  
  /** Check if a modal is currently open */
  isOpen: (id: ModalId) => boolean;
  
  /** Get z-index for a modal */
  getZIndex: (id: ModalId) => number;
}

const BASE_Z_INDEX = 100;

export const useModalManager = create<ModalManagerState>((set, get) => ({
  stack: [],
  topModal: null,

  open: (id, priority = 10) => {
    set((state) => {
      // Remove if already in stack
      const newStack = state.stack.filter((m) => m.id !== id);
      
      // Add new modal
      newStack.push({ id, priority });
      
      // Sort by priority
      newStack.sort((a, b) => a.priority - b.priority);
      
      return {
        stack: newStack,
        topModal: newStack.length > 0 ? newStack[newStack.length - 1].id : null,
      };
    });
  },

  close: (id) => {
    set((state) => {
      const newStack = state.stack.filter((m) => m.id !== id);
      return {
        stack: newStack,
        topModal: newStack.length > 0 ? newStack[newStack.length - 1].id : null,
      };
    });
  },

  closeTop: () => {
    const { topModal } = get();
    if (topModal) {
      get().close(topModal);
    }
  },

  closeAll: () => {
    set({ stack: [], topModal: null });
  },

  isOpen: (id) => {
    return get().stack.some((m) => m.id === id);
  },

  getZIndex: (id) => {
    const state = get();
    const index = state.stack.findIndex((m) => m.id === id);
    if (index === -1) return 0;
    return BASE_Z_INDEX + index * 10;
  },
}));

/**
 * Hook: Close modal on Escape key
 * Usage: useCloseModalOnEscape('modal-id')
 */
export const useCloseModalOnEscape = (modalId: ModalId) => {
  const { closeTop, topModal } = useModalManager();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && topModal === modalId) {
        closeTop();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [topModal, modalId, closeTop]);
};

