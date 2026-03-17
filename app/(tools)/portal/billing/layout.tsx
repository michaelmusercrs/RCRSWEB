import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Billing');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
