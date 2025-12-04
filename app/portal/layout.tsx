'use client';

import { AuthProvider } from '@/lib/auth-context';
import { TrainingProvider } from '@/lib/training-context';
import TrainingPopup from '@/components/TrainingPopup';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TrainingProvider>
        {children}
        <TrainingPopup />
      </TrainingProvider>
    </AuthProvider>
  );
}
