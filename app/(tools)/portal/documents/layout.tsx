import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Documents');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
