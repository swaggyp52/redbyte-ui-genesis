import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

if (import.meta.env.DEV && typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.get('wdyr') === '1') {
    import('@welldone-software/why-did-you-render').then(({ default: whyDidYouRender }) => {
      whyDidYouRender(React, {
        trackAllPureComponents: false,
        include: [/LogicCanvas/, /SchematicView/, /OscilloscopeView/, /RightDock/],
      });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
