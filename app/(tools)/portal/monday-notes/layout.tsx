import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Monday Notes');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
