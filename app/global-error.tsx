'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Something went wrong</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Please try again or contact us at (256) 274-8530</p>
          <button onClick={reset} style={{ background: '#39FF14', color: '#000', border: 'none', padding: '0.75rem 2rem', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>
            Try Again
          </button>
          <br />
          <a href="/" style={{ color: '#39FF14', marginTop: '1rem', display: 'inline-block' }}>Return Home</a>
        </div>
      </body>
    </html>
  );
}
