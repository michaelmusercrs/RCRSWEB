import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Sales Dashboard');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
