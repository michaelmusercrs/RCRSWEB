'use client';

/**
 * Sandbox Mode Banner
 * Shows a persistent banner when running in sandbox/test mode.
 * Only renders when NEXT_PUBLIC_SANDBOX_MODE is true.
 */

export default function SandboxBanner() {
  if (process.env.NEXT_PUBLIC_SANDBOX_MODE !== 'true') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(90deg, #ff6b00, #ff9500, #ff6b00)',
        color: '#000',
        textAlign: 'center',
        padding: '6px 16px',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.5px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      SANDBOX MODE — Test data only. No real sheets, emails, or CRM calls.
    </div>
  );
}
