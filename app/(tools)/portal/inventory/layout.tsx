import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Inventory');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
