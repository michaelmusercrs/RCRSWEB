'use client';

import { useState, useCallback } from 'react';
import { QrCode, Download, X } from 'lucide-react';

interface ShareQRCodeProps {
  slug: string;
  name: string;
}

export default function ShareQRCode({ slug, name }: ShareQRCodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pageUrl = `https://rivercityroofingsolutions.com/team/${slug}`;

  const generateQR = useCallback(async () => {
    if (qrDataUrl) {
      setIsOpen(true);
      return;
    }
    setLoading(true);
    setIsOpen(true);
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(pageUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [pageUrl, qrDataUrl]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${slug}-qr-code.png`;
    link.click();
  }, [qrDataUrl, slug]);

  return (
    <>
      <button
        onClick={generateQR}
        className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-300 hover:text-brand-green hover:border-brand-green/50 transition-all text-sm font-medium"
      >
        <QrCode size={18} />
        Share My Page
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
              <p className="text-neutral-400 text-sm mb-4">Scan to visit my page</p>

              {loading ? (
                <div className="w-64 h-64 mx-auto bg-neutral-900 rounded-xl flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full" />
                </div>
              ) : qrDataUrl ? (
                <div className="bg-white rounded-xl p-3 inline-block mx-auto mb-4">
                  <img src={qrDataUrl} alt={`QR code for ${name}'s page`} className="w-64 h-64" />
                </div>
              ) : null}

              <p className="text-neutral-500 text-xs mb-4 break-all">{pageUrl}</p>

              {qrDataUrl && (
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green text-black font-bold rounded-lg hover:bg-lime-400 transition-all"
                >
                  <Download size={18} />
                  Download QR Code
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
