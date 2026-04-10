import { redirect } from 'next/navigation';

// Sales reps see their leaderboard position on the performance page.
// The command-center leaderboard is owner/admin only.
export default function SalesLeaderboardRedirect() {
  redirect('/portal/sales/performance');
}
