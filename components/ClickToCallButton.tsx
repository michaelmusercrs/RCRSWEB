'use client';

/**
 * ClickToCallButton
 *
 * Drop-in button that triggers a FreePBX originate from the calling user's
 * extension to the supplied phone number. Used anywhere the portal shows
 * a customer / lead / rep phone number — JN integrations, lead views,
 * job pages, etc.
 *
 * Usage:
 *   <ClickToCallButton
 *     toNumber={lead.phone}
 *     fromExt={currentUserExtension}
 *     customerName={lead.name}
 *     customerId={lead.id}
 *     jobNumber={job.jobNumber}
 *   />
 *
 * Falls back gracefully when FreePBX isn't configured — surfaces a
 * toast-style message inline rather than throwing.
 */

import { useState } from 'react';
import { Phone, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ClickToCallButtonProps {
  /** Number to call (any format — will be normalized server-side) */
  toNumber: string;
  /** Caller's FreePBX extension. Required — pass null/empty to disable. */
  fromExt: string;
  /** Optional context for the Phone Call Log sheet */
  customerName?: string;
  customerId?: string;
  jobNumber?: string;
  notes?: string;
  /** Display variant */
  variant?: 'icon' | 'icon-label' | 'full';
  /** Extra Tailwind classes */
  className?: string;
}

type CallState = 'idle' | 'calling' | 'success' | 'error';

export default function ClickToCallButton({
  toNumber,
  fromExt,
  customerName,
  customerId,
  jobNumber,
  notes,
  variant = 'icon-label',
  className = '',
}: ClickToCallButtonProps) {
  const [state, setState] = useState<CallState>('idle');
  const [message, setMessage] = useState<string>('');

  const disabled = !fromExt || !toNumber || state === 'calling';

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    setState('calling');
    setMessage('');
    try {
      const res = await fetch('/api/freepbx/originate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromExt,
          toNumber,
          customerName,
          customerId,
          jobNumber,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setState('error');
        setMessage(json.error || 'Call failed');
      } else if (json.source === 'stub') {
        setState('error');
        setMessage('FreePBX not configured');
      } else {
        setState('success');
        setMessage('Ringing your extension…');
      }
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTimeout(() => {
        setState('idle');
        setMessage('');
      }, 3000);
    }
  }

  const Icon =
    state === 'calling' ? Loader2 :
    state === 'success' ? CheckCircle2 :
    state === 'error' ? AlertCircle :
    Phone;

  const baseColor =
    state === 'success' ? 'text-[#39FF14] border-[#39FF14]/30 bg-[#39FF14]/10' :
    state === 'error' ? 'text-red-400 border-red-400/30 bg-red-400/10' :
    'text-blue-300 border-blue-400/30 bg-blue-400/10 hover:bg-blue-400/20';

  const title = disabled
    ? !fromExt
      ? 'No extension assigned to you'
      : 'Missing phone number'
    : `Call ${toNumber} from ext ${fromExt}`;

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={`p-1.5 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${baseColor} ${className}`}
      >
        <Icon className={`w-3.5 h-3.5 ${state === 'calling' ? 'animate-spin' : ''}`} />
      </button>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`inline-flex flex-col gap-1 ${className}`}>
        <button
          onClick={handleClick}
          disabled={disabled}
          title={title}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${baseColor}`}
        >
          <Icon className={`w-4 h-4 ${state === 'calling' ? 'animate-spin' : ''}`} />
          <span>
            {state === 'calling' ? 'Calling…' :
             state === 'success' ? 'Ringing…' :
             state === 'error' ? 'Failed' :
             `Call from ext ${fromExt || '--'}`}
          </span>
        </button>
        {message && <span className="text-xs text-gray-400">{message}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${baseColor} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${state === 'calling' ? 'animate-spin' : ''}`} />
      <span>
        {state === 'calling' ? 'Calling…' :
         state === 'success' ? 'Ringing…' :
         state === 'error' ? message || 'Failed' :
         'Call'}
      </span>
    </button>
  );
}
