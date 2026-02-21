'use client';

import { useState, useEffect } from 'react';

export default function TestPresent() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/command-center/meetings/leaderboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => console.error(e));
  }, []);

  return (
    <div style={{ background: '#000', color: '#fff', padding: 40, minHeight: '100vh' }}>
      <h1>Test Presentation</h1>
      {data ? (
        <pre>{JSON.stringify(data, null, 2).slice(0, 2000)}</pre>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}
