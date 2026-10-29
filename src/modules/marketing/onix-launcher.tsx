'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TranslationKeys } from '@/i18n/en';

const AVATAR =
  'https://azvdmibriuqrmexwtrja.supabase.co/storage/v1/object/public/general-media/onix2/onix2-avatar.png';

type Msg = { role: 'user' | 'assistant'; content: string };

/**
 * 0N1X-2, the black cat robot yogi. Floating bottom-right. The server
 * route assembles its context (live dashboard figures, campaign goals,
 * and the advertising knowledge base) so none of that has to travel
 * through the browser.
 */
export function OnixLauncher({ dict }: { dict: TranslationKeys }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const t = dict.dash.onix;

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/onix/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: msgs.slice(-8) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      // Surface the server's own wording when it sent one — a missing key
      // and a declined question are different problems to the reader.
      setMsgs((m) => [...m, { role: 'assistant', content: data.reply ?? data.error ?? t.error }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: t.error }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        className="fixed bottom-5 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-card shadow-lg transition-transform hover:scale-105"
      >
        <Image src={AVATAR} alt={t.name} width={56} height={56} className="rounded-full" unoptimized />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-border bg-card shadow-xl">
      <header className="flex items-center gap-2 border-b border-border p-3">
        <Image src={AVATAR} alt="" width={32} height={32} className="rounded-full" unoptimized />
        <div className="min-w-0 flex-1">
          <div className="font-heading text-sm font-semibold leading-tight">{t.name}</div>
          <div className="truncate text-xs text-muted-foreground">{t.tagline}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
        {msgs.length === 0 && <p className="text-muted-foreground">{t.intro}</p>}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3 py-2 text-primary-foreground'
                : 'w-fit max-w-[90%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2'
            }
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="text-xs text-muted-foreground">{t.thinking}</p>}
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          placeholder={t.placeholder}
        />
        <Button size="sm" onClick={() => void send()} disabled={busy} aria-label={t.send}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
