'use client';

/**
 * Direct-link conversation page — /portal/messages/[conversationId].
 *
 * conversationId encoding:
 *   - "g:<group_id>"  → group conversation
 *   - "d:<rep_slug>"  → direct message with a team member (by slug)
 *
 * If the prefix is omitted the id is assumed to be a group_id (matches
 * GroupMe's native ids which are numeric strings).
 *
 * Same UI as the main messages page but auto-selects the target on mount.
 * NO automatic sends — composer requires an explicit user click.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, MessageSquare, Moon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import {
  MessageThread,
  type ThreadMessage,
} from '@/components/portal-messaging/MessageThread';
import { MessageComposer } from '@/components/portal-messaging/MessageComposer';

function parseConversationId(raw: string): { id: string; kind: 'group' | 'dm' } {
  if (raw.startsWith('g:')) return { id: raw.slice(2), kind: 'group' };
  if (raw.startsWith('d:')) return { id: raw.slice(2), kind: 'dm' };
  return { id: raw, kind: 'group' };
}

export default function ConversationDetailPage() {
  const router = useRouter();
  const params = useParams<{ conversationId: string }>();
  const { user, isLoading } = useAuth();

  const parsed = parseConversationId(decodeURIComponent(params.conversationId));
  const dmMember =
    parsed.kind === 'dm' ? TEAM_MEMBERS.find((m) => m.slug === parsed.id) : null;

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [sendBanner, setSendBanner] = useState<string | null>(null);
  const [quietHours, setQuietHours] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/portal');
  }, [user, isLoading, router]);

  useEffect(() => {
    const check = () => {
      const cst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const hr = cst.getHours();
      setQuietHours(hr >= 20 || hr < 7);
    };
    check();
    const i = setInterval(check, 60_000);
    return () => clearInterval(i);
  }, []);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setThreadError(null);
    try {
      const url =
        parsed.kind === 'group'
          ? `/api/portal/chat/messages?groupId=${encodeURIComponent(parsed.id)}&limit=50`
          : `/api/portal/messages/dms?userId=${encodeURIComponent(parsed.id)}`;
      const res = await fetch(url);
      if (res.status === 403) {
        setMessages([]);
        setThreadError(
          'DM history is restricted to owner/admin/manager/office. You can still send a DM.',
        );
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setThreadError(data.error || 'Failed to load thread');
        setMessages([]);
        return;
      }
      const rows: ThreadMessage[] = (data.messages || []).map((m: ThreadMessage) => ({
        id: m.id,
        text: m.text,
        senderId: m.senderId,
        senderName: m.senderName,
        avatarUrl: m.avatarUrl,
        createdAt: m.createdAt,
        system: !!m.system,
      }));
      rows.sort((a, b) => a.createdAt - b.createdAt);
      setMessages(rows);
    } catch (err) {
      setThreadError(err instanceof Error ? err.message : 'Network error');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [parsed.id, parsed.kind]);

  useEffect(() => {
    if (user) loadThread();
  }, [user, loadThread]);

  useEffect(() => {
    if (!user) return;
    const i = setInterval(() => loadThread(), 15_000);
    return () => clearInterval(i);
  }, [user, loadThread]);

  const handleSend = async (text: string) => {
    setSendBanner(null);
    let res: Response;
    if (parsed.kind === 'group') {
      res = await fetch('/api/portal/messages/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: parsed.id, body: text }),
      });
    } else {
      res = await fetch('/api/portal/messages/notify-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug: parsed.id,
          title: 'Portal Message',
          message: text,
        }),
      });
    }
    const data = await res.json();
    if (res.status === 202 && data.skipped) {
      setSendBanner(data.error || 'GroupMe sends are paused (master kill switch).');
      return;
    }
    if (!res.ok || !data.success) {
      setSendBanner(data.error || 'Send failed');
      return;
    }
    loadThread();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-lime-500" />
      </div>
    );
  }
  if (!user) return null;

  const headerLabel =
    parsed.kind === 'group'
      ? `# Group ${parsed.id}`
      : `DM with ${dmMember?.name || parsed.id}`;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-950 text-white flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 px-3 sm:px-4 py-3 flex items-center gap-3">
        <Link
          href="/portal/messages"
          className="text-zinc-400 hover:text-white"
          aria-label="Back to messages"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <MessageSquare className="w-5 h-5 text-lime-500" />
        <h1 className="text-base sm:text-lg font-semibold truncate">{headerLabel}</h1>
      </header>

      {quietHours && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 px-3 sm:px-4 py-2 text-xs flex items-center gap-2">
          <Moon className="w-3.5 h-3.5 shrink-0" />
          <span>Quiet hours active — messages can't be sent 8 PM – 7 AM Central.</span>
        </div>
      )}

      {threadError && (
        <div className="px-3 sm:px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs">
          {threadError}
        </div>
      )}

      <MessageThread
        messages={messages}
        currentUserId={null}
        loading={loading}
        emptyHint={
          parsed.kind === 'dm'
            ? `No messages with ${dmMember?.name || parsed.id} yet`
            : 'No messages yet'
        }
      />
      <MessageComposer
        onSend={handleSend}
        quietHours={quietHours}
        banner={sendBanner}
        placeholder={
          parsed.kind === 'group' ? 'Message the group…' : `Message ${dmMember?.name || ''}…`
        }
      />
    </div>
  );
}
