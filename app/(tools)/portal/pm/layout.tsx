import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Project Manager');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
