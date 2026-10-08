import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerBuiltinWidgets } from './widgets';
import './index.css';

// Initialize builtin widgets into widget registry
registerBuiltinWidgets();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
