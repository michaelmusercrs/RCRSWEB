'use client';

// Public conference-room route for the Monday meeting presentation.
// Lives outside the (tools) group so it skips AuthProvider + CommandCenterLayout,
// so it renders instantly on the conference room TV without a login.
import MeetingPresent from '@/app/(tools)/command-center/meetings/present/page';

export default function MeetingLivePage() {
  return <MeetingPresent />;
}
