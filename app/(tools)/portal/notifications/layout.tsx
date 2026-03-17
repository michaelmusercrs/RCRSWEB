import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Notifications');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
