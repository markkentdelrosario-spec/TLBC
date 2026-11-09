import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/serene.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find the #root element to mount the KSP app.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
