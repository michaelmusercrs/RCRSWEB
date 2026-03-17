import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Office');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
