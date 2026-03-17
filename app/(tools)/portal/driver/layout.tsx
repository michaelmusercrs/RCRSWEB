import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Driver');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
