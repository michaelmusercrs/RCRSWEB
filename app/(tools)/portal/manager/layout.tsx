import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Manager Dashboard');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
