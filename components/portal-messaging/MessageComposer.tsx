'use client';

/**
 * Composer (textarea + send button) for the portal messaging UI.
 *
 * NO automatic sends — onSend is invoked ONLY when the user explicitly
 * clicks the Send button or presses Enter (Shift+Enter inserts a
 * newline). Quiet-hours / kill-switch enforcement happens on the server.
 */

import { useRef, useState, type KeyboardEvent } from 'react';
import { Loader2, Send, Moon } from 'lucide-react';

interface Props {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  quietHours?: boolean;
  banner?: string | null;
}

export function MessageComposer({
  onSend,
  disabled,
  placeholder,
  quietHours,
  banner,
}: Props) {
  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = async () => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    try {
      await onSend(text);
      setValue('');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 px-3 sm:px-4 py-3">
      {banner && (
        <div className="mb-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs">
          {banner}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || 'Type a message…'}
          rows={1}
          disabled={disabled || quietHours}
          maxLength={1000}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-lime-500 focus:border-lime-500 max-h-32 disabled:opacity-50"
          style={{ minHeight: '40px' }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!value.trim() || sending || disabled || quietHours}
          className="p-2.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          aria-label="Send message"
          title={
            quietHours
              ? 'Messaging disabled during quiet hours (8 PM – 7 AM Central)'
              : 'Send message'
          }
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : quietHours ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-zinc-600 mt-1">
        Press Enter to send · Shift+Enter for new line · max 1000 chars
      </p>
    </div>
  );
}
