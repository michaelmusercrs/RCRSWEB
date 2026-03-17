import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Job Progress');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
