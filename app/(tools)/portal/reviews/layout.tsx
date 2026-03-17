import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Reviews');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
