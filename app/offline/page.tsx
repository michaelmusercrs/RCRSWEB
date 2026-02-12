'use client';

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Logo */}
      <img
        src="/logo-nobg.png"
        alt="River City Roofing Solutions"
        style={{
          width: '180px',
          height: 'auto',
          marginBottom: '2rem',
        }}
      />

      {/* Offline Icon */}
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(57, 255, 20, 0.1)',
          border: '2px solid #39FF14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#39FF14"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#39FF14',
          marginBottom: '1rem',
          margin: '0 0 1rem 0',
        }}
      >
        You&apos;re Offline
      </h1>

      {/* Message */}
      <p
        style={{
          fontSize: '1.125rem',
          color: '#a0a0a0',
          maxWidth: '500px',
          lineHeight: '1.6',
          marginBottom: '2rem',
        }}
      >
        It looks like you&apos;ve lost your internet connection. Please check your
        network settings and try again.
      </p>

      {/* Retry Button */}
      <button
        onClick={() => window.location.reload()}
        style={{
          backgroundColor: '#39FF14',
          color: '#000000',
          border: 'none',
          borderRadius: '8px',
          padding: '14px 32px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'opacity 0.2s',
          marginBottom: '2rem',
        }}
        onMouseOver={(e) => ((e.target as HTMLButtonElement).style.opacity = '0.85')}
        onMouseOut={(e) => ((e.target as HTMLButtonElement).style.opacity = '1')}
      >
        Try Again
      </button>

      {/* Contact Info */}
      <div
        style={{
          borderTop: '1px solid #333',
          paddingTop: '1.5rem',
          color: '#666',
          fontSize: '0.875rem',
        }}
      >
        <p style={{ margin: '0 0 0.5rem 0' }}>
          Need immediate help? Call us directly:
        </p>
        <a
          href="tel:+12562748530"
          style={{
            color: '#39FF14',
            textDecoration: 'none',
            fontSize: '1.25rem',
            fontWeight: '600',
          }}
        >
          (256) 274-8530
        </a>
      </div>
    </div>
  );
}
