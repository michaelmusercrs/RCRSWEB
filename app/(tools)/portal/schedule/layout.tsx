import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Schedule');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
