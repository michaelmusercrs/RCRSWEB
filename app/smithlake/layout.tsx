import type { Metadata } from 'next';

// Open internal dashboard (same pattern as /reps, /calls): reachable without a
// portal login, but kept out of search engines. Contains homeowner data drawn
// from public county records.
export const metadata: Metadata = {
  title: 'Smith Lake Database',
  robots: { index: false, follow: false },
};

export default function SmithLakeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
