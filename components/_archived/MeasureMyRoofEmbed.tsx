'use client';

import { useState } from 'react';
import { Maximize2, Minimize2, ExternalLink, Ruler } from 'lucide-react';

interface MeasureMyRoofEmbedProps {
  address?: string;
  className?: string;
  defaultExpanded?: boolean;
}

export default function MeasureMyRoofEmbed({
  address,
  className = '',
  defaultExpanded = false,
}: MeasureMyRoofEmbedProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const baseUrl = process.env.NEXT_PUBLIC_MEASUREMYROOF_URL || 'https://www.measuremyroof.tools/';

  // Build URL with address pre-fill if supported
  const iframeUrl = address
    ? `${baseUrl}?address=${encodeURIComponent(address)}`
    : baseUrl;

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Ruler size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">MeasureMyRoof</h3>
            <p className="text-zinc-500 text-xs">AI-powered roof measurement tool</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={iframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Iframe */}
      {expanded && (
        <div className="relative">
          <iframe
            src={iframeUrl}
            className="w-full border-0"
            style={{ height: '600px' }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            loading="lazy"
            title="MeasureMyRoof - AI Roof Measurement"
          />
        </div>
      )}

      {/* Collapsed state */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-5 py-6 text-center hover:bg-zinc-800/50 transition-colors"
        >
          <p className="text-zinc-400 text-sm">
            Click to open roof measurement tool
          </p>
          {address && (
            <p className="text-zinc-600 text-xs mt-1">
              Address: {address}
            </p>
          )}
        </button>
      )}
    </div>
  );
}
