'use client';

/**
 * DogChatBot — Duck Hunt-style dog floating chatbot.
 *
 * Very simple lead-gathering bot for now: name → phone → what you need →
 * submit to /api/forms/contact. The character is the iconic Duck Hunt
 * laughing-dog rendered as inline SVG so there's no image dependency
 * and it scales crisply at any zoom.
 *
 * To upgrade later:
 *  - Wire to a real LLM endpoint (existing /api/chat or new one)
 *  - Replace the linear name/phone/needs flow with conversational free-form
 *  - Add typing indicator animation
 *  - Add bark sound (optional, gated by user interaction)
 */

import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';

type Step = 'idle' | 'greeting' | 'name' | 'phone' | 'needs' | 'submitting' | 'done' | 'error';

interface Message {
  id: string;
  from: 'dog' | 'user';
  text: string;
}

const DOG_PROMPTS: Record<Exclude<Step, 'idle' | 'submitting' | 'done' | 'error'>, string> = {
  greeting: "Woof! 🐾 I'm Rivvy, the River City roof dog. I can grab a real human for you in about 60 seconds — what's your name?",
  name: '', // unused (greeting handles name prompt)
  phone: "Nice to meet you, {name}! What's the best phone number to reach you at?",
  needs: 'Got it. Quick — what brings you here today? (storm damage, leak, roof replacement, just looking, etc.)',
};

export default function DogChatBot() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [needs, setNeeds] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open the bot and show the first greeting
  function openBot() {
    setOpen(true);
    if (step === 'idle') {
      setStep('greeting');
      setMessages([{ id: 'g1', from: 'dog', text: DOG_PROMPTS.greeting }]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function resetAll() {
    setOpen(false);
    setStep('idle');
    setMessages([]);
    setInput('');
    setName('');
    setPhone('');
    setNeeds('');
    setErrorMsg('');
  }

  // Auto-scroll to newest message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function pushUser(text: string) {
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: 'user', text }]);
  }

  function pushDog(text: string) {
    setMessages((prev) => [...prev, { id: `d-${Date.now()}`, from: 'dog', text }]);
  }

  async function handleSend() {
    const value = input.trim();
    if (!value) return;
    pushUser(value);
    setInput('');

    if (step === 'greeting') {
      // Captured the name
      setName(value);
      setStep('phone');
      setTimeout(() => pushDog(DOG_PROMPTS.phone.replace('{name}', value.split(' ')[0])), 350);
    } else if (step === 'phone') {
      // Loose phone validation — just check we have at least 7 digits
      const digits = value.replace(/\D/g, '');
      if (digits.length < 7) {
        setTimeout(() => pushDog("Hmm, that doesn't look like a phone number — try again? (e.g. 256-555-1234)"), 350);
        return;
      }
      setPhone(value);
      setStep('needs');
      setTimeout(() => pushDog(DOG_PROMPTS.needs), 350);
    } else if (step === 'needs') {
      setNeeds(value);
      setStep('submitting');
      setTimeout(() => pushDog('On it — sending this to the team now... 🐕'), 200);
      try {
        const res = await fetch('/api/forms/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            phone,
            email: '',
            subject: 'Lead from Rivvy (chatbot)',
            message: value,
            sourcePage: 'Dog Chatbot',
            leadSource: 'Website Chatbot',
            leadSourceDetail: 'Rivvy the dog',
          }),
        });
        const data = await res.json();
        if (data.success) {
          setStep('done');
          setTimeout(
            () =>
              pushDog(
                `Done! Someone will call you at ${phone} within the hour during business hours. Thanks for reaching out, ${name.split(' ')[0]}! 🐾`,
              ),
            500,
          );
        } else {
          throw new Error(data.message || 'Submit failed');
        }
      } catch (err) {
        setStep('error');
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
        setTimeout(
          () => pushDog("Ruh-roh, something broke. Please call us at (256) 274-8530 instead."),
          500,
        );
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Pixel-art Duck Hunt-style dog (inline SVG) ──────────────────────────
  // Renders as a crisp pixel-art character that scales with the container.
  // Each "pixel" is a 1x1 square at the SVG viewBox, which is 16x16 units.
  function DuckHuntDog({ size = 64 }: { size?: number }) {
    // Pixel grid: each row is 16 chars; key:
    //   . = transparent
    //   B = brown body (#8B4513)
    //   D = dark brown (#5C2E0E)
    //   W = white belly/snout (#FFFFFF)
    //   K = black (#000000)
    //   P = pink tongue (#FF6B9D)
    const grid = [
      '................',
      '....BBBB........',
      '...BBBBBB.......',
      '..BDDBBBB.BB....',
      '..BDKBBBB.BBB...',
      '..BBBBBWWWWBB...',
      '...BBBWWPPWB....',
      '....BWWWWWWB....',
      '....BWWWWWB.....',
      '....WWWWWW......',
      '....W..W.W......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ];
    const COLORS: Record<string, string> = {
      B: '#8B4513',
      D: '#5C2E0E',
      W: '#FFFFFF',
      K: '#000000',
      P: '#FF6B9D',
    };
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {grid.flatMap((row, y) =>
          row.split('').map((ch, x) =>
            ch !== '.' ? (
              <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLORS[ch]} />
            ) : null,
          ),
        )}
      </svg>
    );
  }

  // Disabled input states
  const inputDisabled = step === 'submitting' || step === 'done' || step === 'idle';

  return (
    <>
      {/* Floating dog button — bottom-right above the FloatingContactButton */}
      {!open && (
        <button
          type="button"
          onClick={openBot}
          aria-label="Open chat with Rivvy the dog"
          className="fixed bottom-24 right-4 md:bottom-28 md:right-6 z-40 bg-brand-green hover:bg-lime-400 rounded-full p-2 shadow-2xl border-4 border-black hover:scale-110 active:scale-95 transition-transform animate-bounce-slow"
        >
          <DuckHuntDog size={56} />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center border-2 border-black">
            !
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm bg-neutral-950 border-2 border-brand-green rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-brand-green text-black p-3 flex items-center justify-between border-b-2 border-black">
            <div className="flex items-center gap-2">
              <DuckHuntDog size={40} />
              <div>
                <div className="font-black uppercase tracking-wider text-sm leading-tight">Rivvy</div>
                <div className="text-[10px] uppercase tracking-wider opacity-80">River City Roof Dog</div>
              </div>
            </div>
            <button
              type="button"
              onClick={resetAll}
              aria-label="Close chat"
              className="text-black hover:bg-black/10 rounded-full p-1 transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-2 bg-neutral-950 max-h-[50vh] min-h-[200px]"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                    m.from === 'user'
                      ? 'bg-brand-green text-black rounded-br-sm font-medium'
                      : 'bg-neutral-800 text-white rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {step === 'submitting' && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 text-white rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2 text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  thinking...
                </div>
              </div>
            )}
            {step === 'done' && (
              <div className="flex justify-center pt-2">
                <CheckCircle2 size={32} className="text-brand-green" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-neutral-800 p-2 bg-neutral-900">
            <div className="flex items-end gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={inputDisabled}
                placeholder={
                  step === 'greeting'
                    ? 'Your name...'
                    : step === 'phone'
                    ? 'Phone number...'
                    : step === 'needs'
                    ? 'What do you need?'
                    : step === 'done'
                    ? "We'll be in touch!"
                    : 'Type a message...'
                }
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-300 focus:outline-none focus:border-brand-green disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={inputDisabled || !input.trim()}
                className="bg-brand-green text-black p-2 rounded-xl hover:bg-lime-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </div>
            {errorMsg && (
              <p className="text-red-400 text-xs mt-1">{errorMsg}</p>
            )}
            {step === 'done' && (
              <button
                type="button"
                onClick={resetAll}
                className="mt-2 w-full text-xs text-neutral-300 hover:text-brand-green underline"
              >
                Start over
              </button>
            )}
          </div>
        </div>
      )}

      {/* Slow bounce animation for the floating dog button */}
      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        :global(.animate-bounce-slow) {
          animation: bounce-slow 2.4s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
