/**
 * RCRS Command Center - Root Layout
 *
 * This server component wraps all command center pages and provides:
 * - Authentication context via AuthProvider
 * - Training context for team training features
 * - The main CommandCenterLayout client component
 *
 * The layout delegates role-based navigation rendering to the client
 * component which has access to the auth context.
 */

import { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { TrainingProvider } from '@/lib/training-context';
import { CommandCenterLayout } from '@/components/command-center/CommandCenterLayout';

export const metadata: Metadata = {
  title: {
    template: '%s | RCRS Command Center',
    default: 'RCRS Command Center',
  },
  description: 'River City Roofing Solutions - Unified Business Command Center',
};

export default function CommandCenterRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TrainingProvider>
        <CommandCenterLayout>{children}</CommandCenterLayout>
      </TrainingProvider>
    </AuthProvider>
  );
}
