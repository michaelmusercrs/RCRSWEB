import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Insurance Agents');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
