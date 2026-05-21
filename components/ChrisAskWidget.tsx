'use client';

/**
 * Chris Ask — floating Q&A + feedback widget for /chrisview/* pages.
 *
 * Bottom-right pill. Click to open a panel with two tabs:
 *   - Ask: chat against /api/chrisview-ask (Claude Sonnet 4.6 with the
 *     chrisview knowledge prompt; multi-turn within the same session)
 *   - Flag: submit a correction / request / note to /api/chrisview-feedback
 *     which logs to the chrisview_feedback master-sheet tab for owner
 *     review.
 *
 * Mounted globally by app/chrisview/layout.tsx so every chrisview page
 * gets it for free. The `pageId` prop is auto-derived from the URL.
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, AlertTriangle, Loader2, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Tab = 'ask' | 'flag';
type FlagKind = 'mistake' | 'request' | 'note';

export default function ChrisAskWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('ask');
  const [pageId, setPageId] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  // Ask state
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const askEndRef = useRef<HTMLDivElement | null>(null);

  // Flag state
  const [flagKind, setFlagKind] = useState<FlagKind>('mistake');
  const [valueShown, setValueShown] = useState('');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [flagMessage, setFlagMessage] = useState('');
  const [flagging, setFlagging] = useState(false);
  const [flagResult, setFlagResult] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPageUrl(window.location.pathname);
    const seg = window.location.pathname.split('/').filter(Boolean);
    // chrisview/foo -> foo. chrisview alone -> 'main'.
    setPageId(seg[1] || 'main');
  }, []);

  useEffect(() => {
    if (askEndRef.current) askEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function submitAsk() {
    const question = draft.trim();
    if (!question || asking) return;
    setAsking(true);
    setAskError('');
    const nextHistory: ChatMessage[] = [...history, { role: 'user', content: question }];
    setHistory(nextHistory);
    setDraft('');
    try {
      const res = await fetch('/api/chrisview-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          pageId,
          pageUrl,
          history: history.slice(-8),
        }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setHistory([...nextHistory, { role: 'assistant', content: data.answer || '' }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      // If the API key isn't configured in prod, give a clear admin-side
      // pointer rather than just "AI not configured".
      if (msg.toLowerCase().includes('not configured')) {
        setAskError('Q&A is not yet enabled. Owner needs to set ANTHROPIC_API_KEY in Vercel project settings, then redeploy. The Flag/Request tab still works.');
      } else {
        setAskError(msg);
      }
      setHistory(nextHistory);
    } finally {
      setAsking(false);
    }
  }

  async function submitFlag() {
    if (!flagMessage.trim() || flagging) return;
    setFlagging(true);
    setFlagResult('');
    try {
      const res = await fetch('/api/chrisview-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: flagKind,
          pageId,
          pageUrl,
          valueShown,
          suggestedValue,
          message: flagMessage,
        }),
      });
      const data = await res.json() as { success?: boolean; id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFlagResult(`Logged as ${data.id}. Owner will review.`);
      setFlagMessage('');
      setValueShown('');
      setSuggestedValue('');
    } catch (err) {
      setFlagResult(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setFlagging(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-[#39FF14] text-black rounded-full shadow-2xl hover:bg-[#39FF14]/90 transition-all font-semibold text-sm"
          aria-label="Ask about this page"
        >
          <Sparkles className="w-4 h-4" />
          Ask Claude
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-full max-w-md bg-zinc-950 border border-[#39FF14]/30 rounded-xl shadow-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
          <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#39FF14]" />
              <h3 className="text-sm font-semibold text-white">Chris View Assistant</h3>
              <span className="text-[10px] text-zinc-500 font-mono">{pageId}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setTab('ask')}
              className={`flex-1 px-4 py-2 text-xs font-medium border-b-2 -mb-px ${tab === 'ask' ? 'border-[#39FF14] text-[#39FF14]' : 'border-transparent text-zinc-400 hover:text-white'}`}
            >
              <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" />
              Ask
            </button>
            <button
              onClick={() => setTab('flag')}
              className={`flex-1 px-4 py-2 text-xs font-medium border-b-2 -mb-px ${tab === 'flag' ? 'border-amber-400 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white'}`}
            >
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
              Flag / Request
            </button>
          </div>

          {tab === 'ask' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
                {history.length === 0 && (
                  <div className="text-xs text-zinc-500">
                    Ask anything about this page&apos;s numbers. Examples:
                    <ul className="mt-2 space-y-1 list-disc list-inside text-zinc-400">
                      <li>Why is the close rate higher for insurance vs retail?</li>
                      <li>How does the median weeks-to-first-signed get calculated?</li>
                      <li>Is the $35.85M lifetime revenue figure accurate?</li>
                    </ul>
                  </div>
                )}
                {history.map((m, i) => (
                  <div key={i} className={`text-sm ${m.role === 'user' ? 'text-zinc-300' : 'text-white'}`}>
                    <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">{m.role === 'user' ? 'You' : 'Claude'}</div>
                    <div className={`whitespace-pre-wrap leading-relaxed px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-zinc-900' : 'bg-[#39FF14]/5 border border-[#39FF14]/20'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {asking && (
                  <div className="text-sm text-zinc-400 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Thinking…
                  </div>
                )}
                {askError && <div className="text-xs text-red-400">{askError}</div>}
                <div ref={askEndRef} />
              </div>
              <div className="p-3 border-t border-zinc-800">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitAsk();
                      }
                    }}
                    placeholder="Ask a question…"
                    rows={2}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-[#39FF14]/40"
                    disabled={asking}
                  />
                  <button
                    onClick={submitAsk}
                    disabled={asking || !draft.trim()}
                    className="px-3 py-2 bg-[#39FF14] text-black rounded-lg hover:bg-[#39FF14]/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Send"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1.5">Enter to send · Shift+Enter for newline · Rate limit 30/hr per IP</p>
              </div>
            </>
          )}

          {tab === 'flag' && (
            <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1.5">Kind</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['mistake', 'request', 'note'] as FlagKind[]).map(k => (
                    <button
                      key={k}
                      onClick={() => setFlagKind(k)}
                      className={`text-xs px-2 py-1.5 rounded ${flagKind === k ? 'bg-amber-400 text-black font-semibold' : 'bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-amber-400/40'}`}
                    >
                      {k === 'mistake' ? '🚨 Mistake' : k === 'request' ? '✨ Request' : '📝 Note'}
                    </button>
                  ))}
                </div>
              </div>
              {flagKind === 'mistake' && (
                <>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">Value shown (optional)</label>
                    <input
                      value={valueShown}
                      onChange={e => setValueShown(e.target.value)}
                      placeholder="e.g. -$900,000"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">Suggested value (optional)</label>
                    <input
                      value={suggestedValue}
                      onChange={e => setSuggestedValue(e.target.value)}
                      placeholder="e.g. -$280,000"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-1">Message</label>
                <textarea
                  value={flagMessage}
                  onChange={e => setFlagMessage(e.target.value)}
                  placeholder={
                    flagKind === 'mistake'
                      ? 'What looks wrong and why?'
                      : flagKind === 'request'
                      ? 'What new view or cut would help?'
                      : 'Annotation or context to attach to this page'
                  }
                  rows={4}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-amber-400/40"
                />
              </div>
              <button
                onClick={submitFlag}
                disabled={flagging || !flagMessage.trim()}
                className="w-full px-3 py-2 bg-amber-400 text-black rounded-lg font-semibold hover:bg-amber-400/90 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                {flagging ? 'Logging…' : 'Submit for owner review'}
              </button>
              {flagResult && (
                <div className={`text-xs ${flagResult.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {flagResult}
                </div>
              )}
              <p className="text-[10px] text-zinc-600">Logged to <code className="text-zinc-500">chrisview_feedback</code> tab — Michael or Sara will review.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
