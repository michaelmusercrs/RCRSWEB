'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Custom PWA install prompt.
 *
 * - On Android Chrome / Edge: captures the `beforeinstallprompt` event so we
 *   can fire it from a styled button instead of relying on the browser's
 *   default install UI (which most users miss).
 * - On iOS Safari: there is no programmatic install API. We show a small
 *   "Add to Home Screen" instructions banner the first time a mobile Safari
 *   user visits and dismiss it via localStorage afterward.
 * - Hidden once installed (matchMedia('(display-mode: standalone)')).
 *
 * Drop this anywhere in the layout — it self-positions as a fixed bottom-right
 * pill on mobile and as an inline button when used inside another component.
 */

const STORAGE_KEY = 'rcrs-install-prompt-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPromptButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check installed state
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Check dismissal
    if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true') {
      setDismissed(true);
      return;
    }

    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIos && isSafari && 'standalone' in navigator && !(navigator as { standalone?: boolean }).standalone) {
      setIosSafari(true);
    }

    // Capture the install prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for actual install
    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  // UI preference — tracks PWA install prompt dismissal
  const dismiss = () => {
    setDismissed(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  };

  // Hide entirely if installed or dismissed
  if (installed || dismissed) return null;

  // iOS Safari: show "Add to Home Screen" instructions
  if (iosSafari) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto rounded-xl bg-neutral-900/95 backdrop-blur border border-brand-green/40 shadow-2xl p-4 sm:left-auto sm:right-4 sm:max-w-sm">
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 text-neutral-500 hover:text-white"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3">
          <Download className="text-brand-green flex-shrink-0 mt-1" size={20} />
          <div>
            <p className="text-white font-semibold text-sm">Add to Home Screen</p>
            <p className="text-neutral-400 text-xs mt-1">
              Tap the share icon{' '}
              <span className="inline-block px-1 py-0.5 bg-neutral-800 rounded text-neutral-300">⇧</span>{' '}
              then &ldquo;Add to Home Screen&rdquo; to install River City Roofing as an app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Android/desktop with deferred prompt
  if (!deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-neutral-900/95 backdrop-blur border border-brand-green/40 shadow-2xl p-4">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-neutral-500 hover:text-white"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3 pr-4">
        <Download className="text-brand-green flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Install RCRS</p>
          <p className="text-neutral-400 text-xs mt-0.5">
            Add to your home screen for instant access.
          </p>
          <button
            onClick={handleInstall}
            className="mt-3 px-4 py-2 bg-brand-green hover:bg-lime-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
