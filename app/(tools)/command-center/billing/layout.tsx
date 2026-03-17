import { ccMetadata } from '../metadata';

export const metadata = ccMetadata('Billing & Invoices');

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
