import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { DaySnapshot, DiaryEntry, Dismissal, Food, FoodVersion, GoalTemplateDto, Recipe, RecipeVersion, SavedMeal, SessionInfo, User } from '@daily-plate/contracts';
import { virtualDaySnapshot } from '@daily-plate/contracts';
import { localDateFor } from '@daily-plate/domain';
import { ApiClient, ApiError, OfflineError } from './api.js';
import { getDb, getMeta, requestPersistentStorage, type DailyPlateDb, type OutboxItem } from './db.js';
import { attachLifecycle, SyncEngine, type SyncStatus } from './sync.js';
import { useRoute, type Route } from './router.js';

export type AuthState = 'checking' | 'signed-out' | 'signed-in' | 'locked';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void | Promise<void> };
}

export interface AddIntent {
  /** Draft entry to resolve into a real food. */
  resolveEntryId?: string;
  /** Text to prefill in search. */
  query?: string;
}

export interface AppState {
  db: DailyPlateDb;
  api: ApiClient;
  engine: SyncEngine;
  sync: SyncStatus;
  auth: AuthState;
  session: SessionInfo | null;
  user: User | null;
  goals: GoalTemplateDto | null;
  foods: Food[];
  foodMap: Map<string, Food>;
  versions: Map<string, FoodVersion>;
  entries: DiaryEntry[];
  days: Map<string, DaySnapshot>;
  meals: SavedMeal[];
  recipes: Recipe[];
  recipeVersions: RecipeVersion[];
  dismissals: Dismissal[];
  outbox: OutboxItem[];
  today: string;
  timeZone: string;
  /** The diary day currently shown; Add Food adds to this day. */
  viewDate: string;
  setViewDate: (localDate: string) => void;
  addIntent: AddIntent | null;
  setAddIntent: (intent: AddIntent | null) => void;
  /** True while the one-time setup flow is on screen, even after the targets are confirmed. */
  setupActive: boolean;
  setSetupActive: (active: boolean) => void;
  route: Route;
  navigate: (route: Route) => void;
  toast: (message: string, action?: Toast['action']) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  dayFor: (localDate: string) => DaySnapshot;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
  bootstrapNow: () => Promise<void>;
  storagePersisted: boolean | null;
  updateReady: boolean;
  applyUpdate: () => void;
  setUpdateHooks: (ready: boolean, apply: () => void) => void;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useMemo(() => getDb(), []);
  const [auth, setAuth] = useState<AuthState>('checking');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ state: 'idle', pending: 0, attention: 0, lastSyncAt: null, lastError: null });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const applyRef = useRef<() => void>(() => undefined);
  const toastId = useRef(0);
  const [route, navigate] = useRoute();

  const api = useMemo(() => new ApiClient({ onUnauthenticated: () => setAuth((a) => (a === 'signed-in' ? 'locked' : a)) }), []);
  const engine = useMemo(() => new SyncEngine(db, api), [db, api]);

  useEffect(() => engine.subscribe(setSync), [engine]);
  useEffect(() => attachLifecycle(engine), [engine]);

  const user = useLiveQuery(() => getMeta<User>(db, 'user'), [db]) ?? null;
  const goals = useLiveQuery(() => getMeta<GoalTemplateDto>(db, 'goals'), [db]) ?? null;
  const foods = useLiveQuery(() => db.foods.toArray(), [db]) ?? [];
  const versionList = useLiveQuery(() => db.foodVersions.toArray(), [db]) ?? [];
  const entries = useLiveQuery(() => db.entries.toArray(), [db]) ?? [];
  const dayList = useLiveQuery(() => db.days.toArray(), [db]) ?? [];
  const meals = useLiveQuery(() => db.meals.toArray(), [db]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), [db]) ?? [];
  const recipeVersions = useLiveQuery(() => db.recipeVersions.toArray(), [db]) ?? [];
  const dismissals = useLiveQuery(() => db.dismissals.toArray(), [db]) ?? [];
  const outbox = useLiveQuery(() => db.outbox.toArray(), [db]) ?? [];

  const timeZone = user?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const [today, setToday] = useState(() => localDateFor(new Date(), timeZone));
  useEffect(() => {
    const tick = (): void => setToday(localDateFor(new Date(), timeZone));
    tick();
    const i = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(i);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [timeZone]);

  const [viewDateRaw, setViewDate] = useState<string | null>(null);
  const viewDate = viewDateRaw ?? today;
  const [addIntent, setAddIntent] = useState<AddIntent | null>(null);
  const [setupActive, setSetupActive] = useState(false);

  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const versions = useMemo(() => new Map(versionList.map((v) => [v.id, v])), [versionList]);
  const days = useMemo(() => new Map(dayList.map((d) => [d.localDate, d])), [dayList]);

  const dayFor = useCallback(
    (localDate: string): DaySnapshot => {
      const persisted = days.get(localDate);
      if (persisted) return persisted;
      if (goals && user) return virtualDaySnapshot(goals, user, localDate);
      return { localDate, dayType: 'rest', targets: { protein: '140', carbs: '130', fat: '45' }, secondary: {}, templateRevision: 0, revision: 0, updatedAt: '' };
    },
    [days, goals, user],
  );

  const refreshSession = useCallback(async () => {
    try {
      const s = await api.session();
      setSession(s);
      if (s.authenticated) {
        setAuth('signed-in');
        const localUser = await getMeta<User>(db, 'user');
        if (!localUser || localUser.id !== s.userId) await engine.bootstrap();
        void engine.sync();
      } else {
        const localUser = await getMeta<User>(db, 'user');
        setAuth(localUser ? 'locked' : 'signed-out');
      }
    } catch (err) {
      if (err instanceof OfflineError) {
        const localUser = await getMeta<User>(db, 'user');
        setAuth(localUser ? 'signed-in' : 'signed-out');
        // Let the engine count pending work and arm its retry even though we are offline.
        void engine.sync();
      } else if (err instanceof ApiError && err.status === 401) {
        const localUser = await getMeta<User>(db, 'user');
        setAuth(localUser ? 'locked' : 'signed-out');
      } else {
        setAuth('signed-out');
      }
    }
  }, [api, db, engine]);

  useEffect(() => {
    void refreshSession();
    void requestPersistentStorage().then(setStoragePersisted);
  }, [refreshSession]);

  const toast = useCallback((message: string, action?: Toast['action']) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-1), action ? { id, message, action } : { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 7000 : 3500);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* offline logout still clears the session locally */
    }
    setSession({ authenticated: false });
    setAuth('locked');
  }, [api]);

  const bootstrapNow = useCallback(async () => {
    await engine.bootstrap();
  }, [engine]);

  const setUpdateHooks = useCallback((ready: boolean, apply: () => void) => {
    applyRef.current = apply;
    setUpdateReady(ready);
  }, []);

  const value: AppState = {
    db,
    api,
    engine,
    sync,
    auth,
    session,
    user,
    goals,
    foods,
    foodMap,
    versions,
    entries,
    days,
    meals,
    recipes,
    recipeVersions,
    dismissals,
    outbox,
    today,
    timeZone,
    viewDate,
    setViewDate: (d) => setViewDate(d === today ? null : d),
    addIntent,
    setAddIntent,
    setupActive,
    setSetupActive,
    route,
    navigate,
    toast,
    toasts,
    dismissToast,
    dayFor,
    refreshSession,
    signOut,
    bootstrapNow,
    storagePersisted,
    updateReady,
    applyUpdate: () => applyRef.current(),
    setUpdateHooks,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
