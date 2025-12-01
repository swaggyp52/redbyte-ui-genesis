import React from 'react';
import Shell from './components/layout/Shell';
import Overview from './pages/Overview';
import Playground from './pages/Playground';
import SystemKit from './pages/SystemKit';

export default function App() {
  const [route, setRoute] = React.useState<'overview' | 'playground' | 'systemkit'>('overview');
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');

  const onToggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    // Theme hook is visual / narrative only in this Genesis build.
  };

  let currentPage = <Overview />;
  if (route === 'playground') currentPage = <Playground />;
  if (route === 'systemkit') currentPage = <SystemKit />;

  return (
    <Shell
      route={route}
      onRouteChange={setRoute}
      theme={theme}
      onToggleTheme={onToggleTheme}
    >
      {currentPage}
    </Shell>
  );
}
