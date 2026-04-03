import '@fontsource/epilogue/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

const rootElement = document.getElementById('root') as HTMLElement;

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

window.requestAnimationFrame(() => {
  document.body.classList.add('boot-complete');
  window.setTimeout(() => {
    document.getElementById('boot-splash')?.remove();
  }, 260);
});
