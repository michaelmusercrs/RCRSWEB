import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Material Orders');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
