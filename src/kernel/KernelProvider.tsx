import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RBEvents } from "./EventBus";
import {
  getProcesses,
  subscribeToProcesses,
  type RBProcess,
} from "./ProcessManager";

export type NotificationKind = "info" | "success" | "warning" | "error";

export interface KernelNotification {
  id: string;
  title: string;
  body?: string;
  kind: NotificationKind;
  createdAt: number;
  read: boolean;
}

interface KernelSettings {
  theme: "dark" | "light";
  animations: boolean;
}

interface KernelContextValue {
  notifications: KernelNotification[];
  unreadCount: number;
  pushNotification: (input: {
    title: string;
    body?: string;
    kind?: NotificationKind;
  }) => void;
  markAsRead: (id: string) => void;
  clearNotifications: () => void;
  settings: KernelSettings;
  toggleTheme: () => void;
  toggleAnimations: () => void;
  processes: RBProcess[];
}

const KernelContext = createContext<KernelContextValue | null>(null);

let notificationIdCounter = 0;

export function KernelProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<KernelNotification[]>([]);
  const [settings, setSettings] = useState<KernelSettings>({
    theme: "dark",
    animations: true,
  });
  const [processes, setProcesses] = useState<RBProcess[]>(() =>
    getProcesses()
  );

  const pushNotification = useCallback(
    (input: { title: string; body?: string; kind?: NotificationKind }) => {
      const id = `n-${++notificationIdCounter}`;
      const createdAt = Date.now();
      const notification: KernelNotification = {
        id,
        title: input.title,
        body: input.body,
        kind: input.kind ?? "info",
        createdAt,
        read: false,
      };
      setNotifications((prev) => [...prev, notification]);
    },
    []
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === "dark" ? "light" : "dark",
    }));
  }, []);

  const toggleAnimations = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      animations: !prev.animations,
    }));
  }, []);

  // Window lifecycle -> notifications
  useEffect(() => {
    const unsubscribe = RBEvents.subscribe((ev) => {
      if (ev.type === "window:opened") {
        pushNotification({
          title: "Window opened",
          body: ev.title,
          kind: "info",
        });
      } else if (ev.type === "window:closed") {
        pushNotification({
          title: "Window closed",
          body: ev.windowId,
          kind: "warning",
        });
      }
    });

    return unsubscribe;
  }, [pushNotification]);

  // ProcessManager -> processes state
  useEffect(() => {
    const unsubscribe = subscribeToProcesses((procs) => setProcesses(procs));
    return unsubscribe;
  }, []);

  const value: KernelContextValue = {
    notifications,
    unreadCount,
    pushNotification,
    markAsRead,
    clearNotifications,
    settings,
    toggleTheme,
    toggleAnimations,
    processes,
  };

  return (
    <KernelContext.Provider value={value}>{children}</KernelContext.Provider>
  );
}

export function useKernel() {
  const ctx = useContext(KernelContext);
  if (!ctx) {
    throw new Error("useKernel must be used inside KernelProvider");
  }
  return ctx;
}

export function useNotifications() {
  const {
    notifications,
    unreadCount,
    pushNotification,
    markAsRead,
    clearNotifications,
  } = useKernel();

  return {
    notifications,
    unreadCount,
    pushNotification,
    markAsRead,
    clearNotifications,
  };
}
/* --- RVFS BOOTSTRAP --- */
import { loadFS } from "../fs/RVFS";

loadFS(); // load or initialize FS at kernel boot
/* ------------------------ */


























