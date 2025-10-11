import React from 'react';
import ReactDOM from 'react-dom/client';

import { WorldPlaceholder } from './components/WorldPlaceholder.js';

const App: React.FC = () => (
  <React.StrictMode>
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>HexMUD</h1>
      <WorldPlaceholder />
    </main>
  </React.StrictMode>
);

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(container).render(<App />);
