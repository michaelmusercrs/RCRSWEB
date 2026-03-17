import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Monday Meetings');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
