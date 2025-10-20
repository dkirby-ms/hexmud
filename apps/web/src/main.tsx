import React from 'react';
import ReactDOM from 'react-dom/client';

import { HexMap } from './components/HexMap/HexMap.js';
import { WorldPlaceholder } from './components/WorldPlaceholder.js';

const App: React.FC = () => (
  <React.StrictMode>
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        display: 'grid',
        gap: '2rem',
        maxWidth: '80rem',
        margin: '0 auto'
      }}
    >
      <header>
        <h1>HexMUD Presence Preview</h1>
        <p>
          Connect to the world, then inspect live presence data updates for the hex grid below.
        </p>
      </header>

      <WorldPlaceholder />

      <section aria-labelledby="hexmap-heading">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="hexmap-heading">Presence Map</h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem' }}>
            Snapshot and updates stream directly from the world room.
          </p>
        </div>
        <HexMap />
      </section>
    </main>
  </React.StrictMode>
);

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(container).render(<App />);
