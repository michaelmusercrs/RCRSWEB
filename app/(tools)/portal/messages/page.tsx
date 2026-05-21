'use client';

/**
 * Portal Messaging — main split-pane view.
 *
 * - Left: conversation list (groups + DMs).
 * - Right: selected conversation thread + composer.
 * - Mobile (< md): collapses to single-pane stack — when no conversation
 *   is selected the list is shown; selecting a row swaps to the thread,
 *   and a back arrow returns to the list.
 * - Polls every 15s for new messages on the active conversation.
 * - NO automatic sends — every outbound POST happens only in response to
 *   a user click in MessageComposer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, MessageSquare, Moon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import {
  ConversationList,
  type ConversationListItem,
} from '@/components/portal-messaging/ConversationList';
import {
  MessageThread,
  type ThreadMessage,
} from '@/components/portal-messaging/MessageThread';
import { MessageComposer } from '@/components/portal-messaging/MessageComposer';

const POLL_INTERVAL_MS = 15_000;

interface GroupConv {
  id: string;
  name: string;
  imageUrl: string | null;
  memberCount?: number;
  lastMessage: { text: string | null; sender: string; timestamp: number } | null;
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [groups, setGroups] = useState<GroupConv[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKind, setSelectedKind] = useState<'group' | 'dm' | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [sendBanner, setSendBanner] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [quietHours, setQuietHours] = useState(false);

  // Redirect unauthenticated.
  useEffect(() => {
    if (!isLoading && !user) router.push('/portal');
  }, [user, isLoading, router]);

  // Quiet hours check (client-side mirror; server is authoritative).
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

  // Load groups on mount.
  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const res = await fetch('/api/portal/messages/groups');
      const data = await res.json();
      if (!data.success) {
        setGroupsError(data.error || 'Failed to load groups');
        setGroups([]);
        return;
      }
      const fetched: GroupConv[] = (data.conversations || []).map(
        (c: ConversationListItem & { lastMessage?: GroupConv['lastMessage'] }) => ({
          id: c.id,
          name: c.name,
          imageUrl: null,
          memberCount: (c as { memberCount?: number }).memberCount,
          lastMessage: (c as { lastMessage?: GroupConv['lastMessage'] }).lastMessage ?? null,
        }),
      );
      setGroups(fetched);
    } catch (err) {
      setGroupsError(err instanceof Error ? err.message : 'Network error');
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadGroups();
  }, [user, loadGroups]);

  // DM list is built from the team roster — every active member who is
  // NOT the current portal user can be DM'd. Resolution to GroupMe
  // user_id happens server-side when sending.
  const dmItems: ConversationListItem[] = useMemo(
    () =>
      TEAM_MEMBERS.filter((m) => m.isActive && m.email !== user?.email).map((m) => ({
        id: m.slug,
        kind: 'dm' as const,
        name: m.name,
      })),
    [user?.email],
  );

  const groupItems: ConversationListItem[] = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        kind: 'group' as const,
        name: g.name,
        subtitle: g.lastMessage?.text || undefined,
        lastTimestamp: g.lastMessage?.timestamp,
      })),
    [groups],
  );

  // Load thread for the selected conversation.
  const loadThread = useCallback(
    async (id: string, kind: 'group' | 'dm') => {
      setLoadingMessages(true);
      setThreadError(null);
      try {
        let res: Response;
        if (kind === 'group') {
          // Reuse the older /api/portal/chat/messages route for group
          // history reads (no send-side concerns, simple GET).
          res = await fetch(`/api/portal/chat/messages?groupId=${encodeURIComponent(id)}&limit=50`);
        } else {
          // DM history requires resolving slug -> groupme user_id first.
          // The dms GET endpoint takes a groupme user_id directly; we go
          // through the legacy chat/dm endpoint which already handles
          // permission gating. Empty thread is fine — server returns 403
          // for non-elevated roles, which we surface gently.
          res = await fetch(`/api/portal/messages/dms?userId=${encodeURIComponent(id)}`);
          if (res.status === 403) {
            setMessages([]);
            setThreadError('DM history is restricted to owner/admin/manager/office. You can still send a DM.');
            setLoadingMessages(false);
            return;
          }
        }
        const data = await res.json();
        if (!data.success) {
          setThreadError(data.error || 'Failed to load messages');
          setMessages([]);
          return;
        }
        const rows: ThreadMessage[] = (data.messages || []).map(
          (m: ThreadMessage) => ({
            id: m.id,
            text: m.text,
            senderId: m.senderId,
            senderName: m.senderName,
            avatarUrl: m.avatarUrl,
            createdAt: m.createdAt,
            system: !!m.system,
          }),
        );
        rows.sort((a, b) => a.createdAt - b.createdAt);
        setMessages(rows);
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : 'Network error');
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [],
  );

  const handleSelect = (id: string, kind: 'group' | 'dm') => {
    setSelectedId(id);
    setSelectedKind(kind);
    setSendBanner(null);
    loadThread(id, kind);
  };

  // 15s polling for the active thread.
  useEffect(() => {
    if (!selectedId || !selectedKind) return;
    const handle = setInterval(() => {
      loadThread(selectedId, selectedKind);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [selectedId, selectedKind, loadThread]);

  const handleSend = async (text: string) => {
    if (!selectedId || !selectedKind) return;
    setSendBanner(null);
    let res: Response;
    if (selectedKind === 'group') {
      res = await fetch('/api/portal/messages/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedId, body: text }),
      });
    } else {
      // DM: server-side route accepts a GroupMe user_id directly. We
      // don't have that mapped for arbitrary slugs yet — surface a
      // helpful banner via the notify-rep endpoint instead, which
      // resolves slug -> user_id internally.
      res = await fetch('/api/portal/messages/notify-rep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repSlug: selectedId,
          title: 'Portal Message',
          message: text,
        }),
      });
    }
    const data = await res.json();
    if (res.status === 202 && data.skipped) {
      setSendBanner(
        data.error ||
          'GroupMe sends are paused (master kill switch is on). Message recorded but not delivered.',
      );
      return;
    }
    if (!res.ok || !data.success) {
      setSendBanner(data.error || 'Send failed');
      return;
    }
    // Refresh thread so the new message appears on the next poll.
    loadThread(selectedId, selectedKind);
  };

  const selectedGroup = groups.find((g) => g.id === selectedId && selectedKind === 'group');
  const selectedDmMember = TEAM_MEMBERS.find(
    (m) => m.slug === selectedId && selectedKind === 'dm',
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-lime-500" />
      </div>
    );
  }
  if (!user) return null;

  const headerLabel = selectedGroup
    ? `# ${selectedGroup.name}`
    : selectedDmMember
    ? `DM with ${selectedDmMember.name}`
    : 'Select a conversation';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-3 sm:px-4 py-3 flex items-center gap-3">
        {/* Mobile back-to-list */}
        {selectedId && (
          <button
            onClick={() => {
              setSelectedId(null);
              setSelectedKind(null);
              setMessages([]);
            }}
            className="md:hidden text-zinc-400 hover:text-white"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Link
          href="/portal/dashboard"
          className="hidden md:inline text-zinc-400 hover:text-white"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <MessageSquare className="w-5 h-5 text-lime-500" />
        <h1 className="text-base sm:text-lg font-semibold truncate">
          Messages
        </h1>
        <span className="text-zinc-500 text-xs sm:text-sm truncate">
          {headerLabel !== 'Select a conversation' && `/ ${headerLabel}`}
        </span>
      </header>

      {/* Quiet hours banner */}
      {quietHours && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 px-3 sm:px-4 py-2 text-xs flex items-center gap-2">
          <Moon className="w-3.5 h-3.5 shrink-0" />
          <span>
            Quiet hours active — messages can't be sent between 8 PM and 7 AM Central.
          </span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: conversation list. Hidden on mobile when a thread is selected. */}
        <aside
          className={`w-full md:w-72 lg:w-80 shrink-0 ${
            selectedId ? 'hidden md:block' : 'block'
          }`}
        >
          <ConversationList
            groups={groupItems}
            dms={dmItems}
            selectedId={selectedId}
            selectedKind={selectedKind}
            onSelect={handleSelect}
            search={search}
            onSearch={setSearch}
            loading={loadingGroups}
          />
          {groupsError && (
            <div className="px-3 py-2 text-xs text-red-400 bg-red-500/5">{groupsError}</div>
          )}
        </aside>

        {/* Right pane: thread + composer. Hidden on mobile when no selection. */}
        <main
          className={`flex-1 flex-col bg-zinc-950 ${
            selectedId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
              <MessageSquare className="w-10 h-10 text-zinc-700" />
              <p className="text-zinc-500 text-sm">
                Select a group or team member to start messaging.
              </p>
            </div>
          ) : (
            <>
              {threadError && (
                <div className="px-3 sm:px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs">
                  {threadError}
                </div>
              )}
              <MessageThread
                messages={messages}
                currentUserId={null}
                loading={loadingMessages}
                emptyHint={
                  selectedKind === 'dm'
                    ? `No messages with ${selectedDmMember?.name || 'this member'} yet`
                    : 'No messages yet'
                }
              />
              <MessageComposer
                onSend={handleSend}
                disabled={!selectedId}
                quietHours={quietHours}
                banner={sendBanner}
                placeholder={
                  selectedKind === 'group'
                    ? `Message #${selectedGroup?.name || ''}…`
                    : `Message ${selectedDmMember?.name || ''}…`
                }
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
