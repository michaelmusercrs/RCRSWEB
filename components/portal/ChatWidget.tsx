'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, X, Loader2, Minimize2, Maximize2, ChevronDown,
  Hash, User, Users, MessageCircle, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface WidgetMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  avatarUrl: string | null;
  createdAt: number;
  system: boolean;
}

interface WidgetGroup {
  id: string;
  name: string;
}

interface WidgetMember {
  userId: string;
  nickname: string;
  imageUrl: string | null;
  roles: string[];
}

interface DMMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  avatarUrl: string | null;
  recipientId: string;
  createdAt: number;
  conversationId: string;
}

type WidgetView = 'group' | 'dm-list' | 'dm-chat';

const POLL_INTERVAL = 15000; // 15 seconds for widget

function formatTime(ts: number): string {
  const date = new Date(ts * 1000);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [groups, setGroups] = useState<WidgetGroup[]>([]);
  const [members, setMembers] = useState<WidgetMember[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // DM state
  const [view, setView] = useState<WidgetView>('group');
  const [selectedDmUser, setSelectedDmUser] = useState<WidgetMember | null>(null);
  const [dmMessages, setDmMessages] = useState<DMMessage[]>([]);
  const [isLoadingDm, setIsLoadingDm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<string | null>(null);
  const lastDmIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dmPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load groups
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const res = await fetch('/api/portal/chat/groups');
        const data = await res.json();
        if (data.success && data.groups?.length > 0) {
          setGroups(data.groups);
          if (!selectedGroupId) {
            setSelectedGroupId(data.groups[0].id);
          }
        }
      } catch (err) {
        console.error('Widget: Failed to load groups', err);
      }
    };
    loadGroups();
  }, []);

  // Load messages when group changes or widget opens
  useEffect(() => {
    if (isOpen && selectedGroupId && !isMinimized && view === 'group') {
      loadMessages();
    }
  }, [isOpen, selectedGroupId, isMinimized, view]);

  // Poll for new group messages
  useEffect(() => {
    if (selectedGroupId) {
      pollRef.current = setInterval(() => {
        pollMessages();
      }, POLL_INTERVAL);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [selectedGroupId]);

  // Poll for new DMs
  useEffect(() => {
    if (selectedDmUser && view === 'dm-chat') {
      dmPollRef.current = setInterval(() => {
        pollDmMessages();
      }, POLL_INTERVAL);

      return () => {
        if (dmPollRef.current) clearInterval(dmPollRef.current);
      };
    }
  }, [selectedDmUser, view]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, dmMessages, isOpen, isMinimized]);

  const loadMessages = async () => {
    if (!selectedGroupId) return;
    setIsLoading(true);

    try {
      const [msgRes, memberRes] = await Promise.all([
        fetch(`/api/portal/chat/messages?groupId=${selectedGroupId}&limit=30`),
        fetch(`/api/portal/chat/members?groupId=${selectedGroupId}`),
      ]);
      const msgData = await msgRes.json();
      const memberData = await memberRes.json();

      if (msgData.success) {
        const sorted = (msgData.messages || []).sort(
          (a: WidgetMessage, b: WidgetMessage) => a.createdAt - b.createdAt
        );
        setMessages(sorted);
        if (sorted.length > 0) {
          lastSeenIdRef.current = sorted[sorted.length - 1].id;
        }
        setUnreadCount(0);
      }

      if (memberData.success) {
        setCurrentUserId(memberData.currentUserId);
        setMembers(memberData.members || []);
      }
    } catch (err) {
      console.error('Widget: load messages error', err);
    } finally {
      setIsLoading(false);
    }
  };

  const pollMessages = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const params = lastSeenIdRef.current
        ? `&since_id=${lastSeenIdRef.current}`
        : '';
      const res = await fetch(
        `/api/portal/chat/messages?groupId=${selectedGroupId}&limit=30${params}`
      );
      const data = await res.json();
      if (data.success && data.messages?.length > 0) {
        const newMsgs = data.messages.sort(
          (a: WidgetMessage, b: WidgetMessage) => a.createdAt - b.createdAt
        );

        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const unique = newMsgs.filter((m: WidgetMessage) => !existingIds.has(m.id));
          if (unique.length === 0) return prev;
          // Track unread if widget is closed or viewing DMs
          if (!isOpen || isMinimized || view !== 'group') {
            setUnreadCount(c => c + unique.length);
          }
          return [...prev.slice(-50), ...unique];
        });
        lastSeenIdRef.current = newMsgs[newMsgs.length - 1].id;
      }
    } catch {
      // Silent fail for polling
    }
  }, [selectedGroupId, isOpen, isMinimized, view]);

  // DM functions
  const loadDmMessages = async (userId: string) => {
    setIsLoadingDm(true);
    lastDmIdRef.current = null;
    try {
      const res = await fetch(`/api/portal/chat/dm?userId=${userId}`);
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
      console.error('Widget: DM load error', err);
    } finally {
      setIsLoadingDm(false);
    }
  };

  const pollDmMessages = useCallback(async () => {
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
    } catch {
      // Silent fail
    }
  }, [selectedDmUser]);

  const selectDmUser = (member: WidgetMember) => {
    setSelectedDmUser(member);
    setView('dm-chat');
    setDmMessages([]);
    loadDmMessages(member.userId);
  };

  const sendMessage = async () => {
    if (view === 'dm-chat') {
      return sendDm();
    }
    if (!selectedGroupId || !messageInput.trim() || isSending) return;
    setIsSending(true);
    const text = messageInput.trim();
    setMessageInput('');

    try {
      const res = await fetch('/api/portal/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId, text }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev, {
          id: data.message.id,
          text: data.message.text,
          senderId: data.message.senderId,
          senderName: data.message.senderName,
          avatarUrl: data.message.avatarUrl,
          createdAt: data.message.createdAt,
          system: false,
        }]);
        lastSeenIdRef.current = data.message.id;
      }
    } catch (err) {
      console.error('Widget: send error', err);
      setMessageInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const sendDm = async () => {
    if (!selectedDmUser || !messageInput.trim() || isSending) return;
    setIsSending(true);
    const text = messageInput.trim();
    setMessageInput('');

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
          conversationId: '',
        }]);
        lastDmIdRef.current = data.message.id;
      }
    } catch (err) {
      console.error('Widget: DM send error', err);
      setMessageInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
    if (selectedGroupId && view === 'group') {
      loadMessages();
    }
  };

  const switchToGroup = () => {
    setView('group');
    setSelectedDmUser(null);
    setDmMessages([]);
    setMessageInput('');
    if (selectedGroupId) {
      loadMessages();
    }
  };

  const switchToDmList = () => {
    setView('dm-list');
    setMessageInput('');
  };

  // Floating button (collapsed state)
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 bg-lime-500 hover:bg-lime-400 text-black p-3.5 rounded-full shadow-lg shadow-lime-500/20 transition-all hover:scale-105 group"
        title="Team Chat"
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Active messages based on view
  const activeMessages = view === 'dm-chat' ? dmMessages : messages;
  const isLoadingActive = view === 'dm-chat' ? isLoadingDm : isLoading;

  // Widget panel
  return (
    <div className={`fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col transition-all ${
      isMinimized ? 'w-72 h-12' : 'w-96 h-[520px]'
    }`}>
      {/* Widget header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 rounded-t-xl bg-zinc-900 cursor-pointer shrink-0"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-2">
          {view === 'dm-chat' && (
            <button
              onClick={(e) => { e.stopPropagation(); switchToDmList(); }}
              className="p-0.5 text-zinc-400 hover:text-white"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          <MessageSquare className="w-4 h-4 text-lime-500" />
          <span className="text-sm font-medium text-white">
            {view === 'dm-chat' && selectedDmUser
              ? selectedDmUser.nickname
              : view === 'dm-list'
              ? 'Direct Messages'
              : 'Team Chat'}
          </span>
          {view === 'group' && groups.length > 1 && !isMinimized && (
            <select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="bg-zinc-800 text-xs text-zinc-300 rounded px-1.5 py-0.5 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-lime-500"
              onClick={(e) => e.stopPropagation()}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}># {g.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/portal/chat"
            className="p-1 text-zinc-500 hover:text-lime-400 transition-colors"
            title="Open full chat"
            onClick={(e) => e.stopPropagation()}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* View tabs */}
          <div className="flex border-b border-zinc-800 shrink-0">
            <button
              onClick={switchToGroup}
              className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                view === 'group' ? 'text-lime-400 border-b-2 border-lime-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Hash className="w-3 h-3" />
              Groups
              {unreadCount > 0 && view !== 'group' && (
                <span className="bg-lime-500 text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={switchToDmList}
              className={`flex-1 py-1.5 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                (view === 'dm-list' || view === 'dm-chat') ? 'text-lime-400 border-b-2 border-lime-500' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <MessageCircle className="w-3 h-3" />
              DMs
            </button>
          </div>

          {/* DM member list */}
          {view === 'dm-list' && (
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-sm">
                  <Users className="w-8 h-8 mb-2" />
                  <p>No team members loaded</p>
                  <p className="text-xs mt-1">Open a group chat first to load members</p>
                </div>
              ) : (
                members
                  .filter(m => m.userId !== currentUserId)
                  .map(member => (
                    <button
                      key={member.userId}
                      onClick={() => selectDmUser(member)}
                      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-zinc-800 transition-colors"
                    >
                      {member.imageUrl ? (
                        <img src={member.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                          {getInitials(member.nickname)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{member.nickname}</p>
                        {member.roles?.includes('admin') && (
                          <p className="text-[10px] text-lime-500">Admin</p>
                        )}
                      </div>
                      <MessageCircle className="w-3.5 h-3.5 text-zinc-600" />
                    </button>
                  ))
              )}
            </div>
          )}

          {/* Messages area (group or DM) */}
          {(view === 'group' || view === 'dm-chat') && (
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
              {isLoadingActive ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 text-sm">
                  {view === 'dm-chat' ? (
                    <>
                      <MessageCircle className="w-8 h-8 mb-2" />
                      <p>No messages with {selectedDmUser?.nickname}</p>
                      <p className="text-xs text-zinc-700 mt-1">Send the first message below</p>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-8 h-8 mb-2" />
                      <p>No messages yet</p>
                    </>
                  )}
                </div>
              ) : (
                (view === 'dm-chat' ? dmMessages : messages).map((msg, idx) => {
                  const isOwn = msg.senderId === currentUserId;
                  const prevMsgs = view === 'dm-chat' ? dmMessages : messages;
                  const prevMsg = idx > 0 ? prevMsgs[idx - 1] : null;
                  const showName = !prevMsg ||
                    prevMsg.senderId !== msg.senderId ||
                    (msg.createdAt - prevMsg.createdAt) > 300;

                  return (
                    <div key={msg.id} className={showName ? 'mt-2' : ''}>
                      {showName && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs font-medium ${isOwn ? 'text-lime-400' : 'text-zinc-400'}`}>
                            {msg.senderName}
                          </span>
                          <span className="text-[10px] text-zinc-600">
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <p className={`text-xs text-zinc-300 pl-0 break-words ${'system' in msg && msg.system ? 'italic text-zinc-500' : ''}`}>
                        {msg.text}
                      </p>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input (hidden on dm-list view) */}
          {view !== 'dm-list' && (
            <div className="border-t border-zinc-800 px-3 py-2 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  view === 'dm-chat'
                    ? `Message ${selectedDmUser?.nickname || ''}...`
                    : 'Type a message...'
                }
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim() || isSending}
                className="p-1.5 rounded-lg bg-lime-500 hover:bg-lime-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
