import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Time Tracking');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
