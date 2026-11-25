import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onOfflineReady() {
        (window as unknown as { __bmwOfflineReady?: boolean }).__bmwOfflineReady = true;
        window.dispatchEvent(new CustomEvent('bmw-sw-offline-ready'));
      },
    });
  } else if ('serviceWorker' in navigator) {
    // Clear any stale dev-sw.js registrations that could intercept Vite ESM module imports
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      })
      .catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
