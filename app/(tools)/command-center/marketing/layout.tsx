import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Marketing');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
