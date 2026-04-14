import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Monday Meeting — Live',
  robots: 'noindex, nofollow',
};

export default function MeetingLiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
