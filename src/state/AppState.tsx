import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "dark" | "light";

type Notification = {
  id: number;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

type AppContextValue = {
  user: string | null;
  token: string | null;
  theme: Theme;
  notifications: Notification[];
  login: (email: string) => void;
  logout: () => void;
  toggleTheme: () => void;
  markNotificationRead: (id: number) => void;
  markAllRead: () => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // hydrate from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedUser = localStorage.getItem("rb-user");
    const savedToken = localStorage.getItem("rb-token");
    const savedTheme = localStorage.getItem("rb-theme") as Theme | null;

    if (savedUser) setUser(savedUser);
    if (savedToken) setToken(savedToken);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // sync theme to DOM + localStorage
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("rb-theme", theme);
  }, [theme]);

  const login = (email: string) => {
    const fakeToken = "rb-" + btoa(email + "-" + Date.now().toString());
    setUser(email);
    setToken(fakeToken);
    localStorage.setItem("rb-user", email);
    localStorage.setItem("rb-token", fakeToken);

    setNotifications((prev) => [
      {
        id: Date.now(),
        title: "Welcome back",
        body: "You just signed into RedByte UI Genesis.",
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("rb-user");
    localStorage.removeItem("rb-token");
  };

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  const markNotificationRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        theme,
        notifications,
        login,
        logout,
        toggleTheme,
        markNotificationRead,
        markAllRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

