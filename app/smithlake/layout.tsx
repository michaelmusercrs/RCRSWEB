import type { Metadata } from 'next';
import '../globals.css';

// Open internal dashboard (same pattern as /reps, /calls, /chrisview): reachable
// without a portal login, but kept out of search engines. Contains homeowner
// data drawn from public county records.
//
// There is no root app/layout.tsx, so this layout MUST render its own
// <html>/<body> and import the global stylesheet — otherwise the page renders a
// blank white screen with no styles.
export const metadata: Metadata = {
  title: 'Smith Lake Database',
  robots: { index: false, follow: false },
};

export default function SmithLakeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
