'use client';

/**
 * Thread of messages for the selected conversation. Per-message
 * timestamps render in America/Chicago. Mobile-first sizing.
 */

import { useEffect, useRef } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';

export interface ThreadMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  avatarUrl: string | null;
  createdAt: number;          // unix seconds
  system: boolean;
}

interface Props {
  messages: ThreadMessage[];
  currentUserId: string | null;
  loading: boolean;
  emptyHint?: string;
}

function formatCentralTimestamp(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export function MessageThread({ messages, currentUserId, loading, emptyHint }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-lime-500" />
        <p className="text-zinc-500 text-sm">Loading messages…</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <MessageSquare className="w-10 h-10 text-zinc-700" />
        <p className="text-zinc-500 text-sm">{emptyHint || 'No messages yet'}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-1">
      {messages.map((msg, idx) => {
        const isOwn = msg.senderId === currentUserId;
        const prev = idx > 0 ? messages[idx - 1] : null;
        const showHeader =
          !prev ||
          prev.senderId !== msg.senderId ||
          msg.createdAt - prev.createdAt > 300;

        return (
          <div key={msg.id} className={showHeader ? 'mt-3' : 'mt-0.5'}>
            {showHeader && (
              <div className="flex items-center gap-2 mb-1">
                {msg.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.avatarUrl}
                    alt={msg.senderName}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isOwn ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {getInitials(msg.senderName)}
                  </div>
                )}
                <span
                  className={`text-sm font-medium ${isOwn ? 'text-lime-400' : 'text-white'}`}
                >
                  {msg.senderName}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {formatCentralTimestamp(msg.createdAt)} CT
                </span>
              </div>
            )}
            <div className={`pl-9 ${msg.system ? 'italic text-zinc-500' : ''}`}>
              {msg.text && (
                <p className="text-zinc-200 text-sm whitespace-pre-wrap break-words">
                  {msg.text}
                </p>
              )}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
