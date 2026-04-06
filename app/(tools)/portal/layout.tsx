'use client';

import { AuthProvider } from '@/lib/auth-context';
import { TrainingProvider } from '@/lib/training-context';
import TrainingPopup from '@/components/TrainingPopup';
import ChatWidget from '@/components/portal/ChatWidget';
import ImpersonationBanner from '@/components/portal/ImpersonationBanner';
import { PortalShell } from '@/components/portal/PortalShell';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <TrainingProvider>
        <ImpersonationBanner />
        <PortalShell>
          {children}
        </PortalShell>
        <TrainingPopup />
        <ChatWidget />
      </TrainingProvider>
    </AuthProvider>
  );
}
