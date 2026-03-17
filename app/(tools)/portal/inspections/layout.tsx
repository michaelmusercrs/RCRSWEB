import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Inspections');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
