'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Send, X, Loader2, ChevronDown, Sparkles, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedQuestions?: string[];
}

interface QuickAction {
  label: string;
  query: string;
}

// =============================================================================
// Simple markdown renderer
// =============================================================================

function renderMarkdown(text: string) {
  // Split into lines and process
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (!line.trim()) {
      elements.push(<br key={key++} />);
      continue;
    }

    // Process inline markdown
    let processed = line;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    const regex = /\*\*(.+?)\*\*/g;
    let match;

    while ((match = regex.exec(processed)) !== null) {
      if (match.index > lastIdx) {
        parts.push(processed.slice(lastIdx, match.index));
      }
      parts.push(<strong key={`b${key}${match.index}`} className="font-semibold text-white">{match[1]}</strong>);
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < processed.length) {
      parts.push(processed.slice(lastIdx));
    }

    // List item
    if (line.trimStart().startsWith('- ')) {
      elements.push(
        <div key={key++} className="flex gap-2 pl-2">
          <span className="text-lime-500 shrink-0">•</span>
          <span>{parts.length > 0 ? parts : processed.slice(2)}</span>
        </div>
      );
    } else {
      elements.push(<div key={key++}>{parts.length > 0 ? parts : processed}</div>);
    }
  }

  return <>{elements}</>;
}

// =============================================================================
// Component
// =============================================================================

export default function AIChatPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [accessLevel, setAccessLevel] = useState('');
  const [initialized, setInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Initialize on first open
  const initialize = useCallback(async () => {
    if (initialized || !user) return;
    try {
      const res = await fetch('/api/portal/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' }),
      });
      const data = await res.json();
      if (data.success) {
        setAccessLevel(data.accessLevel || '');
        setQuickActions(data.quickActions || []);
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: data.greeting,
          timestamp: new Date(),
        }]);
        setInitialized(true);
      }
    } catch (err) {
      console.error('AI Chat init error:', err);
    }
  }, [initialized, user]);

  const handleOpen = () => {
    setIsOpen(true);
    if (!initialized) initialize();
  };

  // Send message
  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/portal/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.success
          ? data.response
          : (data.error || 'Something went wrong. Please try again.'),
        timestamp: new Date(),
        suggestedQuestions: data.suggestedQuestions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Failed to connect. Please check your connection and try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-24 right-6 z-50 bg-gradient-to-br from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 text-black p-3.5 rounded-full shadow-lg shadow-lime-500/25 transition-all hover:scale-105 group"
        title="RoofStack Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-emerald-600">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">RoofStack Assistant</h3>
            <p className="text-[10px] text-neutral-500">{accessLevel}</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-lime-500/15 text-lime-100 rounded-br-md'
                  : 'bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}

              {/* Suggested questions */}
              {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-neutral-800 flex flex-wrap gap-1.5">
                  {msg.suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      disabled={isLoading}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 hover:text-lime-400 hover:bg-neutral-700 transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-lime-500" />
                <span className="text-xs text-neutral-500">Searching...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions (show when few messages) */}
      {messages.length <= 1 && quickActions.length > 0 && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => sendMessage(action.query)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-full bg-neutral-800/80 text-neutral-400 hover:text-lime-400 hover:bg-neutral-700 border border-neutral-700/50 transition-colors disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-neutral-800 px-4 py-3 shrink-0 bg-neutral-900/50">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about jobs, leads, customers..."
            disabled={isLoading}
            className="flex-1 bg-neutral-800/50 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-lime-500/50 focus:border-lime-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-500 hover:bg-lime-400 text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
