import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { applyTheme } from './lib/theme.ts';
import './styles.css';

// Apply a manually chosen theme before the first paint, so there is no flash.
try {
  const theme = localStorage.getItem('brewhive-theme');
  if (theme === 'light' || theme === 'dark') applyTheme(theme);
} catch {
  // Storage is unavailable; the theme is applied once the database opens.
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker makes the app work offline. It is skipped during
// development so code changes always show up immediately.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('BrewHive could not register its service worker', error);
    });
  });
}
