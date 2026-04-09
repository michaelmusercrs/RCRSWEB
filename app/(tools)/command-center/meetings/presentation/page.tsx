import { redirect } from 'next/navigation';

export default function MeetingPresentationRedirect() {
  redirect('/command-center/meetings/present');
}
