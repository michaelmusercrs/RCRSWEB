import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Sales');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
