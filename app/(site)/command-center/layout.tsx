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
    template: '%s | RoofStack',
    default: 'HQ | RoofStack',
  },
  description: 'RoofStack - Everything Under One Roof',
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
