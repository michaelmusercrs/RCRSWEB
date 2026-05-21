'use client';

/**
 * "Notify this rep" trigger + modal.
 *
 * Place this button on any admin/manager-facing rep card. It opens a
 * modal that composes a high-priority DM, and ONLY fires when the user
 * explicitly clicks "Send Notification". No auto-fire on mount.
 */

import { useState } from 'react';
import { BellRing, Loader2, X, Check, AlertCircle } from 'lucide-react';

interface Props {
  repSlug: string;
  repName: string;
  className?: string;
}

interface SendState {
  status: 'idle' | 'sending' | 'sent' | 'blocked' | 'error';
  message?: string;
}

export function NotifyRepButton({ repSlug, repName, className }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [send, setSend] = useState<SendState>({ status: 'idle' });

  const reset = () => {
    setTitle('');
    setMessage('');
    setSend({ status: 'idle' });
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || send.status === 'sending') return;
    setSend({ status: 'sending' });
    try {
      const res = await fetch('/api/portal/messages/notify-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repSlug, title: title.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (res.status === 202 && data.skipped) {
        setSend({
          status: 'blocked',
          message: data.error || 'Send blocked by owner guard.',
        });
        return;
      }
      if (!res.ok || !data.success) {
        setSend({ status: 'error', message: data.error || 'Notification failed' });
        return;
      }
      setSend({ status: 'sent', message: `Sent to ${data.resolvedTo?.nickname || repName}` });
    } catch (err) {
      setSend({
        status: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-zinc-800 hover:bg-lime-500/20 text-zinc-300 hover:text-lime-400 transition-colors'
        }
        title={`Notify ${repName}`}
      >
        <BellRing className="w-3.5 h-3.5" />
        Notify
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-lime-400" />
                <h2 className="text-base font-semibold text-white">
                  Notify {repName}
                </h2>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="text-zinc-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lead Assigned — call within 15 min"
                  maxLength={120}
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={800}
                  placeholder="What does the rep need to know?"
                  className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500 resize-none"
                />
                <p className="text-[10px] text-zinc-600 mt-1">
                  Delivered as a high-priority GroupMe DM to {repName} only —
                  not posted to any group.
                </p>
              </div>

              {send.status === 'sent' && (
                <div className="px-3 py-2 rounded-md bg-lime-500/10 border border-lime-500/30 text-lime-300 text-xs flex items-start gap-2">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{send.message}</span>
                </div>
              )}
              {send.status === 'blocked' && (
                <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{send.message}</span>
                </div>
              )}
              {send.status === 'error' && (
                <div className="px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{send.message}</span>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-zinc-800 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="px-3 py-2 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleSend}
                disabled={
                  !title.trim() || !message.trim() || send.status === 'sending'
                }
                className="px-4 py-2 text-sm bg-lime-500 hover:bg-lime-400 text-black font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {send.status === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <BellRing className="w-4 h-4" /> Send Notification
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
