import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Delivery Management');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
