import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Document Management');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
