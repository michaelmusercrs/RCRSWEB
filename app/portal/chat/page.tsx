'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare, Send, Users, ArrowLeft, Loader2, RefreshCw,
  Hash, ChevronDown, User,
  MessageCircle, Search, X, Circle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface ChatMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  avatarUrl: string | null;
  createdAt: number;
  attachments: ChatAttachment[];
  favoritedBy: string[];
  system: boolean;
  senderType: string;
}

interface ChatAttachment {
  type: string;
  url?: string;
  preview_url?: string;
  name?: string;
  loci?: [number, number][];
  user_ids?: string[];
}

interface ChatGroup {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  memberCount: number;
  lastMessage: {
    text: string;
    sender: string;
    timestamp: number;
  } | null;
  messageCount: number;
}

interface ChatMember {
  userId: string;
  nickname: string;
  imageUrl: string | null;
  roles: string[];
  muted: boolean;
}

interface DMMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  avatarUrl: string | null;
  recipientId: string;
  createdAt: number;
  attachments: ChatAttachment[];
  favoritedBy: string[];
  conversationId: string;
}

// Track unread state per conversation
interface UnreadState {
  [conversationKey: string]: {
    count: number;
    lastSeenId: string | null;
  };
}

const POLL_INTERVAL = 10000; // 10 seconds

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (isYesterday) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function ChatPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // State
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // DM State
  const [dmView, setDmView] = useState(false);
  const [selectedDmUser, setSelectedDmUser] = useState<ChatMember | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [isLoadingDm, setIsLoadingDm] = useState(false);

  // Mention State
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  // Search state
  const [memberSearch, setMemberSearch] = useState('');

  // Unread state
  const [unreadState, setUnreadState] = useState<UnreadState>({});

  // Active tab for mobile
  const [activeTab, setActiveTab] = useState<'groups' | 'dms'>('groups');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastDmIdRef = useRef<string | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/portal');
    }
  }, [user, isLoading, router]);

  // Load groups on mount
  useEffect(() => {
    if (user) {
      loadGroups();
    }
  }, [user]);

  // Poll for new messages
  useEffect(() => {
    if (selectedGroupId && !dmView) {
      pollIntervalRef.current = setInterval(() => {
        pollNewMessages();
      }, POLL_INTERVAL);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [selectedGroupId, dmView]);

  // Poll for DMs
  useEffect(() => {
    if (selectedDmUser && dmView) {
      pollIntervalRef.current = setInterval(() => {
        pollNewDMs();
      }, POLL_INTERVAL);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [selectedDmUser, dmView]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, dmMessages]);

  // Background poll to check for unread messages across all groups
  useEffect(() => {
    if (!groups.length) return;

    const checkUnread = async () => {
      for (const group of groups) {
        // Skip the currently selected group (it has its own poller)
        if (group.id === selectedGroupId && !dmView) continue;

        const lastSeen = unreadState[`group-${group.id}`]?.lastSeenId;
        if (!lastSeen && !group.lastMessage) continue;

        try {
          const sinceId = lastSeen || '';
          if (!sinceId) continue;
          const res = await fetch(
            `/api/portal/chat/messages?groupId=${group.id}&since_id=${sinceId}&limit=10`
          );
          const data = await res.json();
          if (data.success && data.messages?.length > 0) {
            setUnreadState(prev => ({
              ...prev,
              [`group-${group.id}`]: {
                count: (prev[`group-${group.id}`]?.count || 0) + data.messages.length,
                lastSeenId: data.messages[data.messages.length - 1].id,
              },
            }));
          }
        } catch {
          // Silent fail for background polling
        }
      }
    };

    const bgPollInterval = setInterval(checkUnread, POLL_INTERVAL * 3); // 30 seconds for background
    return () => clearInterval(bgPollInterval);
  }, [groups, selectedGroupId, dmView]);

  // Initialize lastSeenId for groups when they first load
  useEffect(() => {
    if (groups.length > 0) {
      setUnreadState(prev => {
        const updated = { ...prev };
        for (const group of groups) {
          const key = `group-${group.id}`;
          if (!updated[key]) {
            updated[key] = {
              count: 0,
              lastSeenId: group.lastMessage ? null : null, // Will be set when group is first opened
            };
          }
        }
        return updated;
      });
    }
  }, [groups]);

  const loadGroups = async () => {
    setIsLoadingGroups(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/chat/groups');
      const data = await res.json();
      if (data.success) {
        setGroups(data.groups || []);
        // Auto-select first group
        if (data.groups?.length > 0 && !selectedGroupId) {
          selectGroup(data.groups[0].id);
        }
      } else {
        setError(data.error || 'Failed to load groups');
      }
    } catch (err) {
      setError('Failed to connect to GroupMe');
      console.error(err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const selectGroup = async (groupId: string) => {
    setSelectedGroupId(groupId);
    setDmView(false);
    setSelectedDmUser(null);
    setMessages([]);
    setIsLoadingMessages(true);
    setHasMoreMessages(true);
    lastMessageIdRef.current = null;
    shouldAutoScrollRef.current = true;

    // Clear unread for this group
    markGroupRead(groupId);

    try {
      // Fetch messages and members in parallel
      const [msgRes, memberRes] = await Promise.all([
        fetch(`/api/portal/chat/messages?groupId=${groupId}&limit=50`),
        fetch(`/api/portal/chat/members?groupId=${groupId}`),
      ]);

      const msgData = await msgRes.json();
      const memberData = await memberRes.json();

      if (msgData.success) {
        const sortedMessages = (msgData.messages || []).sort(
          (a: ChatMessage, b: ChatMessage) => a.createdAt - b.createdAt
        );
        setMessages(sortedMessages);
        if (sortedMessages.length > 0) {
          lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1].id;
          // Update lastSeenId for unread tracking
          setUnreadState(prev => ({
            ...prev,
            [`group-${groupId}`]: {
              count: 0,
              lastSeenId: sortedMessages[sortedMessages.length - 1].id,
            },
          }));
        }
        if ((msgData.messages || []).length < 50) {
          setHasMoreMessages(false);
        }
      }

      if (memberData.success) {
        setMembers(memberData.members || []);
        setCurrentUserId(memberData.currentUserId);
      }
    } catch (err) {
      setError('Failed to load chat');
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const pollNewMessages = useCallback(async () => {
    if (!selectedGroupId || !lastMessageIdRef.current) return;
    try {
      const res = await fetch(
        `/api/portal/chat/messages?groupId=${selectedGroupId}&since_id=${lastMessageIdRef.current}&limit=50`
      );
      const data = await res.json();
      if (data.success && data.messages?.length > 0) {
        const newMsgs = data.messages.sort(
          (a: ChatMessage, b: ChatMessage) => a.createdAt - b.createdAt
        );
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const unique = newMsgs.filter((m: ChatMessage) => !existingIds.has(m.id));
          if (unique.length === 0) return prev;
          return [...prev, ...unique];
        });
        lastMessageIdRef.current = newMsgs[newMsgs.length - 1].id;
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [selectedGroupId]);

  const loadMoreMessages = async () => {
    if (!selectedGroupId || isLoadingMore || !hasMoreMessages || messages.length === 0) return;
    setIsLoadingMore(true);
    shouldAutoScrollRef.current = false;

    try {
      const oldestId = messages[0].id;
      const res = await fetch(
        `/api/portal/chat/messages?groupId=${selectedGroupId}&before_id=${oldestId}&limit=50`
      );
      const data = await res.json();
      if (data.success) {
        const olderMsgs = (data.messages || []).sort(
          (a: ChatMessage, b: ChatMessage) => a.createdAt - b.createdAt
        );
        if (olderMsgs.length < 50) {
          setHasMoreMessages(false);
        }
        if (olderMsgs.length > 0) {
          setMessages(prev => [...olderMsgs, ...prev]);
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setIsLoadingMore(false);
      shouldAutoScrollRef.current = true;
    }
  };

  // Build mention attachments from message text
  const buildMentionAttachments = (text: string): ChatAttachment[] => {
    const mentionRegex = /@(\w[\w\s]*?)(?=[\s,!?.]|$)/g;
    const mentions: { userId: string; startIndex: number; length: number }[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1].trim();
      const matchedMember = members.find(m =>
        m.nickname.toLowerCase() === mentionName.toLowerCase() ||
        m.nickname.toLowerCase().startsWith(mentionName.toLowerCase())
      );
      if (matchedMember) {
        mentions.push({
          userId: matchedMember.userId,
          startIndex: match.index,
          length: match[0].length,
        });
      }
    }

    if (mentions.length > 0) {
      return [{
        type: 'mentions',
        user_ids: mentions.map(m => m.userId),
        loci: mentions.map(m => [m.startIndex, m.length] as [number, number]),
      }];
    }
    return [];
  };

  const sendMessage = async () => {
    if (!selectedGroupId || !messageInput.trim() || isSending) return;
    setIsSending(true);
    const text = messageInput.trim();
    setMessageInput('');
    shouldAutoScrollRef.current = true;

    // Build mention attachments to send alongside message
    const attachments = buildMentionAttachments(text);

    try {
      const res = await fetch('/api/portal/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          text,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        // Optimistically add the sent message
        setMessages(prev => [...prev, {
          id: data.message.id,
          text: data.message.text,
          senderId: data.message.senderId,
          senderName: data.message.senderName,
          avatarUrl: data.message.avatarUrl,
          createdAt: data.message.createdAt,
          attachments: attachments,
          favoritedBy: [],
          system: false,
          senderType: 'user',
        }]);
        lastMessageIdRef.current = data.message.id;
      }
    } catch (err) {
      console.error('Send error:', err);
      setMessageInput(text);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Helper to mark a DM conversation as read
  const markDmRead = useCallback((userId: string) => {
    setUnreadState(prev => {
      const key = `dm-${userId}`;
      if (!prev[key] || prev[key].count === 0) return prev;
      return { ...prev, [key]: { ...prev[key], count: 0 } };
    });
  }, []);

  // Helper to mark a group as read
  const markGroupRead = useCallback((groupId: string) => {
    setUnreadState(prev => {
      const key = `group-${groupId}`;
      if (!prev[key] || prev[key].count === 0) return prev;
      return { ...prev, [key]: { ...prev[key], count: 0 } };
    });
  }, []);

  // DM Functions
  const selectDmUser = async (member: ChatMember) => {
    setDmView(true);
    setSelectedDmUser(member);
    setSelectedGroupId(null);
    setDmMessages([]);
    setIsLoadingDm(true);
    shouldAutoScrollRef.current = true;
    lastDmIdRef.current = null;

    // Clear unread for this DM conversation
    markDmRead(member.userId);

    try {
      const res = await fetch(`/api/portal/chat/dm?userId=${member.userId}`);
      const data = await res.json();
      if (data.success) {
        const sorted = (data.messages || []).sort(
          (a: DMMessage, b: DMMessage) => a.createdAt - b.createdAt
        );
        setDmMessages(sorted);
        if (sorted.length > 0) {
          lastDmIdRef.current = sorted[sorted.length - 1].id;
        }
      }
    } catch (err) {
      console.error('DM fetch error:', err);
    } finally {
      setIsLoadingDm(false);
    }
  };

  const pollNewDMs = useCallback(async () => {
    if (!selectedDmUser) return;
    try {
      const sinceId = lastDmIdRef.current;
      const url = `/api/portal/chat/dm?userId=${selectedDmUser.userId}${sinceId ? `&since_id=${sinceId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.messages?.length > 0) {
        const newMsgs = data.messages.sort(
          (a: DMMessage, b: DMMessage) => a.createdAt - b.createdAt
        );
        setDmMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const unique = newMsgs.filter((m: DMMessage) => !existingIds.has(m.id));
          if (unique.length === 0) return prev;
          return [...prev, ...unique];
        });
        lastDmIdRef.current = newMsgs[newMsgs.length - 1].id;
      }
    } catch (err) {
      console.error('DM poll error:', err);
    }
  }, [selectedDmUser]);

  const sendDm = async () => {
    if (!selectedDmUser || !messageInput.trim() || isSending) return;
    setIsSending(true);
    const text = messageInput.trim();
    setMessageInput('');
    shouldAutoScrollRef.current = true;

    try {
      const res = await fetch('/api/portal/chat/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedDmUser.userId, text }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setDmMessages(prev => [...prev, {
          id: data.message.id,
          text: data.message.text,
          senderId: data.message.senderId,
          senderName: data.message.senderName,
          avatarUrl: null,
          recipientId: data.message.recipientId,
          createdAt: data.message.createdAt,
          attachments: [],
          favoritedBy: [],
          conversationId: '',
        }]);
      }
    } catch (err) {
      console.error('Send DM error:', err);
      setMessageInput(text);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Mention handling
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    // Check for @ mention trigger
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt >= 0) {
      const textAfterAt = textBeforeCursor.substring(lastAt + 1);
      // Only show dropdown if no space before @ (or @ is at start)
      if (lastAt === 0 || value[lastAt - 1] === ' ' || value[lastAt - 1] === '\n') {
        if (!textAfterAt.includes(' ') || textAfterAt.split(' ').length <= 2) {
          setShowMentionDropdown(true);
          setMentionFilter(textAfterAt.toLowerCase());
          setMentionStartIndex(lastAt);
          return;
        }
      }
    }
    setShowMentionDropdown(false);
  };

  const insertMention = (member: ChatMember) => {
    const beforeMention = messageInput.substring(0, mentionStartIndex);
    const afterCursor = messageInput.substring(
      mentionStartIndex + mentionFilter.length + 1
    );
    const newValue = `${beforeMention}@${member.nickname} ${afterCursor}`;
    setMessageInput(newValue);
    setShowMentionDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentionDropdown) {
        const filtered = filteredMentionMembers;
        if (filtered.length > 0) {
          insertMention(filtered[0]);
        }
        return;
      }
      if (dmView) {
        sendDm();
      } else {
        sendMessage();
      }
    }
    if (e.key === 'Escape') {
      setShowMentionDropdown(false);
    }
  };

  const filteredMentionMembers = members.filter(m =>
    m.nickname.toLowerCase().includes(mentionFilter) &&
    m.userId !== currentUserId
  );

  const filteredSidebarMembers = members.filter(m =>
    m.nickname.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handleScroll = () => {
    if (!messageContainerRef.current) return;
    const { scrollTop } = messageContainerRef.current;
    if (scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
      </div>
    );
  }

  if (!user) return null;

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/portal/dashboard"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <MessageSquare className="w-6 h-6 text-lime-500" />
          <h1 className="text-lg font-semibold">Team Chat</h1>
          {dmView && selectedDmUser && (
            <span className="text-zinc-400 text-sm ml-2">
              / DM with {selectedDmUser.nickname}
            </span>
          )}
          {!dmView && selectedGroup && (
            <span className="text-zinc-400 text-sm ml-2">
              / {selectedGroup.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dmView ? (selectedDmUser && selectDmUser(selectedDmUser)) : (selectedGroupId && selectGroup(selectedGroupId))}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {!dmView && (
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={`p-2 rounded-lg transition-colors ${showMembers ? 'text-lime-500 bg-lime-500/10' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
              title="Members"
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Groups & DM contacts */}
        <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden shrink-0 hidden md:flex">
          {/* Groups section */}
          <div className="p-3 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Groups
            </h3>
            {isLoadingGroups ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              </div>
            ) : (
              <div className="space-y-1">
                {groups.map(group => {
                  const groupUnread = unreadState[`group-${group.id}`]?.count || 0;
                  return (
                    <button
                      key={group.id}
                      onClick={() => selectGroup(group.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                        selectedGroupId === group.id && !dmView
                          ? 'bg-lime-500/10 text-lime-400'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <Hash className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1">{group.name}</span>
                      {groupUnread > 0 && (
                        <span className="bg-lime-500 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                          {groupUnread > 9 ? '9+' : groupUnread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* DM contacts section */}
          <div className="flex-1 overflow-auto p-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Direct Messages
            </h3>
            {/* Member search */}
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-7 pr-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
              />
            </div>
            <div className="space-y-0.5">
              {filteredSidebarMembers
                .filter(m => m.userId !== currentUserId)
                .map(member => {
                  const dmUnread = unreadState[`dm-${member.userId}`]?.count || 0;
                  return (
                    <button
                      key={member.userId}
                      onClick={() => selectDmUser(member)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                        dmView && selectedDmUser?.userId === member.userId
                          ? 'bg-lime-500/10 text-lime-400'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {member.imageUrl ? (
                          <img
                            src={member.imageUrl}
                            alt={member.nickname}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                            {getInitials(member.nickname)}
                          </div>
                        )}
                        {dmUnread > 0 && (
                          <span className="absolute -top-1 -right-1 bg-lime-500 text-black text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                            {dmUnread > 9 ? '!' : dmUnread}
                          </span>
                        )}
                      </div>
                      <span className="truncate text-xs flex-1">{member.nickname}</span>
                      {dmUnread > 0 && (
                        <span className="w-2 h-2 bg-lime-500 rounded-full shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">
                <X className="w-4 h-4 inline" />
              </button>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={messageContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
          >
            {/* Load more indicator */}
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
              </div>
            )}
            {hasMoreMessages && !isLoadingMore && messages.length > 0 && !dmView && (
              <div className="flex justify-center py-2">
                <button
                  onClick={loadMoreMessages}
                  className="text-xs text-zinc-500 hover:text-lime-400 transition-colors flex items-center gap-1"
                >
                  <ChevronDown className="w-3 h-3 rotate-180" />
                  Load older messages
                </button>
              </div>
            )}

            {(isLoadingMessages || isLoadingDm) ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-lime-500" />
                <p className="text-zinc-500 text-sm">Loading messages...</p>
              </div>
            ) : (!dmView && messages.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MessageSquare className="w-12 h-12 text-zinc-700" />
                <p className="text-zinc-500">
                  {selectedGroupId ? 'No messages yet' : 'Select a group to start chatting'}
                </p>
              </div>
            ) : (dmView && dmMessages.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MessageCircle className="w-12 h-12 text-zinc-700" />
                <p className="text-zinc-500">
                  {selectedDmUser ? `No messages with ${selectedDmUser.nickname} yet` : 'Select a team member to start a conversation'}
                </p>
              </div>
            ) : null}

            {/* Group Messages */}
            {!dmView && messages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUserId;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showHeader = !prevMsg ||
                prevMsg.senderId !== msg.senderId ||
                (msg.createdAt - prevMsg.createdAt) > 300;

              return (
                <div key={msg.id} className={`group ${showHeader ? 'mt-3' : 'mt-0.5'}`}>
                  {showHeader && (
                    <div className="flex items-center gap-2 mb-1">
                      {msg.avatarUrl ? (
                        <img
                          src={msg.avatarUrl}
                          alt={msg.senderName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isOwn ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {msg.system ? (
                            <Circle className="w-4 h-4" />
                          ) : (
                            getInitials(msg.senderName)
                          )}
                        </div>
                      )}
                      <span className={`text-sm font-medium ${isOwn ? 'text-lime-400' : 'text-white'}`}>
                        {msg.senderName}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {formatTimestamp(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`pl-10 ${msg.system ? 'text-zinc-500 italic text-sm' : ''}`}>
                    {msg.text && (
                      <p className="text-zinc-200 text-sm whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    )}
                    {/* Image attachments */}
                    {msg.attachments?.filter(a => a.type === 'image' && a.url).map((att, i) => (
                      <div key={i} className="mt-1">
                        <img
                          src={att.url}
                          alt="Attachment"
                          className="max-w-xs max-h-60 rounded-lg border border-zinc-800"
                          loading="lazy"
                        />
                      </div>
                    ))}
                    {/* Video attachments */}
                    {msg.attachments?.filter(a => a.type === 'video' && a.url).map((att, i) => (
                      <div key={i} className="mt-1">
                        {att.preview_url ? (
                          <a href={att.url} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={att.preview_url}
                              alt="Video preview"
                              className="max-w-xs max-h-60 rounded-lg border border-zinc-800"
                            />
                            <span className="text-xs text-lime-400 mt-1 inline-block">View Video</span>
                          </a>
                        ) : (
                          <a href={att.url} target="_blank" rel="noreferrer" className="text-lime-400 text-sm hover:underline">
                            View Video
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* DM Messages */}
            {dmView && dmMessages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUserId;
              const prevMsg = idx > 0 ? dmMessages[idx - 1] : null;
              const showHeader = !prevMsg ||
                prevMsg.senderId !== msg.senderId ||
                (msg.createdAt - prevMsg.createdAt) > 300;

              return (
                <div key={msg.id} className={`group ${showHeader ? 'mt-3' : 'mt-0.5'}`}>
                  {showHeader && (
                    <div className="flex items-center gap-2 mb-1">
                      {msg.avatarUrl ? (
                        <img
                          src={msg.avatarUrl}
                          alt={msg.senderName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isOwn ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {getInitials(msg.senderName)}
                        </div>
                      )}
                      <span className={`text-sm font-medium ${isOwn ? 'text-lime-400' : 'text-white'}`}>
                        {msg.senderName}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {formatTimestamp(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className="pl-10">
                    {msg.text && (
                      <p className="text-zinc-200 text-sm whitespace-pre-wrap break-words">
                        {msg.text}
                      </p>
                    )}
                    {msg.attachments?.filter(a => a.type === 'image' && a.url).map((att, i) => (
                      <div key={i} className="mt-1">
                        <img
                          src={att.url}
                          alt="Attachment"
                          className="max-w-xs max-h-60 rounded-lg border border-zinc-800"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          {(selectedGroupId || (dmView && selectedDmUser)) && (
            <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-900 relative">
              {/* Mention dropdown */}
              {showMentionDropdown && filteredMentionMembers.length > 0 && (
                <div className="absolute bottom-full left-4 right-4 mb-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto z-20">
                  {filteredMentionMembers.slice(0, 8).map(member => (
                    <button
                      key={member.userId}
                      onClick={() => insertMention(member)}
                      className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-zinc-700 transition-colors text-sm"
                    >
                      {member.imageUrl ? (
                        <img src={member.imageUrl} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] font-bold">
                          {getInitials(member.nickname)}
                        </div>
                      )}
                      <span className="text-zinc-200">{member.nickname}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      dmView
                        ? `Message ${selectedDmUser?.nickname || ''}...`
                        : `Message #${selectedGroup?.name || ''}... (@ to mention)`
                    }
                    rows={1}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-lime-500 focus:border-lime-500 max-h-32"
                    style={{ minHeight: '40px' }}
                  />
                </div>
                <button
                  onClick={dmView ? sendDm : sendMessage}
                  disabled={!messageInput.trim() || isSending}
                  className="p-2.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          )}
        </main>

        {/* Right Sidebar - Members */}
        {showMembers && !dmView && (
          <aside className="w-60 bg-zinc-900 border-l border-zinc-800 overflow-y-auto p-3 hidden lg:block">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Members ({members.length})
            </h3>
            <div className="space-y-1">
              {members.map(member => (
                <button
                  key={member.userId}
                  onClick={() => selectDmUser(member)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                  title={`DM ${member.nickname}`}
                >
                  {member.imageUrl ? (
                    <img
                      src={member.imageUrl}
                      alt={member.nickname}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                      {getInitials(member.nickname)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{member.nickname}</p>
                    {member.roles?.includes('admin') && (
                      <p className="text-[10px] text-lime-500">Admin</p>
                    )}
                    {member.userId === currentUserId && (
                      <p className="text-[10px] text-zinc-600">You</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile bottom nav for groups/DMs */}
      <div className="md:hidden border-t border-zinc-800 bg-zinc-900 px-2 py-2">
        {/* Tab switcher */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'groups' ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Groups
            {Object.entries(unreadState).filter(([k, v]) => k.startsWith('group-') && v.count > 0).length > 0 && (
              <span className="ml-1 bg-lime-500 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {Object.entries(unreadState).filter(([k, v]) => k.startsWith('group-') && v.count > 0).reduce((sum, [, v]) => sum + v.count, 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('dms')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'dms' ? 'bg-lime-500/20 text-lime-400' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            Direct Messages
            {Object.entries(unreadState).filter(([k, v]) => k.startsWith('dm-') && v.count > 0).length > 0 && (
              <span className="ml-1 bg-lime-500 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {Object.entries(unreadState).filter(([k, v]) => k.startsWith('dm-') && v.count > 0).reduce((sum, [, v]) => sum + v.count, 0)}
              </span>
            )}
          </button>
        </div>
        {/* Tab content */}
        <div className="flex gap-1 overflow-x-auto">
          {activeTab === 'groups' && groups.map(group => {
            const groupUnread = unreadState[`group-${group.id}`]?.count || 0;
            return (
              <button
                key={group.id}
                onClick={() => selectGroup(group.id)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors relative ${
                  selectedGroupId === group.id && !dmView
                    ? 'bg-lime-500/20 text-lime-400 ring-1 ring-lime-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                # {group.name}
                {groupUnread > 0 && (
                  <span className="ml-1 bg-lime-500 text-black text-[10px] font-bold rounded-full px-1 py-0">
                    {groupUnread}
                  </span>
                )}
              </button>
            );
          })}
          {activeTab === 'dms' && filteredSidebarMembers
            .filter(m => m.userId !== currentUserId)
            .map(member => {
              const dmUnread = unreadState[`dm-${member.userId}`]?.count || 0;
              return (
                <button
                  key={member.userId}
                  onClick={() => selectDmUser(member)}
                  className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors flex items-center gap-1 ${
                    dmView && selectedDmUser?.userId === member.userId
                      ? 'bg-lime-500/20 text-lime-400 ring-1 ring-lime-500/30'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {member.nickname.split(' ')[0]}
                  {dmUnread > 0 && (
                    <span className="bg-lime-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {dmUnread}
                    </span>
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
