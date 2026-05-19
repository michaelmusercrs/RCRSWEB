import { portalMetadata } from '../../metadata';

export const metadata = portalMetadata('Payments');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
