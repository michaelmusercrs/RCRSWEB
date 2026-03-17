import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Sales Competition');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
