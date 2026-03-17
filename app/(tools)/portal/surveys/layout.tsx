import { portalMetadata } from '../metadata';

export const metadata = portalMetadata('Surveys');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
