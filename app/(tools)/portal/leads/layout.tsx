import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Leads');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
