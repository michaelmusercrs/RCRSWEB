import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Warranties');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
