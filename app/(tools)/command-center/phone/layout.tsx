import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Phone System');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
