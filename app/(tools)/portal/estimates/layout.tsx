import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Estimates');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
