import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Team Chat');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
