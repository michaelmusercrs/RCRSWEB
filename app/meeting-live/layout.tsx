import type { Metadata } from 'next';
import '../globals.css';

// There is no root app/layout.tsx, so this standalone page's layout MUST render
// its own <html>/<body> and import the global stylesheet — otherwise it renders
// a blank white screen with no styles.
export const metadata: Metadata = {
  title: 'Monday Meeting — Live',
  robots: 'noindex, nofollow',
};

export default function MeetingLiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
