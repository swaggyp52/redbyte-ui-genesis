import { useEffect, useState } from 'react';

export type Route = 'today' | 'add' | 'foods' | 'settings';

const PATHS: Record<Route, string> = { today: '/', add: '/add', foods: '/foods', settings: '/settings' };

export function routeFromPath(pathname: string): Route {
  if (pathname.startsWith('/add')) return 'add';
  if (pathname.startsWith('/foods')) return 'foods';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'today';
}

export function pathFor(route: Route): string {
  return PATHS[route];
}

export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => (typeof window === 'undefined' ? 'today' : routeFromPath(window.location.pathname)));
  useEffect(() => {
    const onPop = (): void => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (next: Route): void => {
    if (next === route) return;
    window.history.pushState(null, '', pathFor(next));
    setRoute(next);
    window.scrollTo({ top: 0 });
  };
  return [route, navigate];
}
