'use client';

export default function ReloadButton() {
  return (
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
  );
}
