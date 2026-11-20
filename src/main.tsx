import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onOfflineReady() {
      (window as unknown as { __bmwOfflineReady?: boolean }).__bmwOfflineReady = true;
      window.dispatchEvent(new CustomEvent('bmw-sw-offline-ready'));
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
