import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Weather & Storm Monitoring');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
