import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../globals.css';

// Standalone open-link page (same pattern as /chrisview, /reps): there is no
// root app/layout.tsx, so this layout must provide its own <html>/<body> and
// pull in the global stylesheet — otherwise the page renders a blank/white
// screen with no Tailwind styles.
export const metadata: Metadata = {
  title: 'RCRS Call Portal',
  robots: { index: false, follow: false },
};

export default function CallsLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
