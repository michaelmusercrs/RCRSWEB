'use client';

/**
 * Conversation list (groups + DMs) for the portal messaging UI.
 * Mobile-first: collapses naturally to full-width on small screens via
 * parent layout's responsive grid.
 */

import { Hash, MessageCircle, Search, Users } from 'lucide-react';
import type { ChangeEvent } from 'react';

export interface ConversationListItem {
  id: string;
  kind: 'group' | 'dm';
  name: string;
  subtitle?: string;
  unreadCount?: number;
  lastTimestamp?: number;
}

interface Props {
  groups: ConversationListItem[];
  dms: ConversationListItem[];
  selectedId: string | null;
  selectedKind: 'group' | 'dm' | null;
  onSelect: (id: string, kind: 'group' | 'dm') => void;
  search: string;
  onSearch: (q: string) => void;
  loading?: boolean;
}

export function ConversationList({
  groups,
  dms,
  selectedId,
  selectedKind,
  onSelect,
  search,
  onSearch,
  loading,
}: Props) {
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value);

  const filteredGroups = search
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;
  const filteredDms = search
    ? dms.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : dms;

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-r border-zinc-800">
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={handleSearch}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md pl-7 pr-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="p-3 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Groups
          </h3>
          {loading ? (
            <p className="text-xs text-zinc-600 italic">Loading…</p>
          ) : filteredGroups.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No groups</p>
          ) : (
            <div className="space-y-0.5">
              {filteredGroups.map((g) => (
                <ConvButton
                  key={`g-${g.id}`}
                  item={g}
                  active={selectedKind === 'group' && selectedId === g.id}
                  onClick={() => onSelect(g.id, 'group')}
                />
              ))}
            </div>
          )}
        </section>

        <section className="p-3">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" /> Direct Messages
          </h3>
          {filteredDms.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No team members</p>
          ) : (
            <div className="space-y-0.5">
              {filteredDms.map((d) => (
                <ConvButton
                  key={`d-${d.id}`}
                  item={d}
                  active={selectedKind === 'dm' && selectedId === d.id}
                  onClick={() => onSelect(d.id, 'dm')}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConvButton({
  item,
  active,
  onClick,
}: {
  item: ConversationListItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
        active ? 'bg-lime-500/10 text-lime-400' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
      }`}
    >
      {item.kind === 'group' ? (
        <Hash className="w-4 h-4 shrink-0" />
      ) : (
        <MessageCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="flex-1 truncate">{item.name}</span>
      {(item.unreadCount ?? 0) > 0 && (
        <span className="bg-lime-500 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
          {(item.unreadCount ?? 0) > 9 ? '9+' : item.unreadCount}
        </span>
      )}
    </button>
  );
}
